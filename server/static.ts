import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/** Mount after API and social-preview routes so those keep their responses. */
export function serveFrontend(
  app: Express,
  directory = path.resolve(process.cwd(), "client", "dist"),
) {
  const index = path.join(directory, "index.html");
  if (!fs.existsSync(index)) {
    throw new Error("SERVE_FRONTEND=true requires client/dist/index.html. Run npm run build before starting.");
  }

  app.use(express.static(directory, { index: false, dotfiles: "ignore" }));
  app.get("*", (req, res, next) => {
    // Missing API endpoints and files must return 404, never the SPA shell.
    if (
      /^\/(api|uploads|assets)(\/|$)/.test(req.path) ||
      path.extname(req.path) ||
      !req.accepts("html")
    ) return next();

    res.set("Cache-Control", "no-cache");
    res.sendFile(index);
  });
}
