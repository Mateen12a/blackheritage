import { loadEnvFiles } from "./env";

// Side-effect import: runs before every other module body in the server,
// so process.env is populated before db.ts and auth.ts read it.
loadEnvFiles();

// Email links, ICS files and payment callbacks read PUBLIC_APP_URL. Production
// .env files set BASE_URL instead, which left every ticket email linking to
// http://localhost:5000. One name wins here so the two cannot drift.
if (!process.env.PUBLIC_APP_URL && process.env.BASE_URL) {
  process.env.PUBLIC_APP_URL = process.env.BASE_URL.replace(/\/+$/, "");
}
