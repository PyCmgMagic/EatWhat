import type { RequestOptions } from "./client";
import type { Schema } from "./models";

type Proof = RequestOptions["headers"];
export type CaptchaRunner = (
  config: (signal: AbortSignal) => Promise<Schema["PublicConfigResponse"]>,
  send: (proof: Proof, signal: AbortSignal) => Promise<void>,
  signal?: AbortSignal,
) => Promise<void>;
type Reply = {
  ret: number;
  ticket?: string;
  randstr?: string;
  errorCode?: number | string;
};
type Instance = { show: () => void; destroy: () => void };
type Constructor = new (
  container: HTMLElement,
  appId: string,
  callback: (reply: Reply) => void,
  options: {
    userLanguage: string;
    aidEncrypted: string;
    aidEncryptedType: "cbc";
  },
) => Instance;
declare global {
  interface Window {
    TencentCaptcha?: Constructor;
  }
}
const SDK = "https://ca.turing.captcha.qcloud.com/TJNCaptcha-global.js";
let sdk: Promise<void> | undefined;
function loadSdk() {
  if (window.TencentCaptcha) return Promise.resolve();
  if (!sdk)
    sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK;
      script.async = true;
      const timer = setTimeout(() => failed(), 20000);
      const failed = () => {
        clearTimeout(timer);
        script.remove();
        sdk = undefined;
        reject(new Error("验证组件加载失败，请稍后重试。"));
      };
      script.onerror = failed;
      script.onload = () => {
        clearTimeout(timer);
        if (window.TencentCaptcha) resolve();
        else failed();
      };
      document.head.append(script);
    });
  return sdk;
}
export function captchaProof(reply: Reply): Proof {
  if (reply.ret === 2) throw new Error("已取消验证，尚未发送。");
  if (
    reply.ret !== 0 ||
    (reply.errorCode != null && String(reply.errorCode) !== "0") ||
    !reply.ticket?.trim() ||
    !reply.randstr?.trim() ||
    reply.ticket.startsWith("trerror_")
  )
    throw new Error("人机验证未通过，请重新验证。");
  return {
    "X-Captcha-Ticket": reply.ticket,
    "X-Captcha-Randstr": reply.randstr,
  };
}
function lifecycle(signal?: AbortSignal) {
  const controller = new AbortController();
  const owner = document.activeElement?.closest("dialog[open]");
  const abort = () =>
    controller.abort(new DOMException("验证已结束，尚未发送。", "AbortError"));
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  window.addEventListener("hashchange", abort, { once: true });
  owner?.addEventListener("close", abort, { once: true });
  return {
    signal: controller.signal,
    abort,
    done: () => {
      signal?.removeEventListener("abort", abort);
      window.removeEventListener("hashchange", abort);
      owner?.removeEventListener("close", abort);
    },
  };
}
// A body-level overlay is inert behind a modal login dialog, regardless of its
// z-index. Give the verification its own top-layer surface instead.
function captchaSurface(abort: () => void, demo = false) {
  const surface = document.createElement("dialog");
  surface.className = demo
    ? "ew-captcha-surface ew-demo-captcha-backdrop"
    : "ew-captcha-surface";
  surface.setAttribute("aria-label", demo ? "本地模拟人机验证" : "人机验证");
  Object.assign(surface.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    maxWidth: "none",
    maxHeight: "none",
    margin: "0",
    padding: demo ? "16px" : "0",
    border: "0",
    boxSizing: "border-box",
    background: demo ? "#231c1855" : "transparent",
    overflow: "auto",
  });
  const cancel = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    abort();
  };
  surface.addEventListener("cancel", cancel);
  surface.addEventListener("close", abort);
  return {
    element: surface,
    show: () => {
      document.body.append(surface);
      surface.showModal();
    },
    remove: () => {
      surface.removeEventListener("cancel", cancel);
      surface.removeEventListener("close", abort);
      if (surface.open) surface.close();
      surface.remove();
    },
  };
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export const runBrowserCaptcha: CaptchaRunner = async (
  getConfig,
  send,
  signal,
) => {
  const flow = lifecycle(signal);
  const surface = captchaSurface(flow.abort);
  let instance: Instance | undefined;
  const container = document.createElement("div");
  container.className = "ew-captcha-container";
  try {
    flow.signal.throwIfAborted();
    const config = await abortable(getConfig(flow.signal), flow.signal);
    flow.signal.throwIfAborted();
    if (config.enabled === false) {
      await send(undefined, flow.signal);
      return;
    }
    if (
      config.enabled !== true ||
      config.provider !== "tencent-cloud-intl" ||
      config.scriptUrl !== SDK ||
      !config.appId ||
      !/^[1-9][0-9]*$/.test(config.appId) ||
      !config.aidEncrypted ||
      config.aidEncryptedType !== "cbc" ||
      !config.expiresAt ||
      config.expiresAt * 1000 <= Date.now()
    )
      throw new Error("验证配置暂不可用，请稍后重试。");
    await abortable(loadSdk(), flow.signal);
    if (config.expiresAt * 1000 <= Date.now())
      throw new Error("验证配置已过期，请重试。");
    surface.element.append(container);
    surface.show();
    const proof = await abortable(
      new Promise<Proof>((resolve, reject) => {
        let settled = false;
        instance = new window.TencentCaptcha!(
          container,
          config.appId!,
          (reply) => {
            if (settled || flow.signal.aborted) return;
            settled = true;
            try {
              resolve(captchaProof(reply));
            } catch (error) {
              reject(error);
            }
          },
          {
            userLanguage: "zh-cn",
            aidEncrypted: config.aidEncrypted!,
            aidEncryptedType: "cbc",
          },
        );
        instance.show();
      }),
      flow.signal,
    );
    flow.signal.throwIfAborted();
    await send(proof, flow.signal);
  } finally {
    try {
      instance?.destroy();
    } catch {
      /* A third-party cleanup error must not change a completed send. */
    }
    container.remove();
    flow.done();
    surface.remove();
  }
};

