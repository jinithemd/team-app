# Recon map: SportsEngine – Team management (rebuilt as a web app)

Scope: the free team core loop: teams, roster, schedule, RSVP/availability, team chat and messages, notifications, family (household) calendar, calendar sync, light game scoring. HQ-only features (registration, billing, volunteers/DIBS, credentials, stats/standings, news) are out of this slice.
For: a standalone product for youth clubs, academies and amateur teams.
Platform: original is iOS/Android plus TeamCenter on the web. Clone is a mobile-first web app (PWA), native later.
Date: 2026-10-23

Method: public sources only (App Store listing and version history, SportsEngine help centers, club-published user guides). No account was used, nothing behind a login was viewed, no app code or network traffic was inspected. Screens marked *inferred* are reconstructed from help-article steps, not seen directly. Before using a personal SportsEngine account to fill gaps, check its Terms of Use for any clause against using the service to build a competing product.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store listing (CA) | https://apps.apple.com/ca/app/sportsengine-team-management/id499597400 | feature list, 4.7 from ~17K ratings, version history 7.3.5 to 7.5.1 |
| 2 | Help: How to Create a Team (mobile) | https://mobile-help.sportsengine.com/en/articles/8366315-how-to-create-a-team | team fields, roster invite by email |
| 3 | Help: Add Players or Staff in TeamCenter | https://help.sportsengine.com/en/articles/6311063-how-to-add-players-or-staff-to-your-roster-in-teamcenter | jersey, position, staff role and permissions, invite acceptance |
| 4 | Help: SportsEngine Mobile Start-Up Guide | https://help.sportsengine.com/en/articles/6314498-sportsengine-mobile-start-up-guide | Teams tab, messaging recipients, stats tabs |
| 5 | Getting Started Guide (club-hosted PDF, 2016) | https://wel.psdschools.org/sites/wel/files/2020-04/Getting_Started_Guide.pdf | RSVP Going/Not Going/Maybe + private note, team RSVPs view, follow by Team ID, iCal, household, linked accounts |
| 6 | Parent guide (club-hosted PDF) | https://cdn1.sportngin.com/attachments/document/e8eb-3174412/Help_Guide_To_Getting_Started_with_Sports_Engine_Team_Management_Parents.pdf | add guardian, roster players/staff tabs |
| 7 | Coach guide (club-hosted PDF) | https://cdn1.sportngin.com/attachments/document/991a-2914061/Help_Guide_To_Getting_Started_with_Sports_Engine_Team_Management_Coaches.pdf | print roster, DOB/gender locked |
| 8 | SportsEngine blog: Team Chat update | https://www.sportsengine.com/blog/sportsengine-hq-product-update-team-chat/ | polls, video, who reacted, open counts |
| 9 | Agenda Hero calendar-sync guide | https://agendahero.com/posts/sync-teamsnap-gamechanger-sportsengine-to-one-calendar | Subscribe button, web Sync Schedule link |

Gaps worth filling later: walkthrough videos (exact tab layout, empty states), and a parent's own account view if the terms allow it.

## Core loop

