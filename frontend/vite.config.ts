import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApiProxy } from "./config/api-proxy.ts";
import { createUploadProxy } from "./config/upload-proxy.ts";
import { UPLOAD_PROXY_PREFIX } from "./src/api/upload-target.ts";
import { prototypeData } from "./config/prototype-data.ts";

export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxy = createApiProxy(env.API_PROXY_TARGET);
  const proxy = apiProxy ? { "/api": apiProxy } : undefined;
  const uploadTarget =
    command === "serve" && !isPreview && mode !== "test"
      ? env.UPLOAD_PROXY_TARGET?.trim() || ""
      : "";
  const uploadProxy = createUploadProxy(uploadTarget);
  return {
    plugins: [react(), prototypeData()],
    define: {
      "import.meta.env.DEV_UPLOAD_TARGET": JSON.stringify(uploadTarget),
    },
    server: {
      proxy: {
        ...proxy,
        ...(uploadProxy ? { [UPLOAD_PROXY_PREFIX]: uploadProxy } : {}),
      },
    },
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
    test: {
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}"],
      // CI exports the production API base for the build; tests assert on the
      // default relative /api paths and must not depend on it.
      env: { VITE_API_BASE_URL: "" },
    },
  };
});
