import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: env.API_PROXY_TARGET
        ? {
            "/api": { target: env.API_PROXY_TARGET, changeOrigin: true },
          }
        : undefined,
    },
    build: { sourcemap: false },
    test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
