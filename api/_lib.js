import { timingSafeEqual } from "node:crypto";

export const PREFIX = "applications/";

export function isAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const header = req.headers.authorization || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readJson(result) {
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export const ID_RE = /^[0-9]+-[0-9a-f]{8}$/;

export function safeEqual(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseBody(req) {
  if (typeof req.body !== "string") return req.body || {};
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

export async function loadApp(get, id) {
  return readJson(await get(`${PREFIX}${id}.json`, { access: "private", useCache: false }));
}

export async function saveApp(put, app) {
  await put(`${PREFIX}${app.id}.json`, JSON.stringify(app), {
    access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true
  });
}
