// Keep the short-lived proof in memory; it is never a login session.
let proof: string | undefined;
let returnTo = "/auth/password";
export function setConsentProof(
  value: string | undefined,
  target = "/auth/password",
) {
  proof = value;
  returnTo =
    target.startsWith("/auth/") && !target.includes("\\")
      ? target
      : "/auth/password";
}
export function getConsentProof() {
  return proof;
}
export function getConsentReturnTo() {
  return returnTo;
}
export function clearConsentProof() {
  proof = undefined;
}
