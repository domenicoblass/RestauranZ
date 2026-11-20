// Gemeinsamer Speicher (Upstash Redis über die Vercel-Integration), ohne Abhängigkeiten über die REST-API.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const KEYS = { adressen: "restauranz:adressen", ausblenden: "restauranz:ausblenden" };
export const ready = () => Boolean(URL_ && TOKEN);

export async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "redis " + r.status);
  return j.result;
}

export async function readAll() {
  const out = {};
  for (const [name, key] of Object.entries(KEYS)) {
    const flat = (await redis("HGETALL", key)) || [];
    out[name] = {};
    for (let i = 0; i < flat.length; i += 2) {
      try { out[name][flat[i]] = JSON.parse(flat[i + 1]); } catch {}
    }
  }
  return out;
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