// The demo driver never loads Tencent's SDK or uses the live API transport.
export const runDemoCaptcha: CaptchaRunner = async (
  getConfig,
  send,
  signal,
) => {
  const flow = lifecycle(signal),
    surface = captchaSurface(flow.abort, true),
    dialog = document.createElement("section");
  const previous = document.activeElement as HTMLElement | null;
  dialog.className = "ew-demo-captcha";
  dialog.style.background = "white";
  try {
    flow.signal.throwIfAborted();
    const config = await abortable(getConfig(flow.signal), flow.signal);
    flow.signal.throwIfAborted();
    const proof = await abortable(
      new Promise<Proof>((resolve, reject) => {
        dialog.innerHTML =
          '<h2>人机验证</h2><p>本地模拟验证，不会发送真实短信或邮件。</p><div><button type="button" data-result="cancel">取消</button><button type="button" data-result="fail">模拟失败</button><button type="button" data-result="pass">完成验证</button></div>';
        dialog.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            reject(new Error("已取消验证，尚未发送。"));
          }
          if (e.key === "Tab") {
            const buttons = [...dialog.querySelectorAll("button")],
              first = buttons[0],
              last = buttons.at(-1)!;
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        });
        dialog.addEventListener("click", (e) => {
          const result = (e.target as HTMLElement).closest<HTMLButtonElement>(
            "button",
          )?.dataset.result;
          if (result === "pass")
            resolve({
              "X-Captcha-Ticket": `demo-ticket:${config.aidEncrypted}`,
              "X-Captcha-Randstr": config.aidEncrypted!,
            });
          else if (result)
            reject(
              new Error(
                result === "cancel"
                  ? "已取消验证，尚未发送。"
                  : "模拟验证未通过，请重试。",
              ),
            );
        });
        surface.element.append(dialog);
        surface.show();
        dialog.querySelector("button")?.focus();
      }),
      flow.signal,
    );
    surface.remove();
    flow.signal.throwIfAborted();
    await send(proof, flow.signal);
  } finally {
    flow.done();
    surface.remove();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }
};