A coach puts a game on the schedule and every family gets notified, answers Going / Not Going / Maybe, and talks it through in team chat, so the coach knows who is showing up without chasing anyone.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign in / sign up | `/login`, `/signup` | account (name, email, phone, password), activation email | TextInput, Button, Checkbox (age certify, marketing opt-in) | default, error, awaiting activation [5] |
| S02 | Home | `/` after login | recently viewed teams, upcoming games, game-day details across all teams [1 v7.4.6] | TeamChip, EventCard, SectionHeader | empty (no teams), filled |
| S03 | My Teams | `/teams` | teams you're rostered on or a guardian for, plus followed teams [4][5] | TeamRow, swipe/remove, Add Team button | empty, filled |
| S04 | Find a team | `/teams/search` | search by team name or Team ID, star to follow [5] | SearchInput, TeamRow, FollowStar | no results, results |
| S05 | Create team | `/teams/new` | name, sport, age group, location, team colour, org name (optional) [2] | TextInput, Select, ColorPicker | default, validation error |
| S06 | Team home | `/t/:teamId` | hub: Schedule, Roster, Chat, Messages, Stats | TeamHeader (colour), TabBar / NavTiles | member view, staff view |
| S07 | Team schedule | `/t/:teamId/schedule` | games, practices, events; cancellations/changes shown [1] | ListView / MonthCalendar toggle, EventCard, StatusBadge | empty, list, calendar, cancelled item |
| S08 | Event details | `/t/:teamId/e/:eventId` | time, location/venue, opponent, notes, your RSVP, team RSVPs [1 v7.5.0][5] | DetailHeader, MapLink, RsvpControl, AttendanceSummary | upcoming, past, cancelled, postponed |
| S09 | Create / edit event | `/t/:teamId/e/new` | game vs practice/event, date/time, venue, opponent, notify toggle *inferred* | SegmentedControl, DateTimePicker, VenuePicker, Toggle | new, edit, validation error |
| S10 | Team RSVPs (availability) | `/t/:teamId/e/:eventId/rsvps` | each player's response and note, counts [5] | AttendanceList grouped by status, CountPills | none responded, partial, all |
| S11 | My RSVPs | `/rsvps` | pending invitations across teams and kids; respond with note [5] | InvitationCard, RsvpControl, NoteField | none pending, pending |
| S12 | Roster | `/t/:teamId/roster` | Players and Staff tabs; jersey, position; print [3][6][1 v7.4.8] | Tabs, PersonRow, Avatar, AddFab, PrintButton | empty, filled, invite pending |
| S13 | Add player / staff | `/t/:teamId/roster/add` | first/last name, email required; player jersey/position; staff role + permissions [2][3] | Form, RoleSelect, PermissionChecklist | default, error, invite sent |
| S14 | Person profile | `/t/:teamId/p/:personId` | contact info, guardians, add guardian [6] | ProfileHeader, GuardianList, InviteButton | own child, other player (restricted) |
| S15 | Staff permissions | from S14 for staff | edit settings, rostering, schedule games, schedule events, scoring, manage permissions [1 v7.3.7] | PermissionChecklist | default, saved |
| S16 | Team chat | `/t/:teamId/chat` | real-time thread: photos, video, files, GIFs, reactions with counts, read receipts, pins, polls [1 v7.4.4–7.4.8][8] | MessageBubble, Composer, ReactionBar, PinnedBar, PollCard, Attachment | empty, filled, sending, failed |
| S17 | Messages (inbox) | `/t/:teamId/messages` | email-style messages with subject, to all or selected members [4][5] | MessageList, RecipientPicker, SubjectField | empty, filled, compose |
| S18 | Family calendar | `/calendar` | every athlete in the household on one calendar [1] | MonthCalendar, AthleteFilter chips, EventCard | empty, filled |
| S19 | Calendar subscribe | modal from S07/S18 | iCal / Google / Outlook feed link [5][9] | Modal, CopyField, Button | default, copied |
| S20 | Live scoring | from S08 (game, staff with scoring permission) | update score live, followers see it update [1 v7.3.11, 7.4.2] | Scoreboard, Stepper, PeriodControl | not started, live, final |
| S21 | Household | `/account/household` | child profiles, guardian permissions, contact info [1 v7.3.13][5] | PersonRow, AddChild, PermissionToggle | empty, filled |
| S22 | Notification settings | `/account/notifications` | push / email / SMS per team [5] | ToggleList | default |
| S23 | Account / settings | `/account` | profile, theme (dark mode [1 v7.4.10]), sign out | ListRow, Toggle | default |

## Flows

