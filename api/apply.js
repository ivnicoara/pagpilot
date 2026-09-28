import { put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { PREFIX } from "./_lib.js";

const CODE_WORD = "COMEBACK";
const FIELDS = {
  name: 120, email: 200, location: 160, linkedin: 300, start: 60,
  loom: 400, saas_years: 30, winback: 1500, built: 1500, partners: 1000,
  expected_salary: 100, codeword: 60, extra: 1000,
  ai_level: 60, ai_other: 200, ai_usage: 1500
};
const REQUIRED = ["name", "email", "location", "linkedin", "start", "loom", "saas_years", "ai_level", "ai_usage", "winback", "built", "expected_salary", "codeword"];

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (body.company_site) return res.status(200).json({ ok: true }); // honeypot

  const app = {};
  for (const [k, max] of Object.entries(FIELDS)) app[k] = clean(body[k], max);
  app.ecom = (Array.isArray(body.ecom) ? body.ecom : body.ecom ? [body.ecom] : []).slice(0, 8).map(v => clean(v, 60));
  app.ai_tools = (Array.isArray(body.ai_tools) ? body.ai_tools : body.ai_tools ? [body.ai_tools] : []).slice(0, 12).map(v => clean(v, 60));

  const missing = REQUIRED.filter(k => !app[k]);
  if (missing.length) return res.status(400).json({ error: "Missing fields", missing });
  if (!/^\S+@\S+\.\S+$/.test(app.email)) return res.status(400).json({ error: "Invalid email" });

  const now = new Date();
  const id = `${now.getTime()}-${randomBytes(4).toString("hex")}`;
  const record = {
    id,
    role: "Business Development Manager",
    ...app,
    codeword_correct: app.codeword.toUpperCase() === CODE_WORD,
    loom_is_loom: /loom\.com/i.test(app.loom),
    status: "new",
    notes: "",
    submitted_at: now.toISOString(),
    user_agent: clean(req.headers["user-agent"], 300)
  };

  await put(`${PREFIX}${id}.json`, JSON.stringify(record), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false
  });

  return res.status(200).json({ ok: true, id });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
