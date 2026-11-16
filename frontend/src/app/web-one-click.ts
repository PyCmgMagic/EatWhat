// H5 one-click login: the carrier authorization page asks for the middle four
// digits and explicit consent, then the backend exchanges spToken for a number.

/** 600000 is success in every callback of the web SDK. */
const OK = 600000;

type SdkReply = {
  code?: number | string;
  spToken?: string;
  msg?: string;
  content?: unknown;
};
type SdkCallbacks = {
  success: (reply: SdkReply | string) => void;
  error: (reply: SdkReply | string) => void;
  timeout?: number;
};
type PhoneNumberServer = {
  checkLoginAvailable(
    options: SdkCallbacks & { accessToken: string; jwtToken: string },
  ): void;
  getLoginToken(
    options: SdkCallbacks & {
      authPageOption: {
        navText: string;
        btnText: string;
        isHideLogo: boolean;
        manualClose: boolean;
      };
      watch: (status: number) => void;
    },
  ): void;
  closeLoginPage(): void;
  getConnection(): string;
  setUploadEnable?(enabled: boolean): void;
  setLoggerEnable?(enabled: boolean): void;
};

export type WebOneClickApi = {
  webOneClickToken(
    url: string,
    trace?: string,
  ): Promise<{ accessToken?: string; jwtToken?: string }>;
};

export type WebOneClickTiming = {
  trace: string;
  sdk: number;
  token: number;
  environment: number;
  carrier: number;
};

export function createWebOneClickTiming(): WebOneClickTiming {
  return {
    trace: crypto.randomUUID(),
    sdk: 0,
    token: 0,
    environment: 0,
    carrier: 0,
  };
}

export function webOneClickTimingHeaders(timing: WebOneClickTiming) {
  return {
    "X-Phone-Auth-Trace": timing.trace,
    "X-Phone-Auth-Timing": `sdk=${timing.sdk},token=${timing.token},environment=${timing.environment},carrier=${timing.carrier}`,
  };
}

async function timed<T>(
  timing: WebOneClickTiming,
  stage: "sdk" | "token" | "environment" | "carrier",
  action: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  let result = "ok";
  try {
    return await action();
  } catch (error) {
    result = "error";
    throw error;
  } finally {
    recordTiming(timing, stage, start, result);
  }
}

function recordTiming(
  timing: WebOneClickTiming,
  stage: "sdk" | "token" | "environment" | "carrier",
  start: number,
  result: string,
) {
  timing[stage] = Math.min(
    999999,
    Math.max(0, Math.round(performance.now() - start)),
  );
  // Never include SDK replies, errors, phone numbers or authentication tokens.
  console.info("phone_auth_timing", {
    trace: timing.trace,
    stage,
    elapsedMs: timing[stage],
    result,
  });
}

/** Only phones have a SIM on mobile data; desktops never pass the check. */
export function looksLikePhone(userAgent = navigator.userAgent) {
  return /Android|iPhone|iPod|HarmonyOS|Mobile/i.test(userAgent);
}

const WIFI = "请关闭 Wi-Fi、打开移动数据后再试，或用短信验证码登录。";

function parse(reply: SdkReply | string): SdkReply {
  if (typeof reply !== "string") return reply ?? {};
  try {
    return JSON.parse(reply) as SdkReply;
  } catch {
    return { msg: reply };
  }
}

/** Only keep bounded numeric status fields from the SDK's carrier replies. */
function carrierCodes(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const result: string[] = [];
  for (const entry of content.slice(0, 3)) {
    if (!entry || typeof entry !== "object") continue;
    const vendor = entry.vender;
    if (vendor !== "CM" && vendor !== "CU" && vendor !== "CT") continue;
    const codes = [entry.code, entry.resultCode, entry.result]
      .filter(
        (value): value is string | number =>
          typeof value === "string" || typeof value === "number",
      )
      .map(String)
      .filter((value) => /^-?\d{1,8}$/.test(value));
    const unique = [...new Set(codes)];
    const reason =
      typeof entry.msg === "string" && entry.msg.includes("script资源加载失败")
        ? "SCRIPT_LOAD_FAILED"
        : typeof entry.msg === "string" &&
            /^(TypeError|ReferenceError|SyntaxError):/.test(entry.msg)
          ? "SCRIPT_ERROR"
          : "NO_CODE";
    result.push(`${vendor}:${unique.length ? unique.join("/") : reason}`);
  }
  return [...new Set(result)];
}

