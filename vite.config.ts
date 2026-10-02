import { defineConfig, loadEnv } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

const DEV_HOST = "127.0.0.1";
const DEV_PORT = 5173;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: DEV_HOST,
      port: DEV_PORT,
      strictPort: true,
      open: `http://${DEV_HOST}:${DEV_PORT}`,
      hmr: {
        protocol: "ws",
        host: DEV_HOST,
        port: DEV_PORT,
        clientPort: DEV_PORT,
        path: "/vite-hmr",
      },
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: apiProxyTarget.startsWith("https://"),
          configure: (proxy) => {
            proxy.on("error", (err, _req, res) => {
              console.error("[vite] proxy /api error:", err.message);
              if (res && !res.headersSent && "writeHead" in res) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                  error: "API inacessível. O npm run dev precisa manter o PHP em http://127.0.0.1:8000",
                }));
              }
            });
          },
        },
      },
    },
    preview: {
      host: DEV_HOST,
      port: 4173,
      strictPort: true,
    },
  };
});
