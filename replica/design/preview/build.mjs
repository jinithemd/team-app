// Builds design-kit.html from template.html + tokens.css + team-theme.ts.
// Run: node replica/design/preview/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const design = join(here, "..");
const tokens = readFileSync(join(design, "tokens.css"), "utf8");
const ts = readFileSync(join(design, "team-theme.ts"), "utf8");
const js = stripTypeScriptTypes(ts, { mode: "strip" }).replace(/^export /gm, "");
const html = readFileSync(join(here, "template.html"), "utf8")
  .replace("/*@@TOKENS@@*/", () => tokens)
  .replace("/*@@TEAMTHEME@@*/", () => js);
writeFileSync(join(here, "design-kit.html"), html);
console.log("wrote design-kit.html", html.length, "bytes");