```
F01 Coach creates a team and invites the roster
    S03 -> S05 -> S06 -> S12 -> S13 (repeat per player) -> S12 (invite pending)
    happy path clicks: ~6 + 3 per player
    edge: email already has an account; duplicate player; invitee never accepts (gets no team comms until they do [3]); bulk add (original has none in-app — opportunity)

F02 Coach schedules a game and notifies the team
    S06 -> S07 -> S09 -> S08
    happy path clicks: ~5
    edge: recurring practices; venue TBD; time zone; edit after RSVPs exist; save without notifying

F03 Parent RSVPs for one kid
    push/email -> S11 (or S08) -> choose Going/Not Going/Maybe -> optional note -> save
    happy path clicks: 2 (from notification); 0-login from email in the original [5]
    edge: two kids on two teams; changing answer later; note visible to staff only [5]

F04 Coach checks who's coming
    S07 -> S08 -> S10
    happy path clicks: 3
    edge: no responses; nudge non-responders (not seen in original — opportunity)

F05 Coach cancels or moves a game
    S08 -> S09 (status cancelled/postponed, or new time) -> notify -> S07 shows change
    happy path clicks: ~4
    edge: RSVPs reset on time change?; calendar feeds lag (web feeds reported up to 24h)

F06 Team chat conversation
    S06 -> S16 -> send text/photo/poll -> reactions, read receipts
    happy path clicks: 2
    edge: offline send, large video, muting, moderating a parent

F07 Parent sees every kid's schedule in one place
    S18 (filter by athlete) -> S08
    happy path clicks: 1-2
    edge: kid removed from team; overlapping events

F08 Subscribe the schedule to a phone calendar
    S07 or S18 -> S19 -> copy / open in calendar app
    happy path clicks: 2-3
    edge: Google Calendar refresh delay; Android vs iOS handling

F09 Add a second guardian
    S14 -> add guardian -> invite email -> they sign up -> linked
    happy path clicks: 3 + their signup
    edge: separated households both need messages [5]

F10 Fan follows a team
    S04 -> star -> S03 -> S07 / S20
    happy path clicks: 3
    edge: private roster hidden from followers

F11 Staff scores a game live
    S08 -> S20 -> update -> followers see live score
    happy path clicks: 2 + taps per score
    edge: two scorers at once; correcting a mistake; connection drop mid-game
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, pressed, disabled, loading | all |
| TextInput / Select / DateTimePicker | text, email, phone, search | default, focus, error, disabled | S01, S05, S09, S13 |
| TeamChip / TeamRow | compact, row, with colour swatch | default, followed, swiping | S02, S03, S04 |
| EventCard | game (opponent, home/away), practice, event | upcoming, today, cancelled, postponed, past with score | S02, S07, S18 |
| StatusBadge | active, cancelled, postponed, final, live | — | S07, S08, S20 |
| RsvpControl | 3-way segmented: Going / Not Going / Maybe, + note | unanswered, answered, saving | S08, S11 |
| AttendanceList | grouped by response | loading, empty, partial | S10 |
| PersonRow + Avatar | player (jersey, position), staff (role), guardian | invite pending, active | S12, S14, S21 |
| PermissionChecklist | staff permissions | default, saved | S13, S15 |
| MessageBubble | text, image, video, file, gif, poll, pinned | sending, sent, read, failed | S16 |
| Composer | text + attach + gif + poll | empty, typing, uploading | S16 |
| ReactionBar | coloured reactions with counts | none, some, mine | S16 |
| MonthCalendar / ListView | month, list | empty, filled | S07, S18 |
| Scoreboard | team vs opponent, period | not started, live, final | S08, S20 |
| Modal / Sheet | confirm, subscribe, picker | open, closed | S19, S09 |
| Toast | success, error | — | all |
| TabBar / bottom nav | Home, Teams, Calendar, Chat, Account | active tab | all |

## Inferred data model

```
User          id, first_name, last_name, email, phone, password_hash, biometric?, theme, created_at
              evidence: S01 signup fields [5], dark mode [1]
              confidence: high

