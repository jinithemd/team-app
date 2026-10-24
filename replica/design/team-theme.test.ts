// Run: node --experimental-strip-types --no-warnings team-theme.test.ts
import { deriveTeamTheme, teamThemeVars, contrast, BASE, type Mode } from "./team-theme.ts";

const tricky = {
  "pure white": "#FFFFFF",
  "pure black": "#000000",
  "lemon yellow": "#FFE600",
  "volt lime": "#B8F000",
  "cyan": "#00F5FF",
  "deep purple": "#2D0A3E",
  "gold": "#B8964A",
  "neon red": "#FF3D6B",
  "sky blue": "#5EB8FF",
  "navy": "#0B1F4B",
  "forest": "#1B5E20",
  "orange": "#FF7A00",
  "pink": "#FF8FD1",
  "mid grey": "#808080",
  "near-bg dark": "#10141A",
  "near-bg light": "#F7F7F7",
};

let fails = 0;
const check = (cond: boolean, msg: string) => { if (!cond) { fails++; console.log("  FAIL " + msg); } };

for (const mode of ["light", "dark"] as Mode[]) {
  const { bg, surface } = BASE[mode];
  console.log(`\n${mode}`);
  for (const [name, hex] of Object.entries(tricky)) {
    const t = deriveTeamTheme(hex, mode);
    const r = {
      label: contrast(t.onTeam, t.team),
      inkBg: contrast(t.teamInk, bg),
      inkSurface: contrast(t.teamInk, surface),
      inkSoft: contrast(t.teamInk, t.teamSoft),
      band: contrast(t.team, bg),
      bodyOnSoft: contrast(BASE[mode].fg, t.teamSoft),
    };
    check(r.bodyOnSoft >= 4.5, `${mode} ${name}: body text on soft ${r.bodyOnSoft.toFixed(2)}`);
    console.log(
      `  ${name.padEnd(14)} ${hex} -> team ${t.team} on ${t.onTeam} (${r.label.toFixed(2)})  ink ${t.teamInk} (${r.inkBg.toFixed(2)})  soft ${t.teamSoft}  band ${r.band.toFixed(2)}`,
    );
    check(r.label >= 4.5, `${mode} ${name}: label ${r.label.toFixed(2)}`);
    check(r.inkBg >= 4.5, `${mode} ${name}: ink on bg ${r.inkBg.toFixed(2)}`);
    check(r.inkSurface >= 4.5, `${mode} ${name}: ink on surface ${r.inkSurface.toFixed(2)}`);
    check(r.inkSoft >= 4.5, `${mode} ${name}: ink on soft ${r.inkSoft.toFixed(2)}`);
    check(r.band >= 1.3, `${mode} ${name}: band ${r.band.toFixed(2)}`);
  }
}

// A colour that already passes should not be changed.
const navy = deriveTeamTheme("#0B1F4B", "light");
check(navy.team === "#0B1F4B" && navy.teamInk === "#0B1F4B", "navy should be untouched in light mode");

// Secondary colour comes through.
const v = teamThemeVars("#2D0A3E", "#B8964A", "light");
check(!!v["--team-2"] && contrast(v["--on-team-2"]!, v["--team-2"]!) >= 4.5, "secondary colour label passes");

// Bad input is rejected.
let threw = false;
try { deriveTeamTheme("purple", "light"); } catch { threw = true; }
check(threw, "non-hex input should throw");

console.log(fails ? `\n${fails} failing` : "\nall team colours pass AA in light and dark");
process.exit(fails ? 1 : 0);
