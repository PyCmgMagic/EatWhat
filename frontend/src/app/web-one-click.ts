// H5 one-click login: the carrier authorization page asks for the middle four
// digits and explicit consent, then the backend exchanges spToken for a number.
import { recordPhoneAuthLog } from "./phone-auth-logs";

/** 600000 is success in every callback of the web SDK. */
const OK = 600000;
const SDK_VERSION = "2.1.15";

type SdkReply = {
  code?: number | string;
  spToken?: string;
  msg?: string;
  content?: unknown;
  vender?: unknown;
  requestId?: unknown;
  msgId?: unknown;
  carrier?: unknown;
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

export type WebOneClickLogEntry = {
  at: number;
  level: "info" | "warn";
  event: string;
  detail: Record<string, unknown>;
};

let logEntries: WebOneClickLogEntry[] = [];

/**
 * Diagnostics for one-click login, written to the console as
 * "phone_auth_<event>" and kept so the Console button (vConsole) on the phone
 * sign-in form can replay what happened before it was opened. Never add SDK
 * replies, phone numbers or authentication tokens.
 */
export const webOneClickLog = {
  snapshot: () => logEntries,
  add(
    event: string,
    detail: Record<string, unknown> = {},
    level: "info" | "warn" = "info",
  ) {
    // Share sanitized SDK errors and timings with the page's log viewer while
    // keeping the full diagnostic history available for vConsole replay.
    if (event === "timing") recordPhoneAuthLog("phone_auth_timing", detail);
    else if (event === "error") recordPhoneAuthLog("phone_auth_error", detail);
    else console[level]("phone_auth_" + event, detail);
    logEntries = [
      ...logEntries.slice(-199),
      { at: Date.now(), level, event, detail },
    ];
  },
  clear() {
    logEntries = [];
  },
  /** Prints the kept entries again, for a console that was opened late. */
  replay() {
    for (const entry of logEntries)
      console[entry.level](
        `phone_auth_${entry.event} (${new Date(entry.at).toLocaleTimeString()})`,
        entry.detail,
      );
  },
};

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
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
  webOneClickLog.add("timing", {
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Keep provider correlation IDs only; arbitrary strings can contain credentials. */
function diagnosticId(value: unknown) {
  return typeof value === "string" &&
    /^(?:[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}|[\da-f]{16,64})$/i.test(
      value,
    ) &&
    !/^\d+$/.test(value)
    ? value
    : undefined;
}

function failureReason(values: unknown[]) {
  const message = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.slice(0, 512))
    .join(" ");
  if (/script资源加载失败/.test(message)) return "SCRIPT_LOAD_FAILED";
  if (/(?:TypeError|ReferenceError|SyntaxError):/.test(message))
    return "SCRIPT_ERROR";
  if (/timeout|timed\s*out|超时/i.test(message)) return "TIMEOUT";
  if (/network|failed to fetch|网络/i.test(message)) return "NETWORK_ERROR";
  return undefined;
}

/** Supports both the aggregated carrier list and a single carrier callback. */
function carrierDiagnostics(reply: SdkReply) {
  const entries = Array.isArray(reply?.content)
    ? reply.content.slice(0, 3)
    : [reply];
  return entries.flatMap((value) => {
    const entry = record(value);
    const vendor = entry.vender;
    if (vendor !== "CM" && vendor !== "CU" && vendor !== "CT") return [];
    const content = record(entry.content);
    const carrier = record(entry.carrier);
    const codes = [
      ...(value === reply ? [] : [entry.code]),
      entry.resultCode,
      entry.result,
      content.code,
      content.resultCode,
      content.result,
      carrier.carrierSdkCode,
      carrier.carrierRespCode,
    ].flatMap((code) =>
      (typeof code === "string" || typeof code === "number") &&
      /^-?\d{1,8}$/.test(String(code))
        ? [String(code)]
        : [],
    );
    const reason = failureReason([
      entry.msg,
      entry.message,
      content.msg,
      content.message,
      carrier.carrierSdkMsg,
    ]);
    const requestId =
      diagnosticId(entry.requestId) ?? diagnosticId(content.requestId);
    const msgId = diagnosticId(entry.msgId) ?? diagnosticId(content.msgId);
    const carrierTraceId = diagnosticId(carrier.carrierTraceId);
    return [
      {
        vendor,
        codes: [...new Set(codes)],
        ...(reason ? { reason } : {}),
        ...(requestId ? { requestId } : {}),
        ...(msgId ? { msgId } : {}),
        ...(carrierTraceId ? { carrierTraceId } : {}),
      },
    ];
  });
}

function browserContext() {
  // Extract standard OS/browser versions rather than recording a full custom UA.
  const ua = navigator.userAgent.slice(0, 512);
  return {
    platform:
      ua.match(
        /Android [\d.]{1,16}|(?:iPhone|CPU) OS [\d_]{1,16}|Windows NT [\d.]{1,16}|Mac OS X [\d_]{1,16}|HarmonyOS(?: [\d.]{1,16})?/i,
      )?.[0] ?? "unknown",
    versions: (
      ua.match(
        /(?:UCBrowser|UCWEB|MicroMessenger|MQQBrowser|QQBrowser|EdgA?|OPR|Chrome|CriOS|Firefox|FxiOS|Version|Safari)\/[\d.]{1,32}/gi,
      ) ?? []
    ).slice(0, 8),
  };
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
  const requestId = diagnosticId(reply?.requestId);
  const carrierDetails = carrierDiagnostics(reply);
  // Also kept for the Console button, which replays it in vConsole.
  webOneClickLog.add(
    "error",
    {
      trace: timing.trace,
      timestamp: new Date().toISOString(),
      sdkVersion: SDK_VERSION,
      stage,
      code: code ?? "unknown",
      ...(carriers.length ? { carriers } : {}),
      ...(requestId ? { requestId } : {}),
      ...(carrierDetails.length ? { carrierDetails } : {}),
      network: { online: navigator.onLine },
      browser: browserContext(),
    },
    "warn",
  );
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
export const SDK_URL = `${import.meta.env.BASE_URL}vendor/numberauth/numberAuth-web-sdk-${SDK_VERSION}.js`;

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

export async function loadSdk(): Promise<PhoneNumberServer> {
  const Server = await sdkClass();
  const sdk = new Server();
  // The SDK reports usage logs to Aliyun by default; this page does not need it.
  sdk.setUploadEnable?.(false);
  sdk.setLoggerEnable?.(false);
  return sdk;
}

export async function webOneClickAvailable(
  api: WebOneClickApi,
  sdk?: PhoneNumberServer,
  timing = createWebOneClickTiming(),
): Promise<boolean> {
  try {
    const server = await timed(timing, "sdk", () =>
      sdk ? Promise.resolve(sdk) : loadSdk(),
    );
    const { accessToken, jwtToken } = await timed(timing, "token", () =>
      api.webOneClickToken(location.href, timing.trace),
    );
    logTokens(accessToken, jwtToken, timing);
    if (!accessToken || !jwtToken) return false;
    return await new Promise<boolean>((resolve) => {
      const start = performance.now();
      let checked = false;
      const finish = (available: boolean, raw?: SdkReply | string) => {
        if (checked) return;
        checked = true;
        if (!available && raw !== undefined)
          failure(parse(raw), timing, "environment");
        recordTiming(timing, "environment", start, available ? "ok" : "error");
        webOneClickLog.add(
          "available",
          { trace: timing.trace, available },
          available ? "info" : "warn",
        );
        resolve(available);
      };
      server.checkLoginAvailable({
        accessToken,
        jwtToken,
        success: (raw) => finish(Number(parse(raw).code) === OK, raw),
        error: (raw) => finish(false, raw),
      });
    });
  } catch (error) {
    webOneClickLog.add(
      "check_failed",
      { trace: timing.trace, error: errorText(error) },
      "warn",
    );
    return false;
  }
}

function logTokens(
  accessToken: string | undefined,
  jwtToken: string | undefined,
  timing: WebOneClickTiming,
) {
  // Only whether the backend returned each token, never the values.
  webOneClickLog.add(
    "token",
    {
      trace: timing.trace,
      accessToken: !!accessToken,
      jwtToken: !!jwtToken,
    },
    accessToken && jwtToken ? "info" : "warn",
  );
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
  const { accessToken, jwtToken } = await timed(timing, "token", () =>
    api.webOneClickToken(location.href, timing.trace),
  );
  logTokens(accessToken, jwtToken, timing);
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
                    timeout: 5, // SDK timeout is measured in seconds.
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
                      webOneClickLog.add("auth_page", {
                        trace: timing.trace,
                        status: Number(status),
                      });
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
