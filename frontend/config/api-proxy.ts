import type { ProxyOptions } from "vite";

export function createApiProxy(target?: string): ProxyOptions | undefined {
  if (!target?.trim()) return undefined;
  const gateway = new URL(target.trim());
  const prefix = gateway.pathname.replace(/\/+$/, "");
  return {
    target: gateway.origin,
    changeOrigin: true,
    // Replace the local gateway prefix only; controller paths can contain /api.
    rewrite: (path) =>
      prefix ? prefix + path.replace(/^\/api(?=\/|\?|$)/, "") : path,
    configure: (proxy) => {
      proxy.on("proxyReq", (request) => {
        // This same-origin dev/preview proxy makes a server-to-server request.
        // Forwarding a browser Origin triggers the upstream's cross-site CORS rules.
        request.removeHeader("origin");
      });
    },
  };
}
