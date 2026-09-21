import { loadEnvFiles } from "./env";

// Side-effect import: runs before every other module body in the server,
// so process.env is populated before db.ts and auth.ts read it.
loadEnvFiles();
