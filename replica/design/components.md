# Components

The design system for the team management app. Original look, built from roles in `tokens.json`; nothing measured from or copied out of SportsEngine (no screenshots were taken; recon was text sources only). Brand values are placeholders until replica-brand.

- **Icons:** Lucide (ISC licence), 20px in UI, 24px in the tab bar, 1.75 stroke.
- **Fonts:** Inter for everything you read; Barlow Condensed (bold, uppercase) for scores, big dates, team names in headers. Both SIL OFL, loaded with `next/font`.
- **Copy:** every label written fresh. Short, plain, parent-friendly ("Going", "Can't make it", "Maybe").
- **Base:** shadcn/ui on Radix primitives for dialog, sheet, popover, tabs, toggle group, dropdown, so focus trapping and keyboard support come for free. Restyle with tokens only.
- **Touch:** every tappable thing is at least 44×44px, including icon buttons.

## Where team colours go

Inside a team (`<div data-team={id}>` with vars from `team-theme.ts`), and only these parts:

| part | token |
| --- | --- |
| Team header band and crest ring | `--team` / `--on-team` |
| Primary buttons on team screens | `--team` / `--on-team` |
| Active tab underline, active bottom-tab icon and label | `--team-ink` |
| Links, "See all" | `--team-ink` |
| Selected chip, segmented-control thumb | `--team` / `--on-team` |
| Today in the calendar, unread chat row, my own chat bubbles | `--team-soft` (my bubbles: `--team` / `--on-team`) |
| Focus ring on team screens | stays `--focus` (consistent and always tested) |
| Team colour dot on cards outside the team (Home, family calendar) | `--team` of that team, with its name next to it, never colour alone |
| Secondary colour | thin stripe under the header, jersey number badges |

Never team-coloured: RSVP states, event status (cancelled / postponed / live), errors, success toasts, destructive buttons. Those always use the fixed status roles, so a red team never looks cancelled.

The viewer can switch team colours off (`profiles.use_team_colors`); then the vars aren't emitted and everything falls back to `--accent`.

---

## Foundations

```
AppShell
  layout    < lg: TopBar (56) + content + TabBar (64 + safe-area); >= lg: Sidebar (248) + content (max 1120)
  states    signed out (no tabs), signed in, inside a team (TopBar becomes TeamHeader)
  a11y      skip link to <main>; landmarks header/nav/main; tab bar is <nav aria-label="Primary">
  used on   all

TabBar
  items     Home, Teams, Calendar, Chat, Account (Lucide: house, users, calendar-days, message-circle, user)
  states    default, active (team-ink icon + label + 2px top bar), badge (unread count, danger dot)
  tokens    bg bg, border-top border, label xs/500, inactive text-muted
  a11y      aria-current="page" on active; badge has visually-hidden "3 unread"
  used on   all signed-in

TeamHeader
  content   crest (40, ring on-team), team name (2xl display uppercase), sport · age group, secondary stripe
  states    default, collapsed on scroll (name moves into TopBar), no crest (initials on team-2)
  tokens    bg team, text on-team, stripe team-2 4px
  a11y      team name is the page <h1>
  used on   S06–S17, S20
```

## Inputs and actions

```
Button
  variants  primary (team or accent), secondary (surface + border), ghost, danger, link
  sizes     sm 36px, md 44px, lg 52px (full-width on mobile forms)
  states    default, hover (8% darker via color-mix), pressed (scale .98), focus-visible (2px focus ring, offset 2),
            disabled (40% opacity, no pointer), loading (spinner replaces icon, label kept, aria-busy)
  tokens    radius md, font sm/600 (lg: base/600)
  a11y      real <button>; icon-only buttons need aria-label; loading keeps the accessible name
  used on   all

IconButton
  sizes     44×44 touch target, 20px icon
  states    as Button
  used on   TopBar, chat composer, roster rows

TextInput / Textarea / Select / SearchInput
  anatomy   label (sm/600, above), field (44px, radius md, border-input 1px), hint (xs muted), error (xs danger + icon)
  states    default, focus (2px focus ring, border focus), filled, error (border danger, aria-invalid, aria-describedby → message),
            disabled (sunken bg), read-only
  a11y      <label for>; errors announced with role="alert" on submit; correct input types (email, tel) for mobile keyboards
  used on   S01, S04, S05, S09, S13, S17

DateTimePicker
  anatomy   date field + time field + time zone line ("Toronto time" — shown only when it differs from the viewer's zone)
  states    default, TBD toggle on (fields disabled), error (end before start)
  a11y      native <input type="date"/"time"> on mobile; Radix popover calendar on desktop with arrow-key grid
  used on   S09

VenuePicker
  anatomy   combobox of saved venues + "Add a new place" (address autocomplete later)
  states    empty, results, new venue form
  used on   S09

ColorPicker (team colours)
  anatomy   12 preset swatches + hex field + live preview card (header band, button, link) in light and dark
  states    default, selected (check icon + 2px ring), invalid hex (error), auto-adjusted ("We darkened this a little so text stays readable")
  a11y      radiogroup of swatches with names ("Royal blue"); preview text has real contrast
  used on   S05, team settings

Toggle / Checkbox / RadioGroup
  states    off, on, focus, disabled
  a11y      Radix Switch (role="switch"), real checkbox/radio semantics
  used on   S09 (notify team), S13, S15, S22

SegmentedControl
  variants  2–3 options
  states    selected (team thumb), focus
  a11y      Radix ToggleGroup type="single" with roving tabindex
  used on   S07 (List | Month), S09 (Game | Practice | Event), S12 (Players | Staff)

PermissionChecklist
  content   6 rows: team settings, roster, schedule games, schedule practices & events, scoring, manage permissions
  states    default, saving, saved toast; head coach row locked (all on)
  used on   S13, S15
```

