import { list, get, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { PREFIX, ID_RE, isAdmin, readJson, parseBody, loadApp, saveApp } from "../_lib.js";

const STATUSES = ["new", "shortlisted", "interview", "task", "rejected", "hired"];
const SCORE_KEYS = ["loom", "retention", "ecom", "ai", "builder", "bd"];
const SCORE2_KEYS = ["plan", "copy", "support", "partners", "builder"];
const PHASE2_DAYS = 5;

function cleanScores(input, keys) {
  const out = {};
  for (const k of keys) {
    const n = Number(input?.[k]);
    if (Number.isInteger(n) && n >= 1 && n <= 5) out[k] = n;
  }
  return out;
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Wrong password" });

  if (req.method === "GET") {
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const apps = [];
    for (let i = 0; i < blobs.length; i += 20) {
      const batch = await Promise.all(
        blobs.slice(i, i + 20).map(b => get(b.pathname, { access: "private", useCache: false }).then(readJson).catch(() => null))
      );
      apps.push(...batch.filter(Boolean));
    }
    apps.sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));
    return res.status(200).json({ applications: apps });
  }

  if (req.method === "PATCH") {
    const body = parseBody(req);
    const id = String(body.id || "");
    if (!ID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });

    const current = await loadApp(get, id);
    if (!current) return res.status(404).json({ error: "Not found" });

    if (body.action === "start_phase2") {
      const now = new Date();
      current.phase2 = {
        token: randomBytes(12).toString("hex"),
        sent_at: now.toISOString(),
        deadline: new Date(now.getTime() + PHASE2_DAYS * 864e5).toISOString(),
        submission: current.phase2?.submission || null
      };
      current.status = "task";
    }
    if (body.action === "rejection_sent") {
      current.status = "rejected";
      current.rejection_sent_at = new Date().toISOString();
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ error: "Invalid status" });
      current.status = body.status;
    }
    if (body.notes !== undefined) current.notes = String(body.notes).slice(0, 4000);
    if (body.scores !== undefined) current.scores = cleanScores(body.scores, SCORE_KEYS);
    if (body.scores2 !== undefined) current.scores2 = cleanScores(body.scores2, SCORE2_KEYS);
    current.updated_at = new Date().toISOString();

    await saveApp(put, current);
    return res.status(200).json({ ok: true, application: current });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
