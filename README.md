# Team App

Team management for youth clubs and amateur teams: roster, schedule, one-tap RSVPs, team chat, in each team's own colours. Working name; the brand comes later.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

This build runs on sample data (resets on restart). Sign in as a sample coach or parent, or create your own team. Emails the app would send appear at `/dev/outbox`, with working links.

## Checks

```bash
npm run typecheck
npm run test:theme          # team colours stay readable in light and dark
python3 tests/loop.py       # full coach → parent → RSVP loop in a headless browser (server must be running)
```

## Where things are

- `src/lib/data/` the data layer. `fake.ts` now, Supabase next (same function names)
- `src/lib/team-theme.ts` turns any team colour into readable colours
- `src/styles/` design tokens (generated from `replica/design/tokens.json`)
- `replica/` the plan: recon, architecture, schema, design system, feature checklist, build log
