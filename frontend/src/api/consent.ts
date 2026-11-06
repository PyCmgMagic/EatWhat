import type { Schema } from "./models";
export type ConsentPolicy = Schema["ConsentPolicyVOResponse"];
export function policyIdentity(policy?: ConsentPolicy) {
  return policy?.version?.trim() && policyDocumentUrl(policy)
    ? `${policy.version}|${policy.url}`
    : "";
}
export function policyDocumentUrl(policy?: ConsentPolicy, base = "/api") {
  const path = policy?.url;
  if (!path || path.startsWith("//") || /[\u0000-\u0020]/.test(path))
    return undefined;
  try {
    if (/^https:\/\//i.test(path)) return new URL(path).href;
    if (!path.startsWith("/")) return undefined;
    const origin = /^https?:\/\//i.test(base)
      ? new URL(base).origin
      : typeof location === "undefined"
        ? "http://localhost"
        : location.origin;
    return new URL(path, origin).href;
  } catch {
    return undefined;
  }
}
export function requirePolicyAcceptance(
  accepted: string,
  policy?: ConsentPolicy,
) {
  if (!policyIdentity(policy))
    throw new Error("政策尚未加载完成或正文不可用，请稍后重试。");
  if (!accepted) throw new Error("请先阅读并同意当前政策。");
  if (accepted !== policyIdentity(policy))
    throw new Error("政策版本已更新，请重新阅读并勾选同意。");
  return {
    crossBorderConsent: true,
    consentPolicyVersion: policy!.version!,
  } as const;
}