## Schedule

```
EventCard
  variants  game (opponent, home/away tag, score if final), practice, event
  anatomy   date block (day xs/500 uppercase muted + date 2xl display), title, time + place, my RSVP chip, team dot (outside team)
  states    upcoming, today (team-soft bg), cancelled (strikethrough title, danger StatusBadge, RSVP hidden),
            postponed (warning badge), live (live badge with pulsing dot), past (muted, score shown), loading skeleton
  tokens    bg bg, border border, radius lg, shadow card (light only)
  a11y      whole card is one link; accessible name reads "Game vs Rivals, Saturday 1 November, 10:00, Going"
  used on   S02, S07, S18

StatusBadge
  variants  cancelled (danger), postponed (warning), live (live + dot), final (sunken + text), TBD (sunken + muted)
  tokens    xs/600 uppercase, radius pill, soft bg + strong text (e.g. danger-soft / danger)
  a11y      text, not colour alone
  used on   S07, S08, S20

ScheduleList (default view)
  anatomy   grouped by week with sticky week headers ("This week", "Next week", "Nov 10–16"), past collapsed under "Earlier"
  states    empty ("No games or practices yet" + New event for staff), loading skeleton (3 cards), error (retry)
  note      list is the default: one long scroll is what parents use; month view is the alternative
  used on   S07, S18

MonthCalendar
  anatomy   7-column grid, dots per event (team colour on family calendar, max 3 + "+2"), tap a day → day list below
  states    today (team-soft), selected day (team ring), empty month
  a11y      grid role with arrow keys; each day labelled "Tuesday 4 November, 2 events"
  used on   S07, S18

AthleteFilter
  anatomy   chips per kid ("All", "Maya", "Arjun")
  states    selected, unselected
  used on   S18, S11
```

## RSVP

```
RsvpControl
  anatomy   3 buttons in a row: Going (check), Maybe (help-circle), Can't make it (x) + "Add a note for the coach"
  sizes     md (event page), sm (cards and My RSVPs)
  states    unanswered (all outline), answered (chosen fills: success / warning / danger with on-* text, others outline),
            saving (chosen shows spinner, others disabled), saved (brief check, toast "Saved"), error (toast + revert),
            locked (event cancelled or in the past: read-only)
  per kid   with two kids on the team, one row per kid with their name
  a11y      Radix ToggleGroup type="single"; aria-label "Maya's answer"; note field labelled "Note for the coach (only staff see this)"
  used on   S08, S11, email RSVP landing

AttendanceSummary
  anatomy   three count pills (12 going · 2 maybe · 3 can't · 4 no reply) + stacked avatars
  states    nobody answered ("No answers yet"), partial, all answered
  used on   S08, S10

AttendanceList
  anatomy   sections Going / Maybe / Can't make it / No reply, PersonRow each, note under the name (staff only, muted, italic)
  actions   staff: "Nudge 4 who haven't replied"
  states    loading, empty sections hidden
  used on   S10
```

## People

