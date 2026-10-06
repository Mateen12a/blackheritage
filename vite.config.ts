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

function launchExportPlugin() {
  return {
    name: "launch-export-plugin",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === "/api/export-launch-video" && req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => {
            const buf = Buffer.concat(chunks);
            const outPath = path.resolve(import.meta.dirname, "out", "blackheritage_launch_silent.mp4");
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, buf);
            console.log(`[Launch Video Plugin] Saved ${buf.length} bytes to ${outPath}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, size: buf.length, path: outPath }));
          });
          return;
        }
        if (req.url === "/api/export-launch-still" && req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            const cleanBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const outPath = path.resolve(import.meta.dirname, "out", "stills", body.filename);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, Buffer.from(cleanBase64, "base64"));
            console.log(`[Launch Still Plugin] Saved ${body.filename} (${cleanBase64.length} chars) to ${outPath}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, path: outPath }));
          });
          return;
        }
        if (req.url.startsWith("/film/")) {
          const sub = req.url.slice("/film/".length).split("?")[0];
          const fullPath = path.resolve(import.meta.dirname, "film", sub);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              ".json": "application/json",
              ".png": "image/png",
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".mp3": "audio/mpeg",
              ".wav": "audio/wav",
            };
            res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
            fs.createReadStream(fullPath).pipe(res);
            return;
          }
        }
        if (req.url.startsWith("/frames/")) {
          const sub = req.url.slice("/frames/".length).split("?")[0];
          const framePath = path.resolve(import.meta.dirname, "film/frames", sub);
          if (fs.existsSync(framePath) && fs.statSync(framePath).isFile()) {
            res.writeHead(200, { "Content-Type": "image/jpeg" });
            fs.createReadStream(framePath).pipe(res);
            return;
          }
        }
        if (req.url.startsWith("/screens/")) {
          const sub = req.url.slice("/screens/".length).split("?")[0];
          const screenPath = path.resolve(import.meta.dirname, "film/screens", sub);
          if (fs.existsSync(screenPath) && fs.statSync(screenPath).isFile()) {
            res.writeHead(200, { "Content-Type": "image/png" });
            fs.createReadStream(screenPath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

function excludeDevAssetsPlugin() {
  return {
    name: "exclude-dev-assets",
    closeBundle() {
      // Production Safety: Remove dev-only screen captures and film frames from dist
      const distScreens = path.resolve(import.meta.dirname, "client/dist/screens");
      if (fs.existsSync(distScreens)) {
        fs.rmSync(distScreens, { recursive: true, force: true });
        console.log("[Build Safety] Purged dev-only client/dist/screens from production bundle");
      }
      const distFilm = path.resolve(import.meta.dirname, "client/dist/film");
      if (fs.existsSync(distFilm)) {
        fs.rmSync(distFilm, { recursive: true, force: true });
        console.log("[Build Safety] Purged dev-only client/dist/film from production bundle");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), launchExportPlugin(), excludeDevAssetsPlugin()],
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
      process.env.NODE_ENV === "production"
        ? (process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY)
        : (process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_TEST_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY),
    ),
    "import.meta.env.VITE_PAYSTACK_PUBLIC_KEY": JSON.stringify(
      process.env.NODE_ENV === "production"
        ? (process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY)
        : (process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_TEST_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY),
    ),
  },
});
