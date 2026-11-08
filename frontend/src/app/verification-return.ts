import { localDestination } from "./navigation";

export const verificationReturnKey = "eatwhat-verification-return-v1";
const lifetime = 30 * 60 * 1000;
export type VerificationReturn = {
  id: string;
  accountId: number;
  returnTo: string;
  expiresAt: number;
};
export type VerificationCallback = {
  result: "success" | "failure";
  code: string;
};

export function verificationDestination(value: unknown) {
  const path = localDestination(value);
  return path && !/^\/(?:auth|verify|home)(?:[/?#]|$)/.test(path)
    ? path
    : undefined;
}
export function readVerificationCallback(
  search: string,
): VerificationCallback | undefined {
  const params = new URLSearchParams(search),
    result = params.get("result");
  if (result !== "success" && result !== "failure") return;
  const code = params.get("code") ?? "";
  return { result, code: /^\d{1,8}$/.test(code) ? code : "" };
}

/** Bridge the server's fixed web redirect into our hash router before rendering. */
export function verificationCallbackUrl(address: string) {
  const url = new URL(address);
  if (
    !/^\/(?:home\/?|app\/auth\/callback\/?|auth\/callback\/?)$/.test(
      url.pathname,
    ) ||
    url.hash
  )
    return;
  const callback = readVerificationCallback(url.search);
  if (!callback) return;
  const query = new URLSearchParams({
    result: callback.result,
    code: callback.code,
  });
  const display = new URLSearchParams();
  for (const key of ["demo", "view"]) {
    const value = url.searchParams.get(key);
    if (value !== null) display.set(key, value);
  }
  url.pathname = "/";
  url.search = display.toString();
  url.hash = "/verify?" + query;
  return url.pathname + url.search + url.hash;
}

function read(
  storage: "localStorage" | "sessionStorage",
): VerificationReturn | undefined {
  try {
    const value = JSON.parse(
      window[storage].getItem(verificationReturnKey) ?? "null",
    );
    if (
      typeof value?.id === "string" &&
      Number.isSafeInteger(value.accountId) &&
      value.accountId > 0 &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > Date.now() &&
      value.expiresAt <= Date.now() + lifetime &&
      verificationDestination(value.returnTo)
    )
      return value;
  } catch {
    /* Private browsing/storage restrictions must not break authentication. */
  }
}

/** Store only navigation context, never school tokens or login credentials. */
export function rememberVerificationReturn(
  accountId: number | null | undefined,
  destination: string,
) {
  if (!accountId || !Number.isSafeInteger(accountId)) return;
  const value: VerificationReturn = {
    id: crypto.randomUUID(),
    accountId,
    returnTo: verificationDestination(destination) ?? "/settings/account",
    expiresAt: Date.now() + lifetime,
  };
  for (const storage of ["sessionStorage", "localStorage"] as const) {
    try {
      window[storage].setItem(verificationReturnKey, JSON.stringify(value));
    } catch {
      /* Optional recovery context. */
    }
  }
}

export function verificationReturn(accountId?: number | null) {
  const local = read("sessionStorage"),
    shared = read("localStorage");
  const intent = [local, shared].find((item) => item?.accountId === accountId);
  return {
    intent,
    accountChanged: !!accountId && !intent && !!(local || shared),
  };
}

/** A noopener callback tab can recover its origin without access to window.opener. */
export function claimVerificationReturn(intent: VerificationReturn) {
  try {
    window.sessionStorage.setItem(
      verificationReturnKey,
      JSON.stringify(intent),
    );
    if (read("localStorage")?.id === intent.id)
      window.localStorage.removeItem(verificationReturnKey);
  } catch {
    /* Keep the verified result usable without storage. */
  }
}

export function verificationFailureMessage(code: string) {
  return (
    (
      {
        "30012": "认证链接已过期或已使用，请重新获取学校认证入口。",
        "30013": "该学号已认证过其他账号，请使用原账号或联系管理员。",
        "30008": "邮箱认证链接已失效，请重新发送认证邮件。",
        "50003": "学校认证信息换取或校验失败，请重新发起认证。",
        "50001": "认证服务暂时不可用，请稍后重试。",
      } as Record<string, string>
    )[code] ?? "本次认证未完成，请重新发起认证；已有账号资料会保留。"
  );
}
