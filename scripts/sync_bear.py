"""Wandelt Bear-Suchergebnisse (JSON von Bear search_notes mit includeContent, Suche "#GASTRO") in data/restaurants.json um.
Übernommen werden alle Notizen mit #GASTRO und einem Regionen-Tag oder #SCHWEIZ, ausser Sammelartikel (#GASTRO/Sammlung). #Radar markiert Favoriten.
Aufruf: python3 scripts/sync_bear.py <bear-export.json> [weitere.json ...]
"""
import json, re, sys, unicodedata, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
anp = json.load(open(ROOT / "data/anpassungen.json"))
hidden, names = anp["ausgeblendet"], anp["namen"]
REGIONS = {"Zürich+", "Eglisau+", "Ticino+", "Grono", "Sottoceneri", "Sopraceneri", "Locarnese"}

def keyOf(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = re.sub(r"[̀-ͯ]", "", s)
    s = re.sub(r"^(rest\.?|restaurant)\s+", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)
def cleanMd(s):
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    return re.sub(r"[*_~`]+", "", s).replace("&amp;", "&")
ADDR = re.compile(r"([A-ZÄÖÜ][A-Za-zÄÖÜäöüéèàâç.'\- ]{1,40}?\s\d{1,4}[a-zA-Z]?)\s*,\s*(?:CH-)?(\d{4})\s+([A-ZÄÖÜ][a-zäöüéè]+(?:[ \-][A-ZÄÖÜ]?[a-zäöüéè.]+)?)")
ADDR_LINE = re.compile(r"^\s*📍\s*Adresse:\s*(.+?)\s*$", re.M)
def findAddress(raw):
    explicit = ADDR_LINE.findall(cleanMd(raw))
    if explicit: return explicit[-1].strip(), "bear"        # ausdrücklich gesetzte Adresse (letzte gilt)
    counts, last = {}, ""
    for m in ADDR.finditer(cleanMd(raw)):
        a = f"{m.group(1).strip()}, {m.group(2)} {m.group(3).strip()}"
        counts[a] = counts.get(a, 0) + 1; last = a
    best, n = last, 0
    for a, c in counts.items():
        if c > n: best, n = a, c
    return best, ("text" if best else "")
def excerpt(raw):
    for l in raw.split("\n")[1:]:
        t = re.sub(r"^[\s⠀]+", "", cleanMd(l)).strip()
        if not t or l.strip().startswith("#") or len(t) < 40 or ADDR_LINE.match(t): continue
        return t if len(t) <= 240 else re.sub(r"\s+\S*$", "", t[:237]) + " …"
    return ""
def website(raw):
    for m in re.finditer(r"\]\((https?://[^)\s]+)\)", raw):
        u = m.group(1)
        if not re.search(r"tamedia|click\.|mailto|google\.|instagram|facebook|nzz\.ch|tagesanzeiger|bear\.app|apple\.com|\.pdf$", u): return u
    return ""

notes = []
for f in sys.argv[1:]:
    d = json.load(open(f))
    notes += [r["note"] for r in d.get("resultsWithContent", [])]
out, seen = [], set()
for n in notes:
    md, raw = n["metadata"], n["content"]
    if md["id"] in seen: continue
    if "GASTRO/Sammlung" in md["tags"]: continue   # Sammelartikel, keine einzelnen Lokale
    if "GASTRO" not in md["tags"] or not (REGIONS & set(md["tags"]) or "SCHWEIZ" in md["tags"]): continue
    seen.add(md["id"])
    name = re.sub(r"^(Rest\.|Restaurant)\s+", "", cleanMd(md["title"]), flags=re.I).strip()
    k = keyOf(name)
    if k in hidden: continue
    addr, src = findAddress(raw)
    out.append(dict(id=md["id"], key=k, name=names.get(k, name), title=md["title"], adresse=addr, quelle=src,
                    tags=sorted(t for t in md["tags"] if t != "evernote"), radar="Radar" in md["tags"], notiz=excerpt(raw), web=website(raw),
                    geaendert=md["modified"][:10]))
out.sort(key=lambda x: x["name"].lower())
json.dump(out, open(ROOT / "data/restaurants.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(out)} Einträge, {sum(o['radar'] for o in out)} Radar, {sum(1 for o in out if not o['adresse'])} ohne Adresse, {sum(1 for o in out if o['quelle']=='bear')} mit 📍-Zeile")
