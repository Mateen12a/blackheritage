import fs from "fs";
import path from "path";

// Load .env before anything reads process.env. Must be the first import in
// server/index.ts. Existing environment variables always win, so a process
// manager (Render, PM2) can still override file values.
export function loadEnvFiles(): void {
  for (const name of [".env.local", ".env"]) {
    const full = path.resolve(process.cwd(), name);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}
