// Läuft bei jedem Deployment auf Vercel: ergänzt Koordinaten und schreibt public/restaurants.json.
// Adressen werden über swisstopo gesucht, im Ausland über OpenStreetMap (Nominatim).
import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile("data/restaurants.json", "utf8"));
const cache = JSON.parse(await readFile("data/geocache.json", "utf8").catch(() => "{}"));

async function swisstopo(addr) {
  const u = "https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&sr=4326&limit=1&searchText=" + encodeURIComponent(addr);
  const r = await fetch(u);
  if (!r.ok) throw new Error("swisstopo " + r.status);
  const a = (await r.json()).results?.[0]?.attrs;
  return a ? [+a.lat.toFixed(6), +a.lon.toFixed(6)] : null;
}
async function nominatim(addr) {
  await new Promise(r => setTimeout(r, 1100));   // höchstens 1 Anfrage pro Sekunde
  const u = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch,de,it,fr,at,li&q=" + encodeURIComponent(addr);
  const r = await fetch(u, { headers: { "User-Agent": "restauranz (vercel build)", "Accept-Language": "de" } });
  if (!r.ok) throw new Error("nominatim " + r.status);
  const j = await r.json();
  return j[0] ? [+(+j[0].lat).toFixed(6), +(+j[0].lon).toFixed(6)] : null;
}

let looked = 0, found = 0;
const todo = [...new Set(data.filter(d => d.adresse && !(d.adresse in cache)).map(d => d.adresse))];
for (let i = 0; i < todo.length; i += 6) {
  await Promise.all(todo.slice(i, i + 6).map(async addr => {
    try {
      let c = await swisstopo(addr);
      if (!c) c = await nominatim(addr);
      cache[addr] = c; looked++; if (c) found++;
    } catch (e) { console.warn("Nicht gefunden (Fehler):", addr, e.message); }
  }));
}
for (const d of data) {
  const c = d.adresse && cache[d.adresse];
  if (c) [d.lat, d.lon] = c;
}
await writeFile("public/restaurants.json", JSON.stringify({ stand: new Date().toISOString(), eintraege: data }));
await writeFile("data/geocache.json", JSON.stringify(cache, null, 1));
console.log(`${data.length} Einträge, ${data.filter(d => d.lat).length} mit Koordinaten (${looked} neu gesucht, ${found} gefunden).`);
