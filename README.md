# RestauranZ

Restaurant-Karte aus Bear-Notizen (Tags #GASTRO #SCHWEIZ #Radar). Statische Seite auf Vercel mit Passwortschutz.

- `data/restaurants.json`: Einträge aus Bear. Wird von Claude per `scripts/sync_bear.py` aus Bear erzeugt.
- `data/anpassungen.json`: aus dem alten Guide übernommene ausgeblendete Einträge und umbenannte Namen.
- `scripts/build.mjs`: läuft bei jedem Deployment, ergänzt Koordinaten (swisstopo, sonst OpenStreetMap) und schreibt `public/restaurants.json`.
- `middleware.js`: Login. Passwort in der Vercel-Umgebungsvariable `RESTAURANZ_PASSWORD`.

Adressen: In Bear eine Zeile `📍 Adresse: Strasse Nr, PLZ Ort` hat Vorrang vor Adressen im Notiztext. Die App schreibt diese Zeile über den Knopf «In Bear speichern» selbst in die Notiz.
