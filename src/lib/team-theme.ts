/**
 * Team colour theming.
 *
 * A coach can pick any colour for their team (bright yellow, white, black...).
 * This turns that raw pick into colours that always pass WCAG AA in both
 * light and dark mode, and returns them as CSS custom properties to set on the
 * team's screens:
 *
 *   --team         solid fill: team header band, primary buttons, selected chips
 *   --on-team      text/icons on --team (black-ish or white, whichever reads better)
 *   --team-ink     the team colour as text/icons/links on the page background
 *   --team-soft    tinted background: selected rows, today in the calendar, unread chat
 *   --team-2 / --on-team-2   the same for the optional secondary colour
 *
 * Rules:
 *   - on-team vs team         >= 4.5 (button labels are normal text)
 *   - team-ink vs bg, surface >= 4.5 (links, active tab labels)
 *   - team-ink vs team-soft   >= 4.5
 *   - team vs bg              >= 1.3 so a white team on a white page, or a black
 *                                    team in dark mode, still shows as a band
 * The hue and saturation are kept; only lightness moves, as little as needed.
 * Status colours (going / not going / cancelled / live) never use team colours.
 */

export type Mode = "light" | "dark";

export interface TeamTheme {
  team: string;
  onTeam: string;
  teamInk: string;
  teamSoft: string;
}

export interface TeamThemeVars {
  "--team": string;
  "--on-team": string;
  "--team-ink": string;
  "--team-soft": string;
  "--team-2"?: string;
  "--on-team-2"?: string;
}

// Must match tokens.json.
export const BASE = {
  // text/white: the two label colours tried on a team fill. fg: the page's body text colour.
  light: { bg: "#FFFFFF", surface: "#F5F6F8", fg: "#12151A", text: "#12151A", white: "#FFFFFF" },
  dark: { bg: "#0E1116", surface: "#161A21", fg: "#F2F4F7", text: "#12151A", white: "#FFFFFF" },
} as const;

const AA = 4.5;
const BAND = 1.3;

// ---------- colour maths ----------

type RGB = [number, number, number];
type HSL = [number, number, number];

export function parseHex(hex: string): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function toHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function rgbToHsl([r, g, b]: RGB): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: HSL): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function withLightness(hex: string, l: number): string {
  const [h, s] = rgbToHsl(parseHex(hex));
  return toHex(hslToRgb([h, s, Math.min(1, Math.max(0, l))]));
}

function lightnessOf(hex: string): number {
  return rgbToHsl(parseHex(hex))[2];
}

export function mix(a: string, b: string, amountOfA: number): string {
  const A = parseHex(a), B = parseHex(b);
  return toHex(A.map((c, i) => c * amountOfA + B[i] * (1 - amountOfA)) as RGB);
}

/**
 * Move lightness in one direction (darker or lighter) in small steps until
 * `ok` passes. Returns the first passing colour, i.e. the smallest change.
 */
function nudge(hex: string, direction: "darker" | "lighter", ok: (c: string) => boolean): string {
  if (ok(hex)) return hex;
  const start = lightnessOf(hex);
  for (let i = 1; i <= 100; i++) {
    const l = direction === "darker" ? start - i / 100 : start + i / 100;
    if (l < 0 || l > 1) break;
    const c = withLightness(hex, l);
    if (ok(c)) return c;
  }
  return direction === "darker" ? "#000000" : "#FFFFFF";
}

// ---------- the derivation ----------

function solid(raw: string, mode: Mode): { team: string; onTeam: string } {
  const { bg, text, white } = BASE[mode];
  let team = raw.toUpperCase();

  // Make it visible as a band against the page.
  if (contrast(team, bg) < BAND) {
    team = nudge(team, mode === "light" ? "darker" : "lighter", (c) => contrast(c, bg) >= BAND);
  }

  // Pick the label colour that reads better, then nudge the fill until it passes.
  const onTeam = contrast(white, team) >= contrast(text, team) ? white : text;
  const away = onTeam === white ? "darker" : "lighter";
  team = nudge(team, away, (c) => contrast(onTeam, c) >= AA && contrast(c, bg) >= BAND);
  return { team, onTeam };
}

export function deriveTeamTheme(raw: string, mode: Mode): TeamTheme {
  const { bg, surface } = BASE[mode];
  const { team, onTeam } = solid(raw, mode);

  // Ink: readable on both page backgrounds.
  const inkOk = (c: string) => contrast(c, bg) >= AA && contrast(c, surface) >= AA;
  const teamInk = nudge(raw.toUpperCase(), mode === "light" ? "darker" : "lighter", inkOk);

  // Soft tint: as strong as possible while ink stays readable on it.
  // Same hue at a fixed light/dark lightness, so navy gives a pale blue, not a grey.
  let teamSoft: string = bg;
  const lightnesses = mode === "light" ? [0.94, 0.96, 0.975] : [0.17, 0.14, 0.11];
  for (const l of lightnesses) {
    const c = mix(withLightness(raw, l), bg, 0.85);
    if (contrast(teamInk, c) >= AA && contrast(BASE[mode].fg, c) >= AA) {
      teamSoft = c;
      break;
    }
  }

  return { team, onTeam, teamInk, teamSoft };
}

export function teamThemeVars(primary: string, secondary: string | null, mode: Mode): TeamThemeVars {
  const t = deriveTeamTheme(primary, mode);
  const vars: TeamThemeVars = {
    "--team": t.team,
    "--on-team": t.onTeam,
    "--team-ink": t.teamInk,
    "--team-soft": t.teamSoft,
  };
  if (secondary) {
    const s = solid(secondary, mode);
    vars["--team-2"] = s.team;
    vars["--on-team-2"] = s.onTeam;
  }
  return vars;
}

/**
 * CSS for one team, scoped to its pages: <div data-team="<id>">.
 * Server-render this into the team layout so there's no flash of the default colour.
 * Respects the viewer's "use team colours" setting by simply not emitting it.
 */
export function teamThemeCss(teamId: string, primary: string, secondary: string | null): string {
  const block = (mode: Mode) =>
    Object.entries(teamThemeVars(primary, secondary, mode)).map(([k, v]) => `${k}:${v};`).join("");
  const sel = `[data-team="${teamId.replace(/[^a-zA-Z0-9-]/g, "")}"]`;
  return [
    `${sel}{${block("light")}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) ${sel}{${block("dark")}}}`,
    `:root[data-theme="dark"] ${sel}{${block("dark")}}`,
  ].join("\n");
}
