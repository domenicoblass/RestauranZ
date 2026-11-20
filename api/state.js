// Gemeinsamer Stand der App für alle Geräte: übernommene Adressen und ausgeblendete Einträge.
// Geschützt durch die Anmeldung in middleware.js, wie die ganze Seite.
import { KEYS, ready, redis, readAll, json } from "./_redis.js";
export const config = { runtime: "edge" };

const ID = /^[0-9A-F-]{36}$/i;

export default async function handler(req) {
  if (!ready()) return json({ error: "Kein Speicher verbunden" }, 503);
  try {
    if (req.method === "GET") return json(await readAll());
    if (req.method === "POST") {
      // { art: "adressen" | "ausblenden", id, wert } setzt einen Eintrag, { art, ids: [...], loeschen: true } entfernt Einträge
      const b = await req.json().catch(() => ({}));
      const key = KEYS[b.art];
      if (!key) return json({ error: "Ungültige Anfrage" }, 400);
      if (b.loeschen) {
        const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).filter(x => typeof x === "string" && ID.test(x));
        const n = ids.length ? await redis("HDEL", key, ...ids) : 0;
        return json({ ok: true, geloescht: n });
      }
      if (typeof b.id !== "string" || !ID.test(b.id) || !b.wert || typeof b.wert !== "object") return json({ error: "Ungültige Anfrage" }, 400);
      await redis("HSET", key, b.id, JSON.stringify(b.wert));
      return json({ ok: true });
    }
    return json({ error: "Methode nicht erlaubt" }, 405);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
