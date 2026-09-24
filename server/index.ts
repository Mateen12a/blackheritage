import express, { type Request, Response, NextFunction } from "express";
import "./env-load";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { connectDB } from "./db";
import { setupAuth } from "./auth";
import { setupGoogleAuth } from "./google-auth";
import https from "https";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

// Update CORS to allow requests from your frontend domains
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "https://black-heritage-events.vercel.app",
  "https://blackheritage.onrender.com",
  "https://blackhevents.com"
].filter(Boolean) as string[];

// Custom organizer domains (WHITE-LABEL.md stage 4) serve the same app from
// their own origin. Any origin whose host ends in a suffix listed here is
// trusted; add your root domain (e.g. blackheritage.africa) once live.
const TRUSTED_ORIGIN_SUFFIXES = [
  process.env.TRUSTED_ORIGIN_SUFFIX, // e.g. blackheritage.africa
  "vercel.app",
  "onrender.com",
].filter(Boolean) as string[];

function originAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return TRUSTED_ORIGIN_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin requests (curl, server-to-server) carry no Origin header.
    if (!origin) return callback(null, true);
    if (originAllowed(origin)) {
      callback(null, true);
    } else {
      // Browsers with credentials require an exact allowlisted match. A
      // wildcard here would let any website fire credentialed requests.
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

// Pre-define health check before routes
app.get("/api/health", (_req, res) => {
  res.status(200).send("OK");
});

// Referral share links: /r/CODE forwards into the SPA, which stashes the
// code and opens the register tab. A plain 302 keeps the link readable
// everywhere (WhatsApp, Instagram bios, QR codes).
app.get("/r/:code", (req, res) => {
  const code = String(req.params.code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
  if (!code) return res.redirect("/auth");
  res.redirect(`/auth?tab=register&ref=${encodeURIComponent(code)}`);
});

// Self-ping mechanism to keep Render instance awake
const BACKEND_URL = process.env.VITE_API_URL || process.env.BACKEND_URL;
if (BACKEND_URL) {
  setInterval(() => {
    https.get(BACKEND_URL, (res) => {
      log(`Self-ping to ${BACKEND_URL}: status ${res.statusCode}`);
    }).on('error', (err) => {
      log(`Self-ping error: ${err.message}`);
    });
  }, 10 * 60 * 1000); // Ping every 10 minutes
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Paystack's webhook must arrive as raw bytes for signature verification,
// so the global JSON parser skips that one path.
app.use((req, res, next) => {
  if (req.path === "/api/paystack/webhook") return next();
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })(req, res, next);
});

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const dbReady = await connectDB();
  if (!dbReady && process.env.NODE_ENV === "production") {
    console.error("Cannot start production without MongoDB. Set MONGODB_URI and restart.");
    process.exit(1);
  }
  setupAuth(app);
  setupGoogleAuth(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || "3001", 10);
  const listenOptions: any = {
    port,
    host: "0.0.0.0",
  };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }
  httpServer.listen(
    listenOptions,
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
