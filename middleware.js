// Passwortschutz für die ganze Seite (inkl. Daten), wie bei UnterweX.
// Das Passwort steht in der Vercel-Umgebungsvariable RESTAURANZ_PASSWORD.
// Nach der Anmeldung merkt sich jedes Gerät ein Jahr lang ein Cookie; ändert sich das Passwort, werden alle Geräte abgemeldet.

export const config = { matcher: '/:path*' };

const COOKIE = 'restauranz';
const YEAR = 365 * 24 * 3600;
// Ohne Anmeldung erreichbar, damit Login-Seite und Home-Bildschirm-Icon funktionieren.
const PUBLIC = /^\/(favicon\.ico|favicon-(32|96)\.png|apple-touch-icon\.png|icon-(192|512)\.png|manifest\.webmanifest)$/;

async function token(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('restauranz-login-v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function cookieValue(request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)restauranz=([0-9a-f]+)/);
  return m ? m[1] : null;
}
function loginPage(error = '') {
  const html = `<!doctype html><html lang="de-CH"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>RestauranZ – Anmelden</title>
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="RestauranZ">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Source+Sans+3:wght@400;600&display=swap">
<style>
:root{--paper:#f3f5f8;--card:#fff;--ink:#16202c;--muted:#5b6878;--line:#d9dfe7;--accent:#0b5cad;--err:#b4532a}
@media (prefers-color-scheme:dark){:root{--paper:#0f151c;--card:#17202a;--ink:#e6ebf1;--muted:#9aa7b6;--line:#2a3644;--accent:#5aa6f0;--err:#e08a62}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font:16px/1.45 "Source Sans 3",system-ui,sans-serif}
form{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:28px 24px;width:min(340px,calc(100vw - 32px));box-sizing:border-box;display:grid;gap:14px}
h1{margin:0;display:flex;gap:12px;align-items:center;font:700 2rem/1 "Barlow Condensed","Arial Narrow",sans-serif}h1 img{width:44px;height:44px;border-radius:10px}
label{display:grid;gap:6px;font-size:.85rem;color:var(--muted)}
input{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink)}
button{font:inherit;font-weight:600;padding:10px;border:0;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer}
.err{color:var(--err);margin:0;font-size:.9rem}
</style></head><body>
<form method="post" action="/login">
<h1><img src="/apple-touch-icon.png" alt="">RestauranZ</h1>
<label>Passwort<input type="password" name="password" autocomplete="current-password" autofocus required></label>
${error ? `<p class="err">${error}</p>` : ''}
<button type="submit">Anmelden</button>
</form></body></html>`;
  return new Response(html, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async function middleware(request) {
  const expected = process.env.RESTAURANZ_PASSWORD;
  if (!expected) return new Response('RESTAURANZ_PASSWORD ist in Vercel nicht gesetzt.', { status: 503 });
  const url = new URL(request.url);
  if (PUBLIC.test(url.pathname)) return; // weiter

  const valid = await token(expected);

  if (url.pathname === '/logout') {
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (url.pathname === '/login' && request.method === 'POST') {
    const form = await request.formData();
    if ((await token(String(form.get('password') || ''))) !== valid) return loginPage('Das Passwort stimmt nicht.');
    return new Response(null, {
      status: 303,
      headers: { location: '/', 'set-cookie': `${COOKIE}=${valid}; Path=/; Max-Age=${YEAR}; HttpOnly; Secure; SameSite=Lax` },
    });
  }
  if (cookieValue(request) === valid) {
    if (url.pathname === '/login') return Response.redirect(new URL('/', url), 303);
    return; // angemeldet: weiter
  }
  const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
  return wantsHtml ? loginPage() : new Response('Anmeldung erforderlich', { status: 401 });
}
