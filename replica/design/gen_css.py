#!/usr/bin/env python3
"""Generate tokens.css and tailwind-theme.css from tokens.json.

    python3 gen_css.py            # run after every token change, including the rebrand

tokens.json is the single source of truth. Never edit the generated CSS by hand.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
tok = json.load(open(os.path.join(HERE, "tokens.json"), encoding="utf-8"))
light, dark = tok["color"]["light"], tok["color"]["dark"]


def colour_block(c):
    lines = [f"  --{k}: {v};" for k, v in c.items()]
    # Default team colours = the app accent, so team-coloured parts still work outside a team.
    lines += [
        "  --team: var(--accent);",
        "  --on-team: var(--on-accent);",
        "  --team-ink: var(--accent);",
        "  --team-soft: color-mix(in srgb, var(--accent) 10%, var(--bg));",
        "  --team-2: var(--team);",
        "  --on-team-2: var(--on-team);",
    ]
    return "\n".join(lines)


f = tok["font"]
statics = [f"  --ff-sans: {f['sans']};", f"  --ff-display: {f['display']};", f"  --ff-mono: {f['mono']};"]
for name, t in tok["type"].items():
    statics.append(f"  --fs-{name}: {t['size'] / 16:g}rem;")
    statics.append(f"  --lh-{name}: {t['line'] / 16:g}rem;")
    statics.append(f"  --fw-{name}: {t['weight']};")
for i, v in enumerate(tok["space"]):
    statics.append(f"  --space-{i}: {v / 16:g}rem;")
for k, v in tok["radius"].items():
    statics.append(f"  --r-{k}: {v}px;")
for k, v in tok["shadow"].items():
    statics.append(f"  --sh-{k}: {v};")
for k, v in tok["motion"].items():
    if not k.startswith("_"):
        statics.append(f"  --motion-{k}: {v};")
L = tok["layout"]
for k in ["gutter", "max-content", "header", "tabbar", "sidebar", "tap-min"]:
    statics.append(f"  --layout-{k}: {L[k]}px;")
for k, v in tok["z"].items():
    statics.append(f"  --z-{k}: {v};")

css = f"""/* Generated from tokens.json by gen_css.py. Do not edit by hand. */

:root {{
{chr(10).join(statics)}
  color-scheme: light;
{colour_block(light)}
}}

/* Dark: follows the device unless the user picked a theme (data-theme on <html>). */
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
{chr(10).join('  ' + l for l in colour_block(dark).splitlines())}
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
{colour_block(dark)}
}}

html {{
  background: var(--bg);
  color: var(--text);
  font-family: var(--ff-sans);
  -webkit-text-size-adjust: 100%;
}}
:focus-visible {{
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}}
@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }}
}}
"""
open(os.path.join(HERE, "tokens.css"), "w", encoding="utf-8").write(css)

# Tailwind v4: map roles into the theme so components write bg-surface, text-muted, bg-team...
roles = list(light.keys()) + ["team", "on-team", "team-ink", "team-soft", "team-2", "on-team-2"]
tw = ["/* Generated from tokens.json by gen_css.py. Import from app/globals.css: */",
      '/*   @import "tailwindcss"; @import "../design/tailwind-theme.css"; */',
      '@import "./tokens.css";',
      "",
      "@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));",
      "",
      "@theme inline {",
      "  --color-*: initial;",
      "  --color-transparent: transparent;",
      "  --color-current: currentColor;"]
alias = {"text": "fg", "text-muted": "muted"}  # nicer classes: text-fg, text-muted, bg-surface
tw += [f"  --color-{alias.get(r, r)}: var(--{r});" for r in roles]
tw += ["  --font-sans: var(--ff-sans);", "  --font-display: var(--ff-display);", "  --font-mono: var(--ff-mono);"]
for name in tok["type"]:
    tw.append(f"  --text-{name}: var(--fs-{name});")
    tw.append(f"  --text-{name}--line-height: var(--lh-{name});")
    tw.append(f"  --text-{name}--font-weight: var(--fw-{name});")
tw.append("  --spacing: 0.25rem;")
for k in tok["radius"]:
    tw.append(f"  --radius-{k}: var(--r-{k});")
tw.append("  --shadow-card: var(--sh-card);")
tw.append("  --shadow-pop: var(--sh-pop);")
for k, v in L["breakpoints"].items():
    tw.append(f"  --breakpoint-{k}: {v / 16:g}rem;")
tw.append("}")
open(os.path.join(HERE, "tailwind-theme.css"), "w", encoding="utf-8").write("\n".join(tw) + "\n")
print("wrote tokens.css and tailwind-theme.css")
