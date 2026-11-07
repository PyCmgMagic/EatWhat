import type { ProxyOptions } from "vite";
import { UPLOAD_PROXY_PREFIX } from "../src/api/upload-target.ts";

export function createUploadProxy(
  configured?: string,
): ProxyOptions | undefined {
  if (!configured?.trim()) return undefined;
  const target = new URL(configured.trim());
  if (
    target.protocol !== "https:" ||
    !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(target.hostname) ||
    target.port ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    !/^\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\/?$/.test(target.pathname)
  )
    throw new Error(
      "UPLOAD_PROXY_TARGET 必须是 R2 的 HTTPS 存储桶地址，不含密钥或签名参数。",
    );
  const bucket = target.pathname.replace(/\/+$/, "") + "/";
  return {
    target: target.origin,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    proxyTimeout: 60_000,
    timeout: 65_000,
    bypass: (request) => {
      // A fixed bucket, signed PUTs only. This endpoint cannot proxy arbitrary URLs.
      if (request.method !== "PUT") return false;
      try {
        const url = new URL(request.url!, "http://local.invalid");
        if (!url.pathname.startsWith(UPLOAD_PROXY_PREFIX + bucket))
          return false;
        if (
          url.searchParams.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" ||
          !/^[a-f0-9]{64}$/i.test(url.searchParams.get("X-Amz-Signature") ?? "")
        )
          return false;
        // Browser requests must come from this dev server; scripts may omit Origin.
        if (
          request.headers.origin &&
          new URL(request.headers.origin).host !== request.headers.host
        )
          return false;
      } catch {
        return false;
      }
    },
    rewrite: (path) => path.slice(UPLOAD_PROXY_PREFIX.length),
    configure: (proxy) => {
      proxy.on("proxyReq", (request) => {
        // Allowlist headers: even custom tokenName headers and cookies stay local.
        for (const header of request.getHeaderNames())
          if (
            ![
              "host",
              "content-type",
              "content-length",
              "transfer-encoding",
            ].includes(header.toLowerCase())
          )
            request.removeHeader(header);
      });
      proxy.on("proxyRes", (response) => {
        delete response.headers["set-cookie"];
      });
    },
  };
}
