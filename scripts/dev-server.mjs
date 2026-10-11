import { createServer } from "node:http";
import { LanService, lanUrls } from "../server/LanService.js";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, basename, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Oyun derleme gerektirmez; bu sunucu ESM ve görselleri HTTP ile sunar.
export function createDevServer(root = PROJECT_ROOT, { lan = false } = {}) {
  const projectRoot = resolve(root);
  let lanService;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (lanService && (await lanService.handle(req, res, url))) return;
    if (url.pathname === "/api/lan/info" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ enabled: false, urls: [], maxPlayers: 4 }));
      return;
    }
    const sendError = (status, message) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : message);
    };
    if (!["GET", "HEAD"].includes(req.method)) {
      res.setHeader("Allow", "GET, HEAD");
      sendError(405, "Method not allowed");
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      sendError(400, "Invalid URL");
      return;
    }
    // Önceki klasörlü adres de aynı origin üzerinden çalışır.
    const legacyPrefix = `/${basename(projectRoot)}/`;
    if (pathname.startsWith(legacyPrefix))
      pathname = pathname.slice(legacyPrefix.length - 1);
    if (pathname.split("/").some((part) => part.startsWith("."))) {
      sendError(403, "Forbidden");
      return;
    }
    let filename = resolve(projectRoot, `.${pathname}`);
    const inside = relative(projectRoot, filename);
    if (inside === ".." || inside.startsWith(`..${sep}`)) {
      sendError(403, "Forbidden");
      return;
    }
    try {
      if ((await stat(filename)).isDirectory())
        filename = resolve(filename, "index.html");
      const body = await readFile(filename);
      res.writeHead(200, {
        "Content-Type": MIME[extname(filename)] || "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      sendError(
        error.code === "ENOENT" || error.code === "ENOTDIR" ? 404 : 500,
        "File unavailable",
      );
    }
  });
  if (lan) lanService = new LanService(server);
  server.lanService = lanService;
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 8765);
  const lan = process.argv.includes("--lan");
  const server = createDevServer(PROJECT_ROOT, { lan });
  server.on("error", (error) => {
    console.error(`Sunucu başlatılamadı: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, lan ? "0.0.0.0" : "127.0.0.1", () => {
    console.log(
      `Maze Chaser hazır: http://127.0.0.1:${port}${lan ? "/lan.html" : ""}`,
    );
    if (lan)
      for (const url of lanUrls(port))
        console.log(`LAN katılım adresi: ${url}`);
  });
}
