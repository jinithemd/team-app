# Architecture: team and club app for adult players

A rebuild of SportsEngine Team Management's core loop (schedule, RSVP, chat), refocused on **adult players and clubs** and extended with club operations taken from the Athletic Kerala FC feature list: attendance, availability, carpools, dues, seasons, points, results and player of the match. Platform name is a placeholder ("Areno") until the brand is chosen.

**What changed from the first plan:** no kids, guardians or households. Every player has their own account and answers for themselves. Captains, coaches and managers are players or members with permissions.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | server actions for writes; best-documented React framework for AI-assisted building |
| styling | Tailwind + tokens from replica-design | team and club colours flow through one token set |
| database | Postgres on Supabase | relational data (teams, events, answers, attendance, dues); RLS enforces who sees what |
| auth | Supabase Auth (magic link, Google) | `auth.uid()` drives every access rule |
| realtime | Supabase Realtime | chat, live scores, RSVP counts, carpool seats |
| files | Supabase Storage | chat photos, club and team logos |
| push | Web Push (VAPID) | free; iPhone needs Add to Home Screen; email is the fallback |
| email | Resend | invites, game emails with one-tap answers, dues reminders |
| jobs | Supabase pg_cron + Edge Functions | outbox sending, reminders, recurring events, points |
| payments | none (manual dues tracking) | e-Transfer and cash are how amateur clubs actually collect; Stripe can come later |
| hosting | Vercel | zero-config Next.js |
| monitoring | Sentry + Supabase logs | |

## Club accounts (one app, each club's own look)

One app. A club owner creates a club account and adds the club's name, logo and colours, and the app becomes that club's app for its members: club logo and name in the top bar and on sign-in, club colour as the accent, all club teams together, "Powered by Areno" in a small line. Each club gets a join page at `/c/<slug>`; "Add to home screen" from it shows the club's icon and name. Club admins run every team in the club; a club treasurer handles dues for all of them. Teams without a club keep the standard look.

## Schema

Tables: 36 (+3 views). Full SQL in `schema.sql`. Access rules: row level security on every table, through security-definer helpers (`is_team_member`, `is_team_staff`, `has_team_perm`, `has_event_perm`, `is_club_admin`, `played_in`).

| area | tables | key rules |
| --- | --- | --- |
| accounts | profiles, member_private | emergency contact and health notes: the player and their team staff only |
| clubs | clubs, club_admins | owner, admin, treasurer; branding public; only the owner manages admins |
| teams | teams, roster_members, follows | one row per person per team: `is_player` plus stacked `roles` (captain, vice captain, coach, manager, treasurer) plus 9 permissions; changing roles or permissions needs manage_permissions (trigger) |
| availability | availability_periods (+ availability_public view) | away, injured, vacation; teammates see "unavailable", only staff see the reason |
| schedule | seasons, venues, event_series, events, event_managers | types: training, match, tournament, social; competition: league, cup, friendly; one open season per team; an event manager runs one event without team-wide rights |
| answers | rsvps (+ rsvps_public view) | answer for yourself; staff can set one for a player; notes for staff only |
| attendance | attendance | present, late (minutes), absent, excused; recorded by staff or the event manager, or by the player's geo check-in (`method`, `checked_in_at`, `distance_m`, `accuracy_m`; never coordinates) |
| results | scores, match_events | live score with compare-and-set version; goals, assists, cards, wickets |
| player of the match | potm_votes (+ potm_results view) | one vote, only if you played, never for yourself; results shown after voting closes |
| points | points_ledger | off unless the team turns it on; automatic rows once per event and reason; manual rows by staff with a note |
| carpools | ride_offers, ride_requests | seats enforced in the database ("This car is full") |
| dues | fees, dues, payments | players see only their own; a player can report "I sent it"; only someone with the payments permission verifies |
| chat | conversations (team, staff, event, direct), chat_messages (replies, pins, soft delete), chat_reactions, chat_reads, poll_options, poll_votes | staff chat hidden from players |
| messages | messages, message_recipients | subject-line messages to all or chosen players |
| delivery | notification_prefs, push_subscriptions, calendar_feeds, outbox | outbox dedupe key prevents double sends |

