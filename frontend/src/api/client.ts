export type Session = { tokenName: string; tokenValue: string };
export type Envelope<T> = {
  code?: number | string | null;
  msg?: string | null;
  data?: T | null;
  timestamp?: number;
};
export type Query = Record<
  string,
  string | number | boolean | (string | number)[] | undefined | null
>;
export type RequestOptions = {
  method?: string;
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Partial<
    Record<
      | "X-Captcha-Ticket"
      | "X-Captcha-Randstr"
      | "Idempotency-Key"
      | "X-Recovery-Capability"
      | "X-Lifecycle-Recovery",
      string
    >
  >;
  cache?: RequestCache;
  raw?: boolean;
  public?: boolean;
  /** Passive lifecycle calls still enforce access, but never open action dialogs. */
  background?: boolean;
};
export type Transport = (
  path: string,
  options: RequestOptions,
) => Promise<Envelope<unknown>>;

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: number | string | null,
    public status?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A blocked action rejects normally; it must never run success callbacks. */
export class AccessRequiredError extends ApiError {
  constructor(
    public reason: "login" | "verification",
    public presented = false,
  ) {
    super(
      reason === "login"
        ? "请先登录，再继续操作。"
        : "请先完成学生认证，再继续操作。",
      "ACCESS_REQUIRED",
    );
    this.name = "AccessRequiredError";
  }
}
export function accessPromptPresented(error: unknown) {
  return error instanceof AccessRequiredError && error.presented;
}

export function buildUrl(base: string, path: string, query?: Query) {
  // The gateway /api and location controller /api are both intentional.
  const url = `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      (Array.isArray(value) ? value : [value]).forEach((v) =>
        params.append(key, String(v)),
      );
    }
  });
  return params.size ? `${url}?${params}` : url;
}

export function safeJson(text: string): unknown {
  return JSON.parse(text, (_key, value) => {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      !Number.isSafeInteger(value)
    ) {
      throw new ApiError(
        "服务端返回的数字超出浏览器安全范围，请联系管理员调整 ID 的传输格式。",
        "UNSAFE_INTEGER",
      );
    }
    return value;
  });
}

export function createTransport(
  base: string,
  getSession: () => Session | null,
  fetcher: typeof fetch = fetch,
): Transport {
  return async (path, options) => {
    const timeout = AbortSignal.timeout(20_000);
    const signal = options.signal
      ? AbortSignal.any([timeout, options.signal])
      : timeout;
    const headers = new Headers({
      Accept: "application/json",
      ...options.headers,
    });
    const session = options.public ? null : getSession();
    if (session) headers.set(session.tokenName, `Bearer ${session.tokenValue}`);
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetcher(buildUrl(base, path, options.query), {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
        credentials: "omit",
        redirect: "error",
        cache: options.cache,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(
        signal.aborted
          ? "请求超时，请稍后重试。"
          : "网络连接失败，请检查网络后重试。",
        "NETWORK",
      );
    }
    const text = await response.text();
    let result: Envelope<unknown>;
    try {
      result = safeJson(text) as Envelope<unknown>;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `服务返回了无法识别的内容（HTTP ${response.status}）。`,
        "INVALID_RESPONSE",
        response.status,
      );
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new ApiError(
        "服务响应格式不正确。",
        "INVALID_RESPONSE",
        response.status,
      );
    if (!response.ok)
      throw new ApiError(
        result.msg || `请求失败（HTTP ${response.status}）。`,
        result.code,
        response.status,
        result.data,
      );
    return result;
  };
}

export function createRequester(transport: Transport) {
  return async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const result = await transport(path, options);
    if (options.raw) return result as T;
    if (String(result.code) !== "0")
      throw new ApiError(
        result.msg || "操作未完成，请稍后重试。",
        result.code,
        undefined,
        result.data,
      );
    return result.data as T;
  };
}

export function requiredData<T>(data: T | null | undefined): T {
  if (data === null || data === undefined)
    throw new ApiError("服务未返回所需数据，请稍后重试。", "MISSING_DATA");
  return data;
}

export function errorMessage(error: unknown): string {
  if (accessPromptPresented(error)) return "";
  if (error instanceof ApiError) {
    const hints: Record<string, string> = {
      "30010": "这个账号还没有设置密码，请使用手机验证码登录后设置。",
      "30011": "请先绑定手机号，再使用短信设置密码。",
      "30015": "请先完成人机验证，再重新发送。",
      "30016": "验证已失效或未通过，请重新验证。",
      "50001": "当前站点的验证码服务暂不可用，请稍后重新获取。",
      "50004": "人机验证暂不可用，请稍后重试。",
      "30012": "认证链接已过期或缺少状态，请重新发起认证。",
      PASSWORD_NOT_SET: "这个账号还没有设置密码，请改用手机验证码登录。",
      MOBILE_NOT_BOUND: "请先绑定手机号。",
      ACCOUNT_SECURITY_CONFLICT: "账号存在安全冲突，请联系管理员处理。",
      SITE_ENROLLMENT_REQUIRED:
        "账号尚未在当前站点就绪，请完成授权或稍后重试。",
    };
    if (hints[String(error.code)]) return hints[String(error.code)];
  }
  if (error instanceof Error) return error.message;
  return "操作未完成，请稍后重试。";
}
export function resultUncertain(error: unknown) {
  return (
    error instanceof ApiError &&
    (["NETWORK", "INVALID_RESPONSE", "UNSAFE_INTEGER"].includes(
      String(error.code),
    ) ||
      (error.status ?? 0) >= 500)
  );
}

export function unavailable(error: unknown) {
  return (
    error instanceof ApiError && [404, 405, 501].includes(error.status ?? 0)
  );
}
export function duplicateFoodId(error: unknown): number | undefined {
  if (
    !(error instanceof ApiError) ||
    String(error.code) !== "40016" ||
    !error.data ||
    typeof error.data !== "object" ||
    !("id" in error.data)
  )
    return;
  const id = error.data.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id
    : undefined;
}
