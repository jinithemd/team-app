// One URL like a Supabase project: /auth/v1 -> Auth, /rest/v1 -> PostgREST.
import http from "node:http";
// Auth's emails link to /verify on this host (hosted Supabase puts that under /auth/v1).
const routes = [["/auth/v1", 9999], ["/rest/v1", 3001], ["/verify", 9999, true]];
http.createServer((req, res) => {
  const hit = routes.find(([p]) => req.url.startsWith(p));
  if (!hit) { res.writeHead(404); return res.end("no route"); }
  const path = hit[2] ? req.url : req.url.slice(hit[0].length) || "/";
  const up = http.request({ host: "127.0.0.1", port: hit[1], path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${hit[1]}` } }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, () => console.log("gateway on :54321"));
