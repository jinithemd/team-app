# Architecture: team management app (a rebuild of SportsEngine Team Management's core features)

Working name only; replica-brand picks the real one. Reads `recon.md` and `features.csv`.
Web first (mobile-first PWA). A native Expo app can come later and reuse the same Supabase backend.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | server actions for writes, best-documented React framework for building with AI help |
| styling | Tailwind + tokens from replica-design | fast to iterate on mobile layouts; tokens keep the rebrand in one file |
| database | Postgres on Supabase | rosters, guardians and RSVPs are relational; RLS enforces "who can see which kid" in the database |
| ORM | Supabase JS client + generated types (Drizzle only if queries get complex) | RLS works through the client automatically; one less layer |
| auth | Supabase Auth (email magic link + password, Google) | same database as the data, so `auth.uid()` drives every policy |
| realtime | Supabase Realtime (Postgres changes + presence) | chat, live scores and RSVP counts without running a socket server |
| files | Supabase Storage (private bucket per team, signed URLs) | chat photos/videos and avatars behind the same access rules |
| push | Web Push (VAPID) via the `web-push` npm package | free, works on Android/desktop, and on iPhone once the PWA is added to the home screen |
| email | Resend | simple API, React email templates, good deliverability for invites and RSVP links |
| SMS | none at launch; Twilio later (a "could" row) | per-message cost, and Canadian sender registration takes time |
| jobs | Supabase pg_cron + Edge Functions | runs every minute on the free tier (Vercel Hobby cron is daily only) |
| payments | none in this slice; Stripe Billing later for club plans | HQ-style registration/billing is out of scope |
| hosting | Vercel | zero-config for Next.js App Router; Netlify also works if you'd rather stay there |
| monitoring | Sentry (free tier) + Supabase logs | catch failed sends and RLS errors early |

Not reused from Areno's FastAPI + MongoDB stack on purpose: this app is mostly permissions over related rows (guardian → kid → roster → event → RSVP), which Postgres + RLS handles in one place, and Supabase gives realtime chat, auth and storage without extra services.

## Schema

Tables: 24 (+1 view). Access rules: Postgres row level security on every table, via security-definer helper functions (`is_team_member`, `is_team_staff`, `has_team_perm`, `is_guardian`, `can_view_team`). Full SQL in `schema.sql`, written as the first migration.

| table | for | key rules |
| --- | --- | --- |
| profiles | signed-up users (S01, S23) | id = auth.users.id |
| people | anyone on a roster, kids included | kids have no account; `user_id` set for adults |
| people_private | DOB, gender, medical notes | guardians and that person's coaches only |
| guardians | who acts for whom; the "household" | adult is own guardian (`is_self`); one primary per person; invites by email |
| teams | S05 | `join_code` for search/follow; `is_public`, `roster_visible` switches; `color`, `color_secondary`, `logo_path` theme the team's screens |
| roster_members | players and staff (S12, S13, S15) | six staff permissions as a checked `text[]`; one active row per person per kind |
| follows | fans (F10) | |
| venues | S09 | per team |
| event_series | recurring practices | RRULE + IANA zone + local wall-clock time |
| events | S07–S09 | type game/practice/event; status active/postponed/cancelled; `tz` stored |
| rsvps | S10, S11 | unique (event, person); note visible to staff + guardians only |
| rsvps_public (view) | team availability | responses without notes, for teammates |
| scores | S20 | `version` for optimistic locking between scorers |
| conversations | S16 | exactly one `team` chat per team |
| chat_messages | S16 | `unique(author_id, client_id)` makes retries idempotent; pins, soft delete |
| chat_reactions, chat_reads | reactions, read receipts | reads are a per-conversation high-water mark |
| poll_options, poll_votes | chat polls | one vote per user per poll |
| messages, message_recipients | S17 | recipients resolved at send time (players → their guardians) |
| notification_prefs | S22 | per user per team |
| push_subscriptions | web push | one per browser |
| calendar_feeds | S19 | token stored hashed; household or per team |
| outbox | every notification | `dedupe_key` unique → no double sends; service role only |

Hard constraints in the database, not the UI: one RSVP per person per event (unique), RSVP only for someone on that team's active roster (policy check), only staff with `schedule_games` create games, chat posting blocked for non-members and for families when the coach makes the chat announcement-only, `end_at > start_at`, opponent only on games, one team chat per team.

Checked: the schema loads cleanly on Postgres 16 with a Supabase auth stub, and a test run confirmed parent A can answer for their kid but not another family's, parents can't create events, other parents see answers but not notes or birthdays, fans see the schedule but not the roster or chat, and duplicate RSVPs are rejected.

## API

