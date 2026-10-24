-- Schema: team management clone (rebuild of SportsEngine Team Management core features)
-- Target: Supabase Postgres. Access rules: row level security (RLS) on every table.
-- Times are timestamptz (UTC). Every event also stores the IANA time zone it happens in.
-- Run as the first migration (supabase/migrations/0001_init.sql).

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- shared: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- accounts and people
-- ---------------------------------------------------------------------------

-- One row per signed-up user, same id as auth.users. (S01, S23)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email citext not null unique,
  phone text,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  use_team_colors boolean not null default true,  -- viewer can switch team theming off
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Anyone who can be on a roster: adults with accounts and kids without.
-- user_id is set when the person is the account holder themself. (S14, S21)
create table people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  avatar_path text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on people (created_by);

-- Sensitive fields split out so teammates see a name, not a birthday.
-- Readable only by the person's guardians and staff of teams they're on.
create table people_private (
  person_id uuid primary key references people(id) on delete cascade,
  dob date,
  gender text,
  medical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who can act for a person (answer RSVPs, see their messages).
-- An adult is their own guardian (is_self). The household is "everyone I'm guardian of". (F09)
create table guardians (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_email citext,
  invite_token_hash text unique,
  is_primary boolean not null default false,
  is_self boolean not null default false,
  status text not null default 'invited' check (status in ('invited','active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_target check (user_id is not null or invited_email is not null),
  constraint active_has_user check (status <> 'active' or user_id is not null)
);
create unique index guardians_person_user on guardians (person_id, user_id) where user_id is not null;
create unique index guardians_one_primary on guardians (person_id) where is_primary;
create index on guardians (user_id);
create index on guardians (invited_email) where status = 'invited';

-- ---------------------------------------------------------------------------
-- clubs: a club account inside the one app. When a member opens the app, it takes on
-- their club's name, logo and colours ("Limestone City FC", powered by the platform).
-- One club has many teams; independent teams (club_id null) keep the standard look.
-- ---------------------------------------------------------------------------

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),  -- join link: /c/<slug>
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary text check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  welcome_text text check (length(welcome_text) <= 280),
  sport text,
  location text,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clubs (created_by);

create table club_admins (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index on club_admins (user_id);
create unique index one_club_owner on club_admins (club_id) where role = 'owner';

-- ---------------------------------------------------------------------------
-- teams and rosters
-- ---------------------------------------------------------------------------

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  sport text not null,
  age_group text,
  location text,
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),           -- team primary: themes the team's screens
  color_secondary text check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),                 -- optional accent (stripes, badges)
  logo_path text,                                                                      -- crest in the team storage bucket
  org_name text,
  club_id uuid references clubs(id) on delete set null,   -- null = independent team on the main app
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  is_public boolean not null default true,      -- followers can see schedule and scores
  roster_visible boolean not null default true, -- families can see the roster
  created_by uuid not null references profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on teams (created_by);
create index on teams (club_id);

-- Players and staff. Staff permissions mirror the original's six (S15).
create table roster_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('player','staff')),
  jersey text,
  position text,
  staff_role text check (staff_role in ('head_coach','assistant_coach','manager','other')),
  permissions text[] not null default '{}'
    check (permissions <@ array['edit_settings','roster','schedule_games','schedule_events','scoring','manage_permissions']),
  status text not null default 'invited' check (status in ('invited','active','removed')),
  invited_email citext,
  invite_token_hash text unique,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_role_only_for_staff check (kind = 'staff' or staff_role is null),
  constraint perms_only_for_staff check (kind = 'staff' or permissions = '{}')
);
create unique index roster_one_row_per_kind on roster_members (team_id, person_id, kind) where status <> 'removed';
create index on roster_members (person_id);
create index on roster_members (team_id, kind, status);

-- Fans following a team they're not on (F10).
create table follows (
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index on follows (team_id);

-- ---------------------------------------------------------------------------
-- schedule and RSVPs
-- ---------------------------------------------------------------------------

create table venues (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on venues (team_id);

-- A repeating practice. Occurrences are materialised into events (up to 26 weeks ahead)
-- so RSVPs, cancellations and edits attach to a real row.
create table event_series (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  rrule text not null,          -- RFC 5545, e.g. FREQ=WEEKLY;BYDAY=TU,TH
  tz text not null,             -- IANA zone the wall-clock times are in
  local_start_time time not null,
  duration_minutes int not null check (duration_minutes between 5 and 1440),
  starts_on date not null,
  ends_on date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on event_series (team_id);

create table events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  series_id uuid references event_series(id) on delete set null,
  type text not null check (type in ('game','practice','event')),
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  arrive_at timestamptz,
  tz text not null,
  time_tbd boolean not null default false,
  venue_id uuid references venues(id) on delete set null,
  location_text text,
  opponent text,
  home_away text check (home_away in ('home','away','neutral')),
  notes text,
  status text not null default 'active' check (status in ('active','postponed','cancelled')),
  status_reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_at > start_at),
  constraint opponent_only_for_games check (type = 'game' or (opponent is null and home_away is null))
);
create index on events (team_id, start_at);
create index on events (series_id);
create index on events (venue_id);

-- One answer per person per event; parents answer for kids (responded_by). (F03)
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  response text not null check (response in ('going','not_going','maybe')),
  note text check (length(note) <= 500),   -- visible to staff and the person's guardians only
  responded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, person_id)
);
create index on rsvps (person_id);

