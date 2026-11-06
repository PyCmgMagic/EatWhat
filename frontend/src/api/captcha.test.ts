// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captchaProof,
  runBrowserCaptcha,
  runDemoCaptcha,
  type CaptchaRunner,
} from "./captcha";
import { createApi } from "./service";
import { ApiError, createTransport, duplicateFoodId } from "./client";

const config = () => ({
  enabled: true as const,
  provider: "tencent-cloud-intl" as const,
  appId: "1001",
  scriptUrl: "https://ca.turing.captcha.qcloud.com/TJNCaptcha-global.js",
  aidEncrypted: crypto.randomUUID(),
  aidEncryptedType: "cbc" as const,
  expiresAt: Math.floor(Date.now() / 1000) + 120,
});
type Callback = (reply: {
  ret: number;
  ticket?: string;
  randstr?: string;
  errorCode?: string;
}) => void;
let callbacks: Callback[], destroys: ReturnType<typeof vi.fn>[];
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
  callbacks = [];
  destroys = [];
  window.TencentCaptcha = class {
    destroy = vi.fn();
    constructor(_container: HTMLElement, _id: string, callback: Callback) {
      callbacks.push(callback);
      destroys.push(this.destroy);
    }
    show() {}
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  document
    .querySelectorAll(
      ".ew-captcha-container,.ew-captcha-surface,dialog[data-login]",
    )
    .forEach((e) => e.remove());
});
const ready = () =>
  vi.waitFor(() => expect(callbacks.length).toBeGreaterThan(0));