Reads go straight from the browser through the Supabase client, guarded by RLS. Writes that touch more than one row or send notifications are Next.js server actions (`'use server'`), which check permission, write in one transaction (a Postgres function via `rpc`), then queue notifications in `outbox`.

Who: **anon** (not signed in), **user** (any signed-in), **guardian** (acts for that person), **member** (on the team), **staff+perm** (staff holding that permission; the team creator holds all).

### F01 Create a team and invite the roster

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createTeam` | team + creator as head coach + team chat | user | name, sport, age_group, location, color, org_name | team | F01 |
| action `invitePeople` | create people (kids) + roster rows + guardian invites, email each | staff+roster | team_id, rows[{first, last, email, kind, jersey, position, role, perms}] (one or many, from a form or pasted list) | roster rows, invite count | F01 |
| GET `/invite/[token]` | invite landing: sign up / sign in, then accept | anon | token | page | F01 |
| action `acceptInvite` | activate roster row or guardian row, link to account | user | token | team | F01, F09 |
| action `resendInvite` / `removeMember` | | staff+roster | roster_member_id | ok | F01 |
| action `updateStaffPermissions` | | staff+manage_permissions | roster_member_id, permissions[] | row | S15 |
| action `updateTeam` | settings, colour, public/roster switches | staff+edit_settings | team_id, fields | team | S05 |

### F02 / F05 Schedule, change, cancel

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createEvent` | one event, or a series + materialised occurrences | staff+schedule_games / schedule_events | team_id, type, local date/time, tz, duration, venue, opponent, home_away, notes, rrule?, notify | event(s) | F02 |
| action `updateEvent` | edit one, or this-and-following in a series | same | event_id, fields, scope (one / following), notify | event(s) | F05 |
| action `setEventStatus` | postpone / cancel / reinstate, with reason | same | event_id, status, reason, notify | event | F05 |
| action `deleteEvent` | | same | event_id | ok | F05 |
| action `upsertVenue` | | same | team_id, name, address | venue | S09 |

### F03 / F04 RSVP and availability

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RLS upsert `rsvps` | answer for self or a kid | guardian | event_id, person_id, response, note | rsvp | F03 |
| GET `/r/[signed]` | one-tap RSVP from email, no login; then shows the event | anon with signed link | HMAC-signed {event, person, response, exp} | page | F03 |
| select `rsvps_public` / `rsvps` | team availability (notes for staff only) | member / staff | event_id | list + counts | F04 |
| action `nudgeNonResponders` | push/email to guardians who haven't answered | staff | event_id | sent count | F04 (gap feature) |

### F06 Chat and messages

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RLS insert `chat_messages` | send; realtime pushes it to everyone | member | conversation_id, client_id, body, attachments | message | F06 |
| action `uploadChatFile` | signed upload URL into the team bucket | member | conversation_id, mime, size | upload URL + path | F06 |
| action `createPoll` | message + options | member | conversation_id, question, options[] | message | F06 |
| RLS upsert `poll_votes`, `chat_reactions`, `chat_reads` | vote, react, mark read | member | | row | F06 |
| action `pinMessage` / `deleteMessage` | | staff (delete: author too) | message_id | message | F06 |
| action `sendMessage` | subject + body to all or selected; resolve guardians; email + push | staff | team_id, subject, body, to_all or person_ids | message | S17 |

### F07 / F08 Family calendar and subscriptions

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| select `events` for my teams | family calendar, filter by kid | user | date range, person_ids? | events | F07 |
| action `createCalendarFeed` / `revokeCalendarFeed` | | user | team_id? | feed URL (token shown once) | F08 |
| GET `/cal/[token].ics` | iCal feed, cached 15 min | anon with token | | text/calendar | F08 |

### F09 Household

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `addChild` | person + people_private + guardian(self as primary) | user | first, last, dob | person | S21 |
| action `inviteGuardian` | second parent | guardian (primary) | person_id, email | invite | F09 |

### F10 / F11 Follow and score

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| select `teams` by name / join_code | search | user | query | teams | F10 |
| RLS insert/delete `follows` | follow / unfollow | user | team_id | ok | F10 |
| action `updateScore` | +/− score, period, status; rejects stale `version` | staff+scoring | event_id, version, changes | score | F11 |

### Settings and push

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RLS upsert `notification_prefs` | | user | team_id, push, email, sms, chat_muted | prefs | S22 |
| action `savePushSubscription` / `removePushSubscription` | | user | endpoint, keys | ok | S22 |
| action `deleteAccount` | delete auth user; cascades; reassign team ownership first | user | confirm | ok | S23 |

Count: 26 server actions, 4 public routes (`/invite`, `/r`, `/cal`, plus the auth callback), and RLS-guarded direct reads/writes on the rest.

