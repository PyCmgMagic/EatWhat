// Local number verification (Aliyun number authentication, H5): the person
// types their number, the web SDK asks the carrier for a one-time spToken over
// the mobile data connection, and the backend checks that the typed number is
// the SIM in use. It replaces the SMS code; it does not work over Wi-Fi.

/** 600000 is success in every callback of the web SDK. */
const OK = 600000;

type SdkReply = { code?: number | string; spToken?: string; msg?: string };
type SdkCallbacks = {
  success: (reply: SdkReply | string) => void;
  error: (reply: SdkReply | string) => void;
  timeout?: number;
};
type PhoneNumberServer = {
  checkAuthAvailable(
    options: SdkCallbacks & { accessToken: string; jwtToken: string },
  ): void;
  getVerifyToken(options: SdkCallbacks): void;
  getConnection(): string;
  setUploadEnable?(enabled: boolean): void;
};

export type LocalNumberApi = {
  webVerifyToken(
    url: string,
    trace?: string,
  ): Promise<{ accessToken?: string; jwtToken?: string }>;
};

export type LocalNumberTiming = {
  trace: string;
  sdk: number;
  token: number;
  environment: number;
  carrier: number;
};

export function createLocalNumberTiming(): LocalNumberTiming {
  return {
    trace: crypto.randomUUID(),
    sdk: 0,
    token: 0,
    environment: 0,
    carrier: 0,
  };
}

export function localNumberTimingHeaders(timing: LocalNumberTiming) {
  return {
    "X-Phone-Auth-Trace": timing.trace,
    "X-Phone-Auth-Timing": `sdk=${timing.sdk},token=${timing.token},environment=${timing.environment},carrier=${timing.carrier}`,
  };
}

async function timed<T>(
  timing: LocalNumberTiming,
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

function failure(reply: SdkReply) {
  // 600008: the environment check failed, almost always Wi-Fi or no SIM data.
  if (Number(reply.code) === 600008) return new Error(WIFI);
  return new Error("本机号码验证没有完成，请用短信验证码登录。");
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
      else reject(new Error("本机号码验证暂时不可用，请用短信验证码登录。"));
    };
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error("本机号码验证暂时不可用，请用短信验证码登录。"));
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
  return sdk;
}

/**
 * Runs the web SDK and returns the carrier spToken for the backend. The page
 * address goes to the backend, which only accepts the configured site.
 */
export async function localNumberToken(
  api: LocalNumberApi,
  sdk?: PhoneNumberServer,
  timing = createLocalNumberTiming(),
): Promise<string> {
  const server = await timed(timing, "sdk", () =>
    sdk ? Promise.resolve(sdk) : loadSdk(),
  );
  if (server.getConnection() === "wifi") throw new Error(WIFI);
  const { accessToken, jwtToken } = await timed(timing, "token", () =>
    api.webVerifyToken(location.href, timing.trace),
  );
  if (!accessToken || !jwtToken)
    throw new Error("本机号码验证暂时不可用，请用短信验证码登录。");
  await timed(
    timing,
    "environment",
    () =>
      new Promise<void>((resolve, reject) =>
        server.checkAuthAvailable({
          accessToken,
          jwtToken,
          success: (raw) => {
            const reply = parse(raw);
            if (Number(reply.code) === OK) resolve();
            else reject(failure(reply));
          },
          error: (raw) => reject(failure(parse(raw))),
        }),
      ),
  );
  return timed(
    timing,
    "carrier",
    () =>
      new Promise<string>((resolve, reject) =>
        server.getVerifyToken({
          success: (raw) => {
            const reply = parse(raw);
            if (Number(reply.code) === OK && reply.spToken)
              resolve(reply.spToken);
            else reject(failure(reply));
          },
          error: (raw) => reject(failure(parse(raw))),
        }),
      ),
  );
}