```
PersonRow
  variants  player (jersey badge on team-2, position), staff (role), guardian (relationship), invite (email + "Invite sent")
  states    active, invite pending (muted + "Pending" badge + Resend), removed (not shown)
  a11y      row is a link to the profile when allowed; actions in a dropdown menu with aria-label "Options for Maya"
  used on   S10, S12, S14, S21

Avatar
  sizes     24, 32, 40, 64, 96
  states    photo, initials (on team-2 / on-team-2), loading (initials show under the photo,
            so never an empty circle), failed/no photo (falls back to initials, no broken icon)
  source    /api/img/photo/<userId>?v=<profile version>, cached for good, read with the
            viewer's access rules (only people you share a team with)
  a11y      decorative when the name is next to it (alt="")
  used on   roster, player page, RSVP list, carpool, chat, You page preview, Account

ProfilePhoto (Account)
  layout    96 px avatar with a camera badge (the whole avatar is a button) + Add/Change and
            Remove buttons + one status line
  states    empty ("Add a photo"), has photo ("Change photo", Remove), saving, saved, error
            (wrong type, over 20 MB, unreadable, save failed: preview reverts)
  behaviour cropped to a centred square and shrunk to 320 px JPEG in the browser, saved
            straight away (no separate Save)
  a11y      real buttons with labels, file input labelled "Photo file", status line is
            role=status
  used on   Account; the You page links to it

TeamCrest
  sizes     16, 20, 24, 32, 40, 48, 64; radius grows with size (square-ish tile, not a circle,
            so it never reads as a person)
  states    crest image (bg + 1px border so white crests show), no crest (team initials in
            display font, team / on-team colours, scoped with data-team so it's right anywhere)
  source    /api/img/crest/<teamId>?v=<hash>; the team header uses it at 48
  a11y      decorative (the team name is always next to it)
  used on   team header, home team cards, Teams list, Chat list (with a staff/sponsor badge
            in the corner), event cards and My RSVPs (16, replacing the team dot), Account roles

RosterTabs
  content   Players (count) | Staff (count), add FAB for staff, Print
  states    empty ("Add your first player" with paste-a-list option), filled
  used on   S12
```

## Chat and messages

```
MessageBubble
  variants  mine (team / on-team, right), theirs (surface / text, left, author name + avatar on first in a group),
            system ("Coach changed Saturday's game to 11:00", centred, xs muted), poll, deleted ("Message deleted", italic muted)
  attachments  image (rounded, tap to open full screen), video (poster + play), file (icon + name + size)
  states    sending (60% opacity + clock), sent, read (read-by count for staff: "Seen by 14"), failed (danger icon + "Tap to retry"), pinned (pin icon)
  a11y      list is role="log" aria-live="polite"; each message reads "Coach Priya, 9:41: text"
  used on   S16

Composer
  anatomy   + (photo, video, file, GIF, poll), auto-growing textarea (max 6 lines), send button (team)
  states    empty (send disabled), typing, uploading (progress), announcement-only chat for families ("Only coaches can post here")
  a11y      Enter sends on desktop, Shift+Enter new line; send button aria-label "Send"
  used on   S16

ReactionBar
  content   reaction chips with counts under the bubble; long-press / right-click opens a picker of 6
  states    none, mine (team-soft bg + team-ink border)
  a11y      each chip a toggle button "👍 3, you reacted"
  used on   S16

PinnedBar
  anatomy   strip under the header with the latest pin, tap to jump, "2 pinned"
  used on   S16

PollCard
  anatomy   question, options as buttons, results as bars after voting (team-soft fill), total votes
  states    not voted, voted (my option checked), closed
  used on   S16

MessageListItem (subject messages)
  anatomy   subject (600), first line (muted), sender, time, unread dot (team)
  states    unread, read
  used on   S17
```

## Scoring

```
Scoreboard
  anatomy   team crest + name | score (score type, tabular numbers) — score | opponent; period; status badge
  states    not started (– : –), live (live badge, scores update with a short scale), final (FINAL badge)
  staff     big +1 / −1 buttons under each score (52px), period stepper, "End game"
  a11y      live region announces "Score: 2–1" politely; buttons "Add goal for Riverkrest"
  used on   S08, S20
```

## Feedback and overlays

```
Toast
  variants  success, error, info
  states    enter, auto-dismiss 4s (errors stay until closed), with action ("Undo")
  a11y      role="status" (errors: role="alert")
  used on   all

Modal / Sheet
  variants  centred modal ≥ md, bottom sheet < md
  states    open, closing
  a11y      Radix Dialog: focus trap, Esc closes, focus returns to trigger, aria-labelledby title
  used on   S19, confirmations, pickers

EmptyState
  anatomy   Lucide icon in a sunken circle, one-line title, one-line hint, one action
  copy      "No games yet", "Nobody's on the roster yet", "No messages — say hi to the team"
  used on   S02, S03, S07, S11, S12, S16, S17, S18

Skeleton
  shapes    card, row, text lines; shimmer off under reduced motion
  used on   every list while loading

Banner
  variants  info (install the app for notifications), warning (you're offline), danger (couldn't load)
  used on   S02, S22
```