Webhooks in: Resend delivery and bounce events → mark outbox rows and flag bad emails on the roster. (No Stripe in this slice.)
Webhooks out: none.

Jobs (Supabase pg_cron → Edge Function):

| job | schedule | does |
| --- | --- | --- |
| `send-outbox` | every minute (and kicked right after each write) | sends pending push/email, backs off on failure, gives up after 5 attempts, deletes dead push endpoints (HTTP 410) |
| `materialise-series` | nightly | keeps 26 weeks of occurrences ahead for each recurring practice |
| `event-reminders` | every 15 min | reminder before events (default 24h), and RSVP nudge to non-responders if the coach turned it on |
| `cleanup` | daily | expire invites after 30 days, purge outbox rows older than 30 days, remove orphaned uploads |

Only official, public APIs with your own keys (Supabase, Resend, Web Push). Nothing from SportsEngine's private endpoints.

## The parts that bite

- **Time zones and daylight saving:** store `start_at` in UTC plus the event's IANA `tz`. Recurring practices store local wall-clock time and expand per date, so a 6 pm Tuesday practice stays 6 pm across the November clock change. Render in the event's zone, labelled when it differs from the viewer's.
- **Idempotency:** chat sends carry a browser-generated `client_id`; notifications go through `outbox.dedupe_key`; invite acceptance is a no-op if already active; Resend webhooks are matched by message id.
- **Races:** two scorers → `scores.version` compare-and-set; RSVP changed on two devices → upsert on (event, person), last write wins; editing an event while families are answering → RSVPs stay, but a time change re-notifies and marks answers "may be outdated".
- **Notification fan-out:** one event change for a 20-player team can be ~60 sends (two guardians each, plus staff, two channels). Queue it; never send inline in the request.
- **iPhone push:** web push on iOS only works after "Add to Home Screen" (iOS 16.4+). Onboarding must prompt it, and email stays the fallback. This is the strongest argument for the Expo app later.
- **Email deliverability:** verify your domain in Resend (SPF, DKIM, DMARC) before the first invite; invites from a new domain land in spam otherwise.
- **Kids' privacy:** DOB and medical notes live in `people_private`; teammates see names only. Signed RSVP links carry no personal data and expire.
- **Realtime limits:** Supabase free tier caps concurrent realtime connections (check current limits at signup); subscribe per open conversation, not per team list.
- **File sizes:** cap uploads (e.g. 25 MB images/files, 200 MB video) and compress images in the browser before upload; video is the storage cost to watch.
- **Multi-tenancy:** every row hangs off a team; every policy goes through the helper functions. Add a test for each new table that a stranger reads zero rows.
- **Deletion and privacy law (PIPEDA, GDPR):** `deleteAccount` cascades; kid records are deleted when their last guardian leaves and they're on no active roster; chat messages keep the text with the author shown as "Former member".
- **Team colours:** coaches pick any colour, so contrast can't be trusted. Compute text colour (black or white) from the colour's luminance, and darken or lighten the accent until it passes WCAG AA against the page in light and dark mode. Status colours (going / not going / cancelled) never take the team colour.
- **Search:** team search is `ilike` on name plus exact `join_code`; fine until thousands of teams, then add `pg_trgm`.

## Build order

1. **Vertical slice (week 1):** sign up → create team → invite one parent by email → create a game → parent RSVPs from the email link → coach sees the answer.
   Screens S01, S02, S05, S06, S07, S08, S10, S12, S13. Tables profiles, people, guardians, teams, roster_members, events, rsvps, outbox. Actions createTeam, invitePeople, acceptInvite, createEvent, `/r/[signed]`, send-outbox job (email only). Ugly is fine.
2. **Must-haves (weeks 2–4), by area:**
   - roster: staff invites with role, Players/Staff tabs, guardian answers for child (S12–S14, S21, addChild)
   - schedule: edit, postpone/cancel with status, venue map link, list view (updateEvent, setEventStatus, upsertVenue)
   - RSVP: in-app RSVP with private note, My RSVPs across kids, availability view (S11, rsvps_public)
   - chat: real-time team chat with text and photos (S16, chat_messages, storage)
   - notifications: web push + PWA install prompt (push_subscriptions, savePushSubscription)
   - home: upcoming across teams (S02)
3. **Should-haves:** family calendar and iCal feeds (S18, S19), recurring practices (event_series, materialise-series), second guardian, staff permissions (S15), subject messages (S17), reactions, read receipts, pins, polls, video/files, notification prefs (S22), live scoring (S20).
   **Could-haves:** follow as a fan, print roster, dark mode, passkeys, chat moderation, SMS, venue library, and the two gaps already designed in: nudge non-responders and paste-a-list bulk roster add.
4. **Fixes from replica-entrepreneur:** to be added once it reads SportsEngine's reviews.
