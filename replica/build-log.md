# Build log

Sample-data build: everything runs on an in-memory data layer (`src/lib/data/fake.ts`) that mirrors `schema.sql` and its access rules. replica-backend swaps it for Supabase with no screen changes. Emails go to a sample inbox at `/dev/outbox`.

Checked for every screen below: 390px and 1440px wide, no sideways scroll, no console errors, keyboard-operable, copy written fresh. Screenshots in `clone-screens/`.

| ID | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| shell | 2026-10-24 | done | — | Next 15 can't read TypeScript 7 configs; pinned TS 5. Team colour CSS is server-rendered per team so there's no colour flash. |
| S01 sign in / up | 2026-10-24 | partial | real email sign-in link, activation email (Supabase Auth) | — |
| S02 home | 2026-10-24 | done | — | — |
| S03 my teams | 2026-10-24 | done | — | — |
| S04 find a team | 2026-10-24 | stub | search and follow (could-have) | — |
| S05 create team | 2026-10-24 | done | crest upload (needs storage) | live light/dark preview of the picked colour |
| S06 team home | 2026-10-24 | done | — | header + tabs in team colours; redirects to schedule |
| S07 schedule | 2026-10-24 | done | recurring practices | list grouped by week is the default; month grid added |
| S08 event details | 2026-10-24 | done | edit event, live score | staff tools: postpone, cancel with reason, remind non-responders |
| S09 new event | 2026-10-24 | partial | repeat weekly, edit existing | end time auto-fills (90 min game, 75 min practice) |
| S10 availability | 2026-10-24 | done | — | notes only visible to staff (tested) |
| S11 my RSVPs | 2026-10-24 | done | — | — |
| S12 roster | 2026-10-24 | done | print, remove, resend invite | — |
| S13 add players / staff | 2026-10-24 | done | — | paste-a-list parser (name, email, number in any order) |
| email RSVP link | 2026-10-24 | done | real email sending | the answer saves after the page loads, so email scanners that pre-open links don't answer for families |
| invite landing | 2026-10-24 | done | — | claims every pending invite for that email on join |
| S14, S15, S21, S22 | — | not started | person profile, staff permission editing, household, notification settings | — |
| S16 team chat | — | stub | everything; needs Supabase Realtime | — |
| S17 messages | — | stub | — | — |
| S18 family calendar | 2026-10-24 | partial | calendar subscribe (S19) | per-kid filter |
| S19, S20 | — | not started | iCal feed, live scoring | — |
| S23 account | 2026-10-24 | partial | edit name/phone, delete account | theme and team-colour switches |

Must-haves: 15 of 20. Not done: real sign-up email, team chat, push notifications, and real email sending (all need the backend); sign-up is partial.

Loop test (headless Chromium, `loop.py` in the session): new coach signs up → creates team → pastes 2 players → parent joins from the invite email → coach adds a game → parent taps Going in the email → coach sees 1 going → parent switches to Maybe by keyboard and adds a note → coach sees the note → parent can't add events → coach cancels with a reason → parent sees it cancelled. 20 checks, all passing.