-- Live score for a game (F11). version guards against two scorers overwriting each other.
create table scores (
  event_id uuid primary key references events(id) on delete cascade,
  team_score int not null default 0 check (team_score >= 0),
  opponent_score int not null default 0 check (opponent_score >= 0),
  period text,
  status text not null default 'not_started' check (status in ('not_started','live','final')),
  version int not null default 0,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- chat and messages
-- ---------------------------------------------------------------------------

-- Every team gets one 'team' conversation on creation; 'group' and 'direct' are later.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  kind text not null default 'team' check (kind in ('team','group','direct')),
  title text,
  families_can_post boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_team_chat on conversations (team_id) where kind = 'team';

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  client_id uuid not null,    -- generated by the browser; makes retries idempotent
  kind text not null default 'text' check (kind in ('text','poll','system')),
  body text check (length(body) <= 4000),
  attachments jsonb not null default '[]',  -- [{path, mime, size, width, height}]
  pinned_at timestamptz,
  pinned_by uuid references profiles(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, client_id)
);
create index on chat_messages (conversation_id, created_at desc);
create index on chat_messages (conversation_id) where pinned_at is not null;
create index on chat_messages (author_id);

create table chat_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null check (length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index on chat_reactions (user_id);

-- Read receipts as a per-conversation high-water mark, not one row per message.
create table chat_reads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null,
  primary key (conversation_id, user_id)
);
create index on chat_reads (user_id);

create table poll_options (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  label text not null check (length(label) between 1 and 100),
  position int not null,
  unique (message_id, position)
);

create table poll_votes (
  message_id uuid not null references chat_messages(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)   -- single choice; changing a vote is an upsert
);
create index on poll_votes (option_id);
create index on poll_votes (user_id);

-- Email-style messages with a subject (S17).
create table messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  subject text not null check (length(subject) between 1 and 200),
  body text not null,
  to_all boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on messages (team_id, created_at desc);
create index on messages (author_id);

-- Resolved recipients: one row per user at send time (guardians of selected players included).
create table message_recipients (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index on message_recipients (user_id);

-- ---------------------------------------------------------------------------
-- notifications, calendar feeds, outbox
-- ---------------------------------------------------------------------------

create table notification_prefs (
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  push boolean not null default true,
  email boolean not null default true,
  sms boolean not null default false,
  chat_muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index on notification_prefs (team_id);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on push_subscriptions (user_id);

-- Secret iCal feed URLs: one per user (whole household) or per team.
create table calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,  -- null = household feed
  token_hash text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on calendar_feeds (user_id);
create index on calendar_feeds (team_id);

-- Every notification goes through here. dedupe_key makes fan-out idempotent:
-- e.g. 'event_changed:<event_id>:<updated_at>:<user_id>:push'.
create table outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  channel text not null check (channel in ('push','email','sms')),
  user_id uuid references profiles(id) on delete cascade,
  payload jsonb not null,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on outbox (status, run_after) where status = 'pending';
create index on outbox (user_id);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['clubs','profiles','people','people_private','guardians','teams','roster_members',
    'venues','event_series','events','rsvps','scores','conversations','chat_messages','messages','outbox']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- access helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

-- Persons the current user can act for: themself and their kids.
create or replace function my_people() returns setof uuid
language sql stable security definer set search_path = public as $$
  select person_id from guardians where user_id = auth.uid() and status = 'active'
$$;

create or replace function is_guardian(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardians where person_id = p and user_id = auth.uid() and status = 'active')
$$;

-- On the team as a player, staff, or guardian of a player.
create or replace function is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roster_members r
    join guardians g on g.person_id = r.person_id
    where r.team_id = t and r.status = 'active' and g.user_id = auth.uid() and g.status = 'active'
  ) or exists (select 1 from teams where id = t and created_by = auth.uid())
$$;

-- Club admins run every team in their club.
create or replace function is_club_admin_of_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams tm join club_admins ca on ca.club_id = tm.club_id
    where tm.id = t and ca.user_id = auth.uid()
  )
$$;

create or replace function is_club_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_admins where club_id = c and user_id = auth.uid())
$$;

