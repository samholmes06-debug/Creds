// A small TEST server showing what the consent and usage endpoints must do. Not for production.
// On Azure the same three jobs are done by Functions (or App Service) behind your login: the login provides the user's identity,
// and the records go to a table or database instead of a file.
//
//   node examples/consent-server.mjs <site-folder> [port]
//
// GET  /api/consent   -> 200 {version, analytics} if this user has agreed, else 204
// POST /api/consent   -> saves {version, required, analytics}, stamped with the SERVER's idea of the user and the time
// POST /api/events    -> saves a usage event, only if the user's saved consent allows analytics
// /assets/pdfs/*      -> refused (403) until the user has a consent record, so the gate cannot be skipped by typing the address
// Every PDF request is written to the log with its ?via= marker.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = path.resolve(process.argv[2] || "."), port = +process.argv[3] || 8080;
const types = { ".html": "text/html", ".js": "text/javascript", ".pdf": "application/pdf", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff": "font/woff" };
const consents = new Map(), log = [];
// In production the identity comes from your login (on Azure: the signed-in user's id header). Here a header stands in for it.
const userOf = q => String(q.headers["x-user"] || "test-user");
const body = q => new Promise(r => { let d = ""; q.on("data", c => d += c); q.on("end", () => { try { r(JSON.parse(d || "{}")); } catch (e) { r({}); } }); });
const srv = http.createServer(async (q, r) => {
  const u = new URL(q.url, "http://x"), user = userOf(q);
  const send = (code, obj) => { r.statusCode = code; if (obj) { r.setHeader("content-type", "application/json"); r.end(JSON.stringify(obj)); } else r.end(); };
  if (u.pathname === "/api/consent") {
    if (q.method === "GET") { const c = consents.get(user); return c ? send(200, c) : send(204); }
    if (q.method === "POST") { const b = await body(q); if (!b.required || !b.version) return send(400, { error: "required tick and version needed" }); const rec = { user, version: b.version, analytics: !!b.analytics, savedAt: new Date().toISOString() }; consents.set(user, rec); log.push({ type: "consent", ...rec }); return send(200, rec); }
  }
  if (u.pathname === "/api/events" && q.method === "POST") { const b = await body(q), c = consents.get(user); if (!c || !c.analytics) return send(204); log.push({ type: "event", user, ...b }); return send(204); }
  if (u.pathname === "/api/log") return send(200, log);
  if (u.pathname.startsWith("/assets/pdfs/")) { log.push({ type: "pdf", user, path: u.pathname, via: u.searchParams.get("via") || "", at: new Date().toISOString() }); if (!consents.has(user)) return send(403, { error: "consent needed" }); }
  const f = path.join(root, u.pathname === "/" ? "index.html" : u.pathname);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404);
  r.setHeader("content-type", types[path.extname(f)] || "application/octet-stream"); fs.createReadStream(f).pipe(r);
});
srv.listen(port, () => console.log(`Test server for ${root} on http://localhost:${port}  (log at /api/log)`));
export { srv };
