// Stands in for Resend's API locally: accepts POST /emails and appends each to a file.
import http from "node:http";
import fs from "node:fs";
const out = process.argv[2];
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method !== "POST" || req.url !== "/emails" || req.headers.authorization !== "Bearer test-resend-key") {
      res.writeHead(401); return res.end('{"message":"bad key"}');
    }
    fs.appendFileSync(out, body.replace(/\n/g, " ") + "\n");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: `mock-${Date.now()}` }));
  });
}).listen(4010, () => console.log("resend mock on :4010"));
