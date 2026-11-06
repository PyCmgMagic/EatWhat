import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApiProxy } from "./config/api-proxy.ts";
import { prototypeData } from "./config/prototype-data.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxy = createApiProxy(env.API_PROXY_TARGET);
  const proxy = apiProxy ? { "/api": apiProxy } : undefined;
  return {
    plugins: [react(), prototypeData()],
    server: { proxy },
    preview: { proxy },
    build: {
      sourcemap: false,
      manifest: true,
      emptyOutDir: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              },
            ],
          },
        },
      },
    },
    test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
  };
});