### Signing up: one account, many hats

- Everyone signs up the same way: email link or Google. There are no separate "player", "captain" or "admin" accounts.
- Hats are added by what you do next, and they stack:
  - **Create a club** → you're its owner (`club_admins`). Owners can add admins and a treasurer.
  - **Create a team** → a "Your part on this team" step asks: Do you play? (number, position) and which roles (captain, manager, …). You get one roster row with `is_player`, those `roles` and every permission. Pick none and you're there as a manager only.
  - **Join by invite or club link** → you arrive as a player; a captain can add roles later.
- What you can do = the union of your hats: club owner/admin powers on every club team, team permissions on that team, and player things (answer, check in, vote) wherever `is_player` is true.
- The app never makes you switch modes. A player-captain sees "Going / Can't go" at the top of an event and the captain tools under it. The Account screen lists your hats per club and team.
- `createClub` runs as one server transaction: insert the club, then the owner row (service role), so nobody can make themselves owner of someone else's club.

**Permissions** (on a roster row): edit_settings, roster, schedule_games, schedule_events, attendance, scoring, payments, messages, manage_permissions. Default for a new captain: schedule_events, attendance, scoring, messages.

**Points rules** (per team, editable): training 1, match 2, away bonus 10, late penalty −1 when more than 15 minutes late, excused 0, player of the match 3. Applied by the server when attendance is saved; the unique index means re-saving attendance never double-awards.

**Tested** on Postgres 16 with a Supabase auth stub (`tests/schema_access_test.sql`), all passing:
- a player answers for themselves but not a teammate; can't add events, record attendance, give themselves points or read the staff chat
- a captain can add trainings but not matches without that permission, records attendance, adds manual points
- an event manager records attendance for their own trip but not another game
- geo check-in: 37 m from the pitch 5 min after start → present; 25 min after → late 25; 3.7 km away, a ±900 m fix, or 3 hours early → refused with a plain message; checking in twice keeps the first time; a captain's mark is never overwritten; a player can't edit their own row; a club owner not on the roster can't check in
- a teammate sees a player is unavailable but not that they're injured or why; the captain sees the reason
- a full car rejects another rider
- a player sees only their own dues, can report an e-Transfer, can't mark it verified; a captain without the payments permission sees no dues; the club treasurer verifies
- player of the match: no self-votes, no votes from players who didn't play

## API

Reads go through the Supabase client under RLS. Multi-row writes and anything that notifies are server actions.

| area | actions and routes |
| --- | --- |
| accounts | `signIn` (magic link / Google), `updateProfile`, `updatePrivateInfo`, `deleteAccount` |
| clubs | `createClub`, `updateClubBranding`, `addClubAdmin`, `removeClubAdmin`, `moveTeamToClub`; GET `/c/[slug]`, `/c/[slug]/manifest.webmanifest`; `requestToJoin`, `approveJoinRequest` |
| teams | `createTeam`, `updateTeam`, `invitePlayers` (form or pasted list), `acceptInvite`, `setRole`, `setPermissions`, `setMemberStatus` (active / inactive / removed) |
| seasons | `startSeason`, `closeSeason` (archives, freezes points and attendance totals), `copyRosterToNewSeason` |
| schedule | `createEvent` (one-off or weekly), `updateEvent`, `setEventStatus`, `assignEventManager` |
| availability | `setAvailability`, `clearAvailability` (player or staff) |
| answers | RLS upsert `rsvps`; GET `/r/[signed]` one-tap from email; `remindNoReplies` |
| attendance | `saveAttendance` (whole squad at once; computes points in the same transaction), `checkIn(eventId, lat, lng, accuracy)` → `rpc('check_in')`, then awards points for that row |
| results | `updateScore` (versioned), `addMatchEvent`, `finishMatch`, `openPotmVoting`, `closePotmVoting` (awards points) |
| carpools | `offerRide`, `requestRide`, `assignRider`, `markPickedUp`, `cancelRide` |
| dues | `createFee` (for all or chosen players), `waiveDue`, `reportPayment` (player), `recordPayment` / `verifyPayment` (payments permission), `sendDuesReminders` |
| points | `addManualPoints`, `updatePointsRules`, `togglePoints` |
| chat, messages | as before, plus staff chat and replies |
| exports | GET `/t/[id]/export/{players,attendance,dues,events}.csv` (staff; streamed) |
| analytics | `getTeamStats` / `getClubStats` (attendance rate, no-show rate, dues collected and owed, carpool use) from SQL views |