function failure(
  reply: SdkReply,
  timing: WebOneClickTiming,
  stage: "environment" | "carrier",
) {
  // Accept only SDK error codes, never display/log the raw provider message.
  const code =
    /^600\d{3}$/.test(String(reply?.code)) && Number(reply.code) !== OK
      ? String(reply.code)
      : undefined;
  const messages: Record<string, string> = {
    "600008": WIFI,
    "600011": "运营商取号失败，可使用短信或密码登录。",
    "600013": "运营商服务暂不可用，请使用短信或密码登录。",
    "600014": "运营商调用次数已达上限，请稍后重试或使用短信登录。",
    "600015": "运营商响应超时，请在移动数据网络下重试或使用短信登录。",
    "600018": "该号码暂时无法使用运营商认证，请使用短信或密码登录。",
    "600025": "一键登录鉴权失败，请使用短信登录并反馈此错误码。",
    "600032": "一键登录配置不匹配，请使用短信登录并反馈此错误码。",
    "600034": "一键登录凭证已过期，请重新点击一键登录。",
  };
  const carriers = carrierCodes(reply?.content);
  console.warn("phone_auth_error", {
    trace: timing.trace,
    stage,
    code: code ?? "unknown",
    ...(carriers.length ? { carriers } : {}),
  });
  const message =
    (code && messages[code]) ||
    "本机号码一键登录没有完成，请用短信验证码登录。";
  const detail = [code, ...carriers].filter(Boolean).join("；");
  return new Error(message + (detail ? `（错误码 ${detail}）` : ""));
}

/**
 * The SDK file from the Aliyun console (numberAuthSDK_WEB_H5_v2.1.15
 * operator_ui_log_static), hosted with the site. It sets
 * window.PhoneNumberServer, which this page must never overwrite.
 */
export const SDK_URL = `${import.meta.env.BASE_URL}vendor/numberauth/numberAuth-web-sdk-2.1.15.js`;

type SdkWindow = Window & {
  PhoneNumberServer?: new () => PhoneNumberServer;
};

let loading: Promise<new () => PhoneNumberServer> | undefined;

function sdkClass(): Promise<new () => PhoneNumberServer> {
  const ready = (window as SdkWindow).PhoneNumberServer;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.charset = "utf-8";
    script.onload = () => {
      const Server = (window as SdkWindow).PhoneNumberServer;
      if (Server) resolve(Server);
      else
        reject(new Error("本机号码一键登录暂时不可用，请用短信验证码登录。"));
    };
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error("本机号码一键登录暂时不可用，请用短信验证码登录。"));
    };
    document.head.append(script);
  });
  return loading;
}

/** Loaded on demand, on the first tap: the SDK is about 480 KB. */
export async function loadSdk(): Promise<PhoneNumberServer> {
  const Server = await sdkClass();
  const sdk = new Server();
  // The SDK reports usage logs to Aliyun by default; this page does not need it.
  sdk.setUploadEnable?.(false);
  sdk.setLoggerEnable?.(false);
  return sdk;
}

/**
 * Runs the web SDK and returns the carrier spToken for the backend. The page
 * address goes to the backend, which only accepts the configured site.
 */
export async function webOneClickToken(
  api: WebOneClickApi,
  sdk?: PhoneNumberServer,
  timing = createWebOneClickTiming(),
): Promise<string> {
  const server = await timed(timing, "sdk", () =>
    sdk ? Promise.resolve(sdk) : loadSdk(),
  );
  if (server.getConnection() === "wifi") throw new Error(WIFI);
  const { accessToken, jwtToken } = await timed(timing, "token", () =>
    api.webOneClickToken(location.href, timing.trace),
  );
  if (!accessToken || !jwtToken)
    throw new Error("本机号码一键登录暂时不可用，请用短信验证码登录。");
  try {
    return await new Promise<string>((resolve, reject) => {
      const start = performance.now();
      let checked = false;
      const failed = (raw: SdkReply | string) => {
        if (checked) return;
        checked = true;
        recordTiming(timing, "environment", start, "error");
        reject(failure(parse(raw), timing, "environment"));
      };
      server.checkLoginAvailable({
        accessToken,
        jwtToken,
        success: (raw) => {
          if (checked) return;
          if (Number(parse(raw).code) !== OK) return failed(raw);
          checked = true;
          recordTiming(timing, "environment", start, "ok");
          // Start authorization inside the authentication callback, as required
          // by the SDK. Closing the page must also release the login button.
          resolve(
            timed(
              timing,
              "carrier",
              () =>
                new Promise<string>((done, fail) => {
                  let finished = false;
                  const settle = (token?: string, error?: Error) => {
                    if (finished) return;
                    finished = true;
                    if (token) done(token);
                    else fail(error);
                  };
                  server.getLoginToken({
                    authPageOption: {
                      navText: "本机号码一键登录",
                      btnText: "登录 / 注册",
                      isHideLogo: true,
                      manualClose: true,
                    },
                    success: (raw) => {
                      const reply = parse(raw);
                      if (
                        Number(reply.code) === OK &&
                        typeof reply.spToken === "string" &&
                        reply.spToken.trim()
                      )
                        settle(reply.spToken);
                      else settle(undefined, failure(reply, timing, "carrier"));
                    },
                    error: (raw) =>
                      settle(undefined, failure(parse(raw), timing, "carrier")),
                    watch: (status) => {
                      if (status === 2)
                        settle(
                          undefined,
                          new Error(
                            "已取消一键登录，可继续使用短信或密码登录。",
                          ),
                        );
                    },
                  });
                }),
            ),
          );
        },
        error: failed,
      });
    });
  } finally {
    server.closeLoginPage();
  }
}