create or replace function is_club_owner(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_admins where club_id = c and user_id = auth.uid() and role = 'owner')
$$;

create or replace function is_team_staff(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roster_members r
    join guardians g on g.person_id = r.person_id and g.is_self
    where r.team_id = t and r.kind = 'staff' and r.status = 'active' and g.user_id = auth.uid() and g.status = 'active'
  ) or exists (select 1 from teams where id = t and created_by = auth.uid())
  or is_club_admin_of_team(t)
$$;

-- The team creator has every permission.
create or replace function has_team_perm(t uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = t and created_by = auth.uid())
  or is_club_admin_of_team(t)
  or exists (
    select 1 from roster_members r
    join guardians g on g.person_id = r.person_id and g.is_self
    where r.team_id = t and r.kind = 'staff' and r.status = 'active'
      and g.user_id = auth.uid() and g.status = 'active' and perm = any (r.permissions)
  )
$$;

create or replace function can_view_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_team_member(t)
  or exists (select 1 from teams where id = t and is_public and archived_at is null)
$$;

create or replace function is_staff_of_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roster_members r where r.person_id = p and r.status <> 'removed' and is_team_staff(r.team_id)
  )
$$;

create or replace function shares_team_with(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roster_members r
    join teams tm on tm.id = r.team_id
    where r.person_id = p and r.status = 'active' and is_team_member(r.team_id)
      and (tm.roster_visible or is_team_staff(r.team_id))
  )
$$;

create or replace function conversation_team(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from conversations where id = c
$$;

-- ---------------------------------------------------------------------------
-- row level security
-- Writes that fan out (create event + notify, send invite, send message) go through
-- server actions using the service role; RLS still guards every direct client read/write.
-- ---------------------------------------------------------------------------

alter table clubs enable row level security;
alter table club_admins enable row level security;
alter table profiles enable row level security;
alter table people enable row level security;
alter table people_private enable row level security;
alter table guardians enable row level security;
alter table teams enable row level security;
alter table roster_members enable row level security;
alter table follows enable row level security;
alter table venues enable row level security;
alter table event_series enable row level security;
alter table events enable row level security;
alter table rsvps enable row level security;
alter table scores enable row level security;
alter table conversations enable row level security;
alter table chat_messages enable row level security;
alter table chat_reactions enable row level security;
alter table chat_reads enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;
alter table messages enable row level security;
alter table message_recipients enable row level security;
alter table notification_prefs enable row level security;
alter table push_subscriptions enable row level security;
alter table calendar_feeds enable row level security;
alter table outbox enable row level security;  -- no policies: service role only

-- clubs: name, logo and colours are public so the club join page shows before sign-in
create policy clubs_read on clubs for select using (true);
create policy clubs_insert on clubs for insert with check (created_by = auth.uid());
create policy clubs_update on clubs for update using (is_club_admin(id)) with check (is_club_admin(id));
create policy club_admins_read on club_admins for select using (user_id = auth.uid() or is_club_admin(club_id));
create policy club_admins_write on club_admins for all using (is_club_owner(club_id)) with check (is_club_owner(club_id));

-- profiles: yourself, plus names of people you share a team with
create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_teammates on profiles for select using (
  exists (select 1 from people p where p.user_id = profiles.id and shares_team_with(p.id))
);

-- people
create policy people_read on people for select using (
  id in (select my_people()) or shares_team_with(id) or is_staff_of_person(id)
);
create policy people_write on people for update using (is_guardian(id)) with check (is_guardian(id));
create policy people_insert on people for insert with check (created_by = auth.uid());

create policy people_private_rw on people_private for all
  using (is_guardian(person_id) or is_staff_of_person(person_id))
  with check (is_guardian(person_id));

-- guardians: see the guardians of people you act for or coach
create policy guardians_read on guardians for select using (
  user_id = auth.uid() or is_guardian(person_id) or is_staff_of_person(person_id)
);

-- teams
create policy teams_read on teams for select using (can_view_team(id));
create policy teams_insert on teams for insert with check (created_by = auth.uid());
create policy teams_update on teams for update
  using (has_team_perm(id, 'edit_settings')) with check (has_team_perm(id, 'edit_settings'));

-- roster
create policy roster_read on roster_members for select using (
  is_team_staff(team_id)
  or person_id in (select my_people())
  or (is_team_member(team_id) and status = 'active'
      and exists (select 1 from teams t where t.id = team_id and t.roster_visible))
);
create policy roster_write on roster_members for all
  using (has_team_perm(team_id, 'roster')) with check (has_team_perm(team_id, 'roster'));

-- follows
create policy follows_self on follows for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and can_view_team(team_id));

-- venues, series, events
create policy venues_read on venues for select using (can_view_team(team_id));
create policy venues_write on venues for all
  using (has_team_perm(team_id, 'schedule_events') or has_team_perm(team_id, 'schedule_games'))
  with check (has_team_perm(team_id, 'schedule_events') or has_team_perm(team_id, 'schedule_games'));