## Checks before building screens

1. `python3 contrast.py tokens.json` — 62 pairs, 0 failing AA.
2. `node --experimental-strip-types team-theme.test.ts` — 16 tricky team colours, light and dark, all pass.
3. The primitives page (`/design` route) shows every component in every state in light and dark, with a team colour switcher; screenshot it at 390px and 1280px.

## Tournaments

Screens (all phone-first, 390 px, same tokens; no new colours):

| ID | Screen | Who |
| --- | --- | --- |
| T1 | Tournaments list: Hosting, Playing in, Invitations | everyone signed in |
| T2 | Host a tournament (create / edit details) | club owners and admins |
| T3 | Tournament dashboard: Overview · Fixtures · Table or Bracket · Teams | entrants, organizers, officials |
| T4 | Teams: invite (search Clbx teams), add a guest team, applications, paid, groups | organizers |
| T5 | Match: score, status, goals and cards | organizers, match officials |
| T6 | Officials: add by email | organizers |
| T7 | Public page /tournament/<slug>: fixtures, results, table, bracket, teams, apply | anyone with the link |

```
TournamentHeader
  content   logo (TeamCrest-style tile, 48), name, format · dates · venue, status pill
            (Draft, Taking teams, Under way, Finished), Share button (public link, copy)
  tokens    surface bg, text, muted; status pill uses success/warning/accent soft tokens
  used on   T3, T7

TournamentCard
  content   logo 40, name, club, dates, format, my role or my team's status
            ("Organizer", "Invited: Kingston Strikers", "Playing")
  states    default, invitation (accent border + Accept / Decline inline)
  a11y      whole card is one link; invitation buttons are separate real buttons
  used on   T1

FormatPicker
  options   League (everyone plays everyone twice), Round-robin (once), Knockout,
            Groups + knockout; radio cards with a one-line explanation
  extra     groups: number of groups, teams that go through per group; league: legs 1 or 2
  a11y      radiogroup, arrow keys move, selection announced
  used on   T2

FixtureRow
  content   time or "Time to be set", home crest+name, score or "v", away crest+name,
            status (Live pulse, FT, Pens 4–3, Postponed), pitch
  states    scheduled, live, finished, postponed, cancelled, TBD slot ("Winner of QF1")
  a11y      link to T5 for officials; announced as "Home 2, Away 1, full time"
  used on   T3, T7; grouped by round ("Round 1", "Group A · Round 2", "Semi-finals")

StandingsTable
  columns   # · Team · P W D L · GF GA GD · Pts (P..GA hidden under 360 px, GD and Pts stay)
  states    empty ("Table fills in as results come in"), qualifying rows (accent edge for
            places that go through in groups + knockout)
  a11y      real <table> with caption, th scope=col, numbers tabular
  used on   T3, T7 (one per group)

Bracket
  layout    rounds as columns, scroll sideways on phones (the only place that may), each
            tie a FixtureRow-mini; winners bold, losers muted
  states    TBD slots, byes ("Bye" and the team goes straight through), champion banner
  a11y      each round is a list with a heading; order reads top to bottom, round by round
  used on   T3, T7

EntryRow (Teams)
  content   crest 32, name, Clbx team or Guest, status (Invited, Applied, In, Declined),
            Paid toggle when there's a fee, group letter when grouped
  actions   Accept / Decline (applications), Remove, Resend invite
  used on   T4

ScoreEntry
  content   two big steppers (−/number/+) for home and away, penalties row appears on a
            knockout draw, status select, Save; goals and cards list with Add (team, player
            name, minute)
  states    saving, saved, error ("Penalties needed: knockout games can't end level")
  a11y      inputs labelled with team names, steppers are buttons with labels
  used on   T5
```

## Home header (S02, 2026-10-26)

```
Home header
  layout    avatar 64px (links to Account) + name in display type + one status line; no big greeting headline
  status    1) pending answers: warning-soft pill "N events need your answer", links to the Needs your answer section
            2) else the next event: "Next: <title> · today 5:30 pm" (links to the event)
            3) else "Nothing on your schedule yet"
  extras    "Add your photo" link while the person has no photo
  tokens    avatar bg team / initials on-team; pill bg warning-soft, icon warning, text fg; name font display 2xl
  a11y      visually hidden h1 "Home"; avatar link labelled "Your account and photo"
```
