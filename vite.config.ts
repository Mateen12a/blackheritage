import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import tailwindcss from "@tailwindcss/vite";

try {
  const djSrc = "C:/Users/PC/.gemini/antigravity-ide/brain/9530cf44-7881-433e-8aaa-e59ac3ae28e6/dj_zoro_avatar_1791052639002.jpg";
  const djDest = path.resolve(import.meta.dirname, "client/public/dj-zoro.jpg");
  if (fs.existsSync(djSrc) && !fs.existsSync(djDest)) {
    fs.copyFileSync(djSrc, djDest);
  }
} catch (e) {}

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