create policy series_read on event_series for select using (is_team_member(team_id));
create policy series_write on event_series for all
  using (has_team_perm(team_id, 'schedule_events')) with check (has_team_perm(team_id, 'schedule_events'));

create policy events_read on events for select using (can_view_team(team_id));
create policy events_write on events for all
  using (has_team_perm(team_id, case when type = 'game' then 'schedule_games' else 'schedule_events' end))
  with check (has_team_perm(team_id, case when type = 'game' then 'schedule_games' else 'schedule_events' end));

-- rsvps: guardians answer for their people; staff can set them too (taking attendance).
-- Responses are visible to the team; notes are stripped for non-staff by the rsvps_public view.
create policy rsvps_read on rsvps for select using (
  person_id in (select my_people())
  or is_team_staff((select team_id from events e where e.id = event_id))
);
create policy rsvps_write on rsvps for all
  using (is_guardian(person_id) or is_team_staff((select team_id from events e where e.id = event_id)))
  with check (
    (is_guardian(person_id) or is_team_staff((select team_id from events e where e.id = event_id)))
    and exists (
      select 1 from events e join roster_members r on r.team_id = e.team_id
      where e.id = event_id and r.person_id = rsvps.person_id and r.status = 'active'
    )
  );

-- Team members see everyone's answer but not the private note.
create view rsvps_public with (security_invoker = false) as
  select r.event_id, r.person_id, r.response, r.updated_at
  from rsvps r join events e on e.id = r.event_id
  where is_team_member(e.team_id);

-- scores
create policy scores_read on scores for select using (
  can_view_team((select team_id from events e where e.id = event_id))
);
create policy scores_write on scores for all
  using (has_team_perm((select team_id from events e where e.id = event_id), 'scoring'))
  with check (has_team_perm((select team_id from events e where e.id = event_id), 'scoring'));

-- chat
create policy conversations_read on conversations for select using (is_team_member(team_id));
create policy conversations_staff on conversations for all
  using (is_team_staff(team_id)) with check (is_team_staff(team_id));

create policy chat_read on chat_messages for select using (is_team_member(conversation_team(conversation_id)));
create policy chat_insert on chat_messages for insert with check (
  author_id = auth.uid()
  and is_team_member(conversation_team(conversation_id))
  and (is_team_staff(conversation_team(conversation_id))
       or exists (select 1 from conversations c where c.id = conversation_id and c.families_can_post))
);
create policy chat_update_own on chat_messages for update
  using (author_id = auth.uid() or is_team_staff(conversation_team(conversation_id)))
  with check (author_id = auth.uid() or is_team_staff(conversation_team(conversation_id)));

create policy reactions_read on chat_reactions for select using (
  exists (select 1 from chat_messages m where m.id = message_id and is_team_member(conversation_team(m.conversation_id)))
);
create policy reactions_own on chat_reactions for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from chat_messages m where m.id = message_id and is_team_member(conversation_team(m.conversation_id))));

create policy reads_read on chat_reads for select using (is_team_member(conversation_team(conversation_id)));
create policy reads_own on chat_reads for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_team_member(conversation_team(conversation_id)));

create policy poll_options_read on poll_options for select using (
  exists (select 1 from chat_messages m where m.id = message_id and is_team_member(conversation_team(m.conversation_id)))
);
create policy poll_options_author on poll_options for insert with check (
  exists (select 1 from chat_messages m where m.id = message_id and m.author_id = auth.uid())
);
create policy poll_votes_read on poll_votes for select using (
  exists (select 1 from chat_messages m where m.id = message_id and is_team_member(conversation_team(m.conversation_id)))
);
create policy poll_votes_own on poll_votes for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from poll_options o join chat_messages m on m.id = o.message_id
    where o.id = option_id and o.message_id = poll_votes.message_id
      and is_team_member(conversation_team(m.conversation_id))));

-- messages: author, staff, and recipients
create policy messages_read on messages for select using (
  author_id = auth.uid() or is_team_staff(team_id)
  or exists (select 1 from message_recipients mr where mr.message_id = messages.id and mr.user_id = auth.uid())
);
create policy recipients_read on message_recipients for select using (
  user_id = auth.uid()
  or exists (select 1 from messages m where m.id = message_id and (m.author_id = auth.uid() or is_team_staff(m.team_id)))
);
create policy recipients_mark_read on message_recipients for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- personal settings
create policy prefs_own on notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy feeds_own on calendar_feeds for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- realtime: tables the browser subscribes to
-- ---------------------------------------------------------------------------
-- alter publication supabase_realtime add table chat_messages, chat_reactions, chat_reads, poll_votes, scores, rsvps, events;