Household     id, owner_user_id
HouseholdMember  household_id, person_id, relation (self | child)
              evidence: Household page, child sub-profiles [5][1 v7.3.13]
              confidence: medium

Person        id, first_name, last_name, dob, gender, user_id (nullable for kids)
              evidence: DOB/gender pre-populated and locked [7]
              confidence: medium

Guardian      person_id, user_id, is_primary, status (invited | active)
              evidence: primary guardian, "add guardian" invite [6], linked accounts [5]
              confidence: high

Team          id, name, sport, age_group, location, color, org_name, public_code (Team ID), created_by
              evidence: create-team fields [2], search by Team ID [5]
              confidence: high

RosterMember  id, team_id, person_id, kind (player | staff), jersey, position, role (coach | manager | ...),
              permissions (edit_settings, roster, schedule_games, schedule_events, scoring, manage_permissions),
              status (invited | active), invited_email
              evidence: [2][3][1 v7.3.7]
              confidence: high

Follow        user_id, team_id
              evidence: Favorites / star to follow [5]
              confidence: high

Event         id, team_id, type (game | practice | event), title, start_at, end_at, tz, venue_id,
              opponent, home_away, notes, status (active | cancelled | postponed), recurrence_id?
              evidence: schedule/cancellations [1], venue improvements [1 v7.4.9]
              confidence: high for type/status; guess for recurrence and home_away

Venue         id, name, address, lat, lng
              evidence: venue selection [1 v7.4.9]
              confidence: medium

Rsvp          event_id, person_id, response (going | not_going | maybe), note, responded_by_user_id, updated_at
              evidence: [5] note visible to manager only
              confidence: high

Score         event_id, team_score, opponent_score, period, status (not_started | live | final), updated_by
              evidence: scoring + live scores [1 v7.4.2, 7.3.11]
              confidence: medium

Conversation  id, team_id, kind (team | message_thread)
ChatMessage   id, conversation_id, author_user_id, body, attachments[], pinned, created_at
Reaction      message_id, user_id, emoji
ReadReceipt   message_id, user_id, read_at
Poll          id, message_id, question, options[], votes(user_id, option)
              evidence: chat features [1 v7.4.4–7.4.8][8]
              confidence: high (polls medium — HQ blog)

Message       id, team_id, author_user_id, subject, body, recipients[] (all | person ids), created_at
              evidence: compose with To/Subject [4][5]
              confidence: high

NotificationPref  user_id, team_id, push, email, sms
              evidence: per-team text toggle [5]
              confidence: medium

CalendarFeed  user_id or team_id, secret_token
              evidence: iCal subscribe [5][9]
              confidence: high
```

Relationships: User 1-1 Household 1-n Person; Person n-n User via Guardian; Team 1-n RosterMember n-1 Person; Team 1-n Event 1-n Rsvp; Event 1-1 Score; Team 1-n Conversation 1-n ChatMessage; User n-n Team via Follow.

## Feature matrix

See `features.csv`. Must: 20, should: 14, could: 9, skip: 9.

## Out of scope (cannot or should not be cloned)

- SportsEngine HQ: registration, billing and auto-payments, memberships, DIBS volunteering, credentials, background checks — a separate product and the original's paid tier
- Stats, standings and news articles (HQ-gated in the original)
- Governing-body and league affiliations, official rosters, the existing network of clubs and families
- Livestreaming (separate SportsEngine Play product)
- Ad network and third-party ad tracking (the clone shouldn't ship this — it's a selling point not to)
- SportsEngine's name, logo, colours, copy and screenshots

## Size

Screens 23, flows 11, entities 17. Hard parts: real-time chat with media, reactions, read receipts and pins; notification fan-out (push, email, SMS) with per-team preferences and a no-login RSVP link from email; guardian/household permissions (who can see and answer for which kid). Also non-trivial: recurring events with time zones, and iCal feeds.
Size: M for the must rows (a few weeks with a managed backend), L with all should rows.
