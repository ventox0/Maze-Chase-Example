export const fail = (status, code) =>
  Object.assign(new Error(code), { status, code });
export function sameOrigin(req) {
  if (!req.headers.origin) return true;
  const origin = process.env.PUBLIC_ORIGIN;
  if (origin) return req.headers.origin === new URL(origin).origin;
  return ["http://", "https://"].some(
    (protocol) => req.headers.origin === protocol + req.headers.host,
  );
}
export async function jsonBody(req, limit = 1048576) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    throw fail(415, "badRequest");
  const parts = [];
  let bytes = 0;
  for await (const part of req) {
    bytes += part.length;
    if (bytes > limit) throw fail(413, "badRequest");
    parts.push(part);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") throw 0;
    return value;
  } catch {
    throw fail(400, "badRequest");
  }
}
export function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
export function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim().split("="))
      .filter((a) => a.length === 2),
  );
}
import { isIP } from "node:net";

export function requestAddress(req) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    if (isIP(forwarded)) return forwarded;
  }
  return req.socket.remoteAddress;
}
