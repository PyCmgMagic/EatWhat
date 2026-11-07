export const UPLOAD_PROXY_PREFIX = "/__storage_upload";

/** Keep the signed path/query unchanged; only opt-in local development uses Vite. */
export function uploadRequestUrl(
  signedUrl: string,
  configured = import.meta.env.DEV_UPLOAD_TARGET,
) {
  const url = new URL(signedUrl);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("上传地址无效。");
  if (import.meta.env.DEV && configured) {
    const target = new URL(configured);
    const bucket = target.pathname.replace(/\/+$/, "") + "/";
    if (url.origin === target.origin && url.pathname.startsWith(bucket))
      return UPLOAD_PROXY_PREFIX + url.pathname + url.search;
  }
  return signedUrl;
}