describe("single-use human verification", () => {
  it("never shares configurations, instances or tickets across attempts, even after a business failure", async () => {
    const read = vi.fn(async () => config()),
      send = vi
        .fn()
        .mockRejectedValueOnce(new ApiError("限流", 429))
        .mockResolvedValue(undefined);
    const first = runBrowserCaptcha(read, send);
    const rejected = expect(first).rejects.toThrow("限流");
    await ready();
    callbacks[0]({ ret: 0, ticket: "one", randstr: "r1" });
    await rejected;
    const second = runBrowserCaptcha(read, send);
    await vi.waitFor(() => expect(callbacks).toHaveLength(2));
    callbacks[1]({ ret: 0, ticket: "two", randstr: "r2" });
    await second;
    expect(read).toHaveBeenCalledTimes(2);
    expect(destroys.every((d) => d.mock.calls.length === 1)).toBe(true);
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      { "X-Captcha-Ticket": "one", "X-Captcha-Randstr": "r1" },
      { "X-Captcha-Ticket": "two", "X-Captcha-Randstr": "r2" },
    ]);
  });
  it.each([
    { ret: 2 },
    { ret: 1 },
    { ret: 0, ticket: "trerror_failure", randstr: "r" },
    { ret: 0, ticket: "ticket" },
    { ret: 0, ticket: "ticket", randstr: "r", errorCode: "500" },
  ])("does not send on cancel or invalid callback %j", async (reply) => {
    const send = vi.fn(),
      run = runBrowserCaptcha(async () => config(), send),
      rejected = expect(run).rejects.toThrow();
    await ready();
    callbacks[0](reply);
    await rejected;
    expect(send).not.toHaveBeenCalled();
    expect(destroys[0]).toHaveBeenCalledOnce();
  });
  it("ignores duplicate successful callbacks", async () => {
    const send = vi.fn().mockResolvedValue(undefined),
      run = runBrowserCaptcha(async () => config(), send);
    await ready();
    callbacks[0]({ ret: 0, ticket: "one", randstr: "r" });
    callbacks[0]({ ret: 0, ticket: "two", randstr: "r2" });
    await run;
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]["X-Captcha-Ticket"]).toBe("one");
  });
  it("destroys and ignores late callbacks on component cancellation", async () => {
    const controller = new AbortController(),
      send = vi.fn(),
      run = runBrowserCaptcha(async () => config(), send, controller.signal),
      rejected = expect(run).rejects.toThrow();
    await ready();
    controller.abort();
    await rejected;
    callbacks[0]({ ret: 0, ticket: "late", randstr: "late" });
    expect(send).not.toHaveBeenCalled();
    expect(destroys[0]).toHaveBeenCalledOnce();
    expect(document.querySelector(".ew-captcha-surface")).toBeNull();
  });
  it("opens verification above a modal login and cleans it up after success", async () => {
    const login = document.createElement("dialog");
    login.dataset.login = "true";
    login.innerHTML = '<button type="button">获取验证码</button>';
    document.body.append(login);
    login.showModal();
    login.querySelector("button")!.focus();
    const send = vi.fn().mockResolvedValue(undefined);
    const run = runBrowserCaptcha(async () => config(), send);
    await ready();
    const surface = document.querySelector<HTMLDialogElement>(
      ".ew-captcha-surface",
    )!;
    expect(surface.open).toBe(true);
    expect(
      surface.contains(document.querySelector(".ew-captcha-container")),
    ).toBe(true);
    expect(surface.parentElement).toBe(document.body);
    callbacks[0]({ ret: 0, ticket: "one", randstr: "r" });
    await run;
    expect(login.open).toBe(true);
    expect(surface.isConnected).toBe(false);
    expect(send).toHaveBeenCalledOnce();
  });
  it("cancels a pending configuration when its login dialog closes", async () => {
    const login = document.createElement("dialog");
    login.dataset.login = "true";
    login.innerHTML = '<button type="button">获取验证码</button>';
    document.body.append(login);
    login.showModal();
    login.querySelector("button")!.focus();
    const send = vi.fn();
    const run = runBrowserCaptcha(() => new Promise(() => {}), send);
    const rejected = expect(run).rejects.toThrow("验证已结束");
    await Promise.resolve();
    login.close();
    await rejected;
    expect(callbacks).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    expect(document.querySelector(".ew-captcha-surface")).toBeNull();
  });
  it("cancels the verification surface without closing the login dialog", async () => {
    const login = document.createElement("dialog");
    login.dataset.login = "true";
    login.innerHTML = '<button type="button">获取验证码</button>';
    document.body.append(login);
    login.showModal();
    login.querySelector("button")!.focus();
    const send = vi.fn();
    const run = runBrowserCaptcha(async () => config(), send);
    const rejected = expect(run).rejects.toThrow("验证已结束");
    await ready();
    const surface = document.querySelector<HTMLDialogElement>(
      ".ew-captcha-surface",
    )!;
    const cancel = new Event("cancel", { cancelable: true });
    surface.dispatchEvent(cancel);
    await rejected;
    expect(cancel.defaultPrevented).toBe(true);
    expect(login.open).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(destroys[0]).toHaveBeenCalledOnce();
    expect(surface.isConnected).toBe(false);
  });
  it("cancels when the route changes", async () => {
    const send = vi.fn(),
      run = runBrowserCaptcha(async () => config(), send),
      rejected = expect(run).rejects.toThrow();
    await ready();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await rejected;
    expect(send).not.toHaveBeenCalled();
  });
  it("refuses expired initialization data before creating an instance", async () => {
    const send = vi.fn();
    await expect(
      runBrowserCaptcha(
        async () => ({
          ...config(),
          expiresAt: Math.floor(Date.now() / 1000) - 1,
        }),
        send,
      ),
    ).rejects.toThrow("配置");
    expect(callbacks).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
  it("does not send after a config failure", async () => {
    const send = vi.fn();
    await expect(
      runBrowserCaptcha(async () => {
        throw new ApiError("暂不可用", 50004);
      }, send),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it("has a separate demo challenge that never constructs Tencent's widget", async () => {
    const send = vi.fn().mockResolvedValue(undefined),
      read = config(),
      run = runDemoCaptcha(async () => read, send);
    await vi.waitFor(() =>
      expect(document.querySelector("[data-result=pass]")).toBeTruthy(),
    );
    (document.querySelector("[data-result=pass]") as HTMLButtonElement).click();
    await run;
    expect(callbacks).toHaveLength(0);
    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(send.mock.calls[0][0]["X-Captcha-Randstr"]).toBe(read.aidEncrypted);
    expect(document.querySelector(".ew-captcha-surface")).toBeNull();
  });
  it("keeps demo verification interactive above login and restores focus on Escape", async () => {
    const login = document.createElement("dialog");
    login.dataset.login = "true";
    login.innerHTML = '<button type="button">获取验证码</button>';
    document.body.append(login);
    login.showModal();
    const trigger = login.querySelector("button")!;
    trigger.focus();
    const send = vi.fn();
    const run = runDemoCaptcha(async () => config(), send);
    const rejected = expect(run).rejects.toThrow("已取消验证");
    await vi.waitFor(() =>
      expect(document.querySelector(".ew-demo-captcha")).toBeTruthy(),
    );
    expect(
      document.querySelector<HTMLDialogElement>(".ew-captcha-surface")?.open,
    ).toBe(true);
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await rejected;
    expect(login.open).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(send).not.toHaveBeenCalled();
    expect(document.querySelector(".ew-captcha-surface")).toBeNull();
  });
  it("rejects whitespace-only callback values", () =>
    expect(() =>
      captchaProof({ ret: 0, ticket: " ", randstr: "r" }),
    ).toThrow());
});

describe("all six protected sends", () => {
  const driver: CaptchaRunner = async (get, send, signal) => {
    const active = signal ?? new AbortController().signal;
    await get(active);
    await send(
      { "X-Captcha-Ticket": "test-ticket", "X-Captcha-Randstr": "test-rand" },
      active,
    );
  };
  it("fetches fresh no-store public config each time and preserves business auth, methods, bodies and query parameters", async () => {
    const requests: { url: string; options: RequestInit }[] = [];
    const api = createApi(
      createTransport(
        "https://gateway.test/api",
        () => ({ tokenName: "session", tokenValue: "private" }),
        async (url, options) => {
          requests.push({ url: String(url), options: options! });
          return new Response(
            JSON.stringify({
              code: 0,
              data: String(url).includes("captcha/config") ? config() : null,
            }),
          );
        },
      ),
      driver,
    );
    await api.phoneCode("13800000000");
    await api.passwordCode();
    await api.sendMobileCode("13800000000");
    await api.sendEmail("test@sdu.edu.cn");
    await api.legacyPhoneCode("13800000000");
    await api.passwordConflictChallenge("student");
    expect(requests).toHaveLength(12);
    for (let i = 0; i < 12; i += 2) {
      expect(requests[i].url).toContain("/auth/captcha/config");
      expect(requests[i].options.cache).toBe("no-store");
      expect(new Headers(requests[i].options.headers).has("session")).toBe(
        false,
      );
      expect(
        new Headers(requests[i].options.headers).has("X-Captcha-Ticket"),
      ).toBe(false);
      const headers = new Headers(requests[i + 1].options.headers);
      expect(headers.get("X-Captcha-Ticket")).toBe("test-ticket");
      expect(headers.get("X-Captcha-Randstr")).toBe("test-rand");
    }
    expect(new Headers(requests[1].options.headers).has("session")).toBe(false);
    expect(new Headers(requests[3].options.headers).get("session")).toBe(
      "Bearer private",
    );
    expect(new Headers(requests[11].options.headers).has("session")).toBe(
      false,
    );
    expect(JSON.parse(String(requests[5].options.body))).toEqual({
      mobile: "13800000000",
      scene: "bind",
    });
    expect(requests[7].options.method).toBe("GET");
    expect(requests[9].url).toContain("?mobile=13800000000");
    expect(requests[9].options.body).toBeUndefined();
  });
  it("retains duplicate-food payload without treating it as a successful creation", async () => {
    const api = createApi(async () => ({
      code: 40016,
      msg: "重复菜品",
      data: { id: 12 },
    }));
    let error: unknown;
    try {
      await api.createFood({
        name: "面",
        restaurantId: 1,
        pictureUrl: ["foods/x"],
      });
    } catch (e) {
      error = e;
    }
    expect(duplicateFoodId(error)).toBe(12);
    expect(
      duplicateFoodId(new ApiError("x", 40016, undefined, { id: "12" })),
    ).toBeUndefined();
  });
});