Jobs: `send-outbox` (every minute), `event-reminders` (every 15 min; skips players marked unavailable), `materialise-series` (nightly), `dues-reminders` (weekly, opt-in per fee), `cleanup` (daily).

## The parts that bite

- **Time zones:** UTC plus the event's zone; weekly trainings keep their local time across the clock change.
- **Idempotency:** client ids on chat sends, outbox dedupe keys, points unique per event and reason.
- **Races:** two scorers (version check), two riders taking the last seat (trigger with row lock), attendance saved twice (upsert).
- **Points fairness:** rules are explicit numbers, every change is a ledger row with a reason, and staff edits need a note. Show players how their total was earned.
- **Money:** this version only records payments made elsewhere. No card data ever touches the app. Verification is limited to the payments permission or the club treasurer.
- **Privacy:** health notes and injury reasons are staff-only. Location for carpools is a typed meeting point, not GPS.

### Geo-tagged attendance

- **Off by default**, turned on per team (`teams.geo_checkin_enabled`). Each venue needs a map pin and a radius (default 150 m, 50–1000).
- **One fix, when the player taps "I'm here".** The browser asks for location permission at that moment (`navigator.geolocation.getCurrentPosition`, high accuracy, 10 s timeout). No background tracking, no location history, no map of players.
- **Distance is worked out in the database** (`check_in`, security definer, haversine). Only the distance and accuracy are stored; the coordinates are dropped.
- **Window:** 60 minutes before the start until the end. Present if checked in less than `late_after_minutes` after the start, otherwise late with the minutes.
- **Refused** when too far away, the fix is rougher than ±200 m, the event is cancelled, or the team has it off. Every refusal says what to do: "You're 3,699 m from Club grounds", "Step outside and try again, or ask your captain".
- **Captain's mark wins.** Check-in never overwrites a staff row; staff can still change a geo row. A player can't edit their own row.
- **Spoofing:** a determined player can fake a browser location. Check-ins are evidence, not proof: the captain's attendance screen shows "Checked in 9:56 · 37 m" next to each name so odd ones stand out, and captains have the final say. Native app builds can add mock-location detection later.
- **Consent copy** on first use: "We check your location once, only when you tap I'm here, to confirm you're at the venue. We keep the distance, not where you were."
- **Reminder push** ("Kick-off in 15 min. Tap to check in") is sent only to players who answered Going and haven't checked in.
- **Notifications:** queue fan-out; iPhone push needs the home-screen install; cancellations always send.
- **Email deliverability:** SPF, DKIM and DMARC on the sending domain before the first invite.
- **Deletion (PIPEDA):** deleting an account removes private info and answers; chat keeps text as "Former member"; ledger and payment rows keep amounts with the name removed, so club totals still add up.

## Build order

1. **Vertical slice:** sign up → create team → invite a player → add a match → player taps Going in the email → captain sees the answer.
2. **Must-haves:** roster and roles, schedule with edit and cancel, availability, RSVP and Who's coming, attendance, team chat, push, home.
3. **Club accounts:** club setup and look, join page, club admin, treasurer.
4. **Should-haves:** dues, seasons, carpools, results and player of the match, points and leaderboard, subject messages, calendar feeds, exports.
5. **Could-haves:** analytics dashboard, follow a team, membership cards and sponsor rewards, GPS pickup confirmation for carpools (reuse the check-in approach: one fix at pickup).
6. **Fixes from replica-entrepreneur.**
