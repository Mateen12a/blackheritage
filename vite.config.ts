import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: "client",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.VITE_PORT) || 5000,
    allowedHosts: true,
    proxy: (() => {
      // The API port is configurable so a dev machine with another service on
      // 3001 can still run this stack: start the backend with PORT=3005 and
      // the frontend with API_PORT=3005. Defaults to 3001 as before.
      const apiTarget = `http://localhost:${process.env.API_PORT || 3001}`;
      return {
        "/api": { target: apiTarget, changeOrigin: true },
        "/uploads": { target: apiTarget, changeOrigin: true },
      };
    })(),
  },
  define: {
    "process.env.VITE_PAYSTACK_PUBLIC_KEY": JSON.stringify(
      process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY,
    ),
    "import.meta.env.VITE_PAYSTACK_PUBLIC_KEY": JSON.stringify(
      process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY,
    ),
  },
});
