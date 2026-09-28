import { get, put } from "@vercel/blob";
import { ID_RE, safeEqual, parseBody, loadApp, saveApp } from "./_lib.js";

const FIELDS = {
  plan_link: 500, loom: 500, segments: 3000, messages: 5000, measure: 1500,
  support: 3000, review_ask: 1500, partners: 3000, builder_link: 500, builder_note: 1500,
  hours: 20, feedback: 1000
};
const REQUIRED = ["loom", "segments", "messages", "measure", "support", "review_ask", "partners", "builder_link", "hours"];
const clean = (v, max) => String(v ?? "").trim().slice(0, max);

async function authorize(q) {
  const id = String(q.a || "");
  if (!ID_RE.test(id)) return null;
  const app = await loadApp(get, id);
  if (!app?.phase2 || !safeEqual(q.t, app.phase2.token)) return null;
  return app;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const app = await authorize(req.query || {});
    if (!app) return res.status(404).json({ error: "This link is not valid." });
    return res.status(200).json({
      first_name: String(app.name || "").split(" ")[0],
      deadline: app.phase2.deadline,
      submitted_at: app.phase2.submission?.submitted_at || null,
      submission: app.phase2.submission || null
    });
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const app = await authorize(body);
    if (!app) return res.status(404).json({ error: "This link is not valid." });

    const sub = {};
    for (const [k, max] of Object.entries(FIELDS)) sub[k] = clean(body[k], max);
    const missing = REQUIRED.filter(k => !sub[k]);
    if (missing.length) return res.status(400).json({ error: "Missing fields", missing });

    const now = new Date();
    sub.submitted_at = now.toISOString();
    sub.late = now > new Date(app.phase2.deadline);
    sub.version = (app.phase2.submission?.version || 0) + 1;
    app.phase2.submission = sub;
    app.updated_at = sub.submitted_at;
    await saveApp(put, app);
    return res.status(200).json({ ok: true, submitted_at: sub.submitted_at });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
