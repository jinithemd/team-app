// Prints a long-lived local API key (HS256 JWT) for a role: anon or service_role.
import { createHmac } from "node:crypto";
const [secret, role] = process.argv.slice(2);
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const body = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "supabase", role, iat: 1700000000, exp: 2100000000 })}`;
console.log(`${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`);
