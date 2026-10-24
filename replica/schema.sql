-- Schema: team and club app for ADULT players (rebuild of SportsEngine Team Management's
-- core loop, extended with club operations: attendance, availability, carpools, dues,
-- seasons, points, results and player of the match).
-- Every player has their own account. No guardians, no child profiles.
-- Target: Supabase Postgres. Access rules: row level security (RLS) on every table.
-- Times are timestamptz (UTC); every event also stores the IANA zone it happens in.
-- Money is integer cents plus a currency code.

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email citext not null unique,
  phone text,
  avatar_path text,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  use_team_colors boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Emergency contact and health notes: the player and staff of their teams only.
create table member_private (
  user_id uuid primary key references profiles(id) on delete cascade,
  emergency_name text,
  emergency_phone text,
  medical_notes text check (length(medical_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- clubs: the app takes on a club's name, logo and colours for its members
-- ---------------------------------------------------------------------------

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary text check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  welcome_text text check (length(welcome_text) <= 280),
  sport text,
  location text,
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clubs (created_by);

create table club_admins (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','treasurer')),
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
  club_id uuid references clubs(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  sport text not null,
  level text,                                   -- e.g. Premier division, Over-35s, Rec
  location text,
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  color_secondary text check (color_secondary ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  is_public boolean not null default true,      -- followers see games and scores
  roster_visible boolean not null default true, -- teammates see each other
  members_can_post boolean not null default true,
  -- Points: off unless the team turns it on. Rules are numbers, applied when attendance is recorded.
  points_enabled boolean not null default false,
  points_public boolean not null default true,  -- leaderboard visible to the whole team
  -- Geo check-in: off unless the team turns it on. Players tap "I'm here" at the venue.
  geo_checkin_enabled boolean not null default false,
  points_rules jsonb not null default '{"training":1,"match":2,"away_bonus":10,"late_penalty":-1,"late_after_minutes":15,"excused":0,"potm":3}',
  created_by uuid not null references profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on teams (created_by);
create index on teams (club_id);

-- One row per person per team. Hats stack: the same person can be a player (is_player),
-- captain and manager at once (roles), and what they can do comes from permissions.
-- Club-level hats (owner, admin, treasurer) live in club_admins, so one account covers it all.
create table roster_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,      -- null until the invite is accepted
  invited_email citext,
  invite_token_hash text unique,
  invited_name text,
  is_player boolean not null default true,
  roles text[] not null default '{}'
    check (roles <@ array['captain','vice_captain','coach','manager','treasurer']),
  jersey text,
  position text,
  permissions text[] not null default '{}'
    check (permissions <@ array['edit_settings','roster','schedule_games','schedule_events','attendance','scoring','payments','messages','manage_permissions']),
  status text not null default 'invited' check (status in ('invited','active','inactive','removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_target check (user_id is not null or invited_email is not null),
  constraint active_has_user check (status not in ('active','inactive') or user_id is not null),
  constraint plays_or_has_a_role check (is_player or cardinality(roles) > 0)
);
create unique index roster_one_per_user on roster_members (team_id, user_id) where user_id is not null and status <> 'removed';
create unique index roster_one_invite on roster_members (team_id, invited_email) where status = 'invited';
create index on roster_members (user_id);
create index on roster_members (team_id, status);

-- Editing the roster isn't the same as handing out power: changing someone's roles or
-- permissions needs manage_permissions (the team creator and club admins have it).
create or replace function guard_roster_perms() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- service role
  if (tg_op = 'INSERT' and (cardinality(new.permissions) > 0 or cardinality(new.roles) > 0))
     or (tg_op = 'UPDATE' and (new.permissions is distinct from old.permissions or new.roles is distinct from old.roles)) then
    if not has_team_perm(new.team_id, 'manage_permissions') then
      raise exception 'Only someone who manages permissions can change roles' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;
create trigger roster_perms_guard before insert or update on roster_members
  for each row execute function guard_roster_perms();

create table follows (
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index on follows (team_id);

-- Away, injured or on vacation: skipped for reminders and shown as unavailable.
-- team_id null = all of the player's teams. Teammates see "unavailable"; the reason and
-- note are for the player and staff (see the availability_public view).
create table availability_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  kind text not null check (kind in ('away','injured','vacation','other')),
  starts_on date not null,
  ends_on date,
  note text check (length(note) <= 200),
  set_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ends_after_starts check (ends_on is null or ends_on >= starts_on)
);
create index on availability_periods (user_id, starts_on);
create index on availability_periods (team_id);

-- ---------------------------------------------------------------------------
-- seasons and schedule
-- ---------------------------------------------------------------------------

create table seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),   -- "Summer 2026"
  starts_on date not null,
  ends_on date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on seasons (team_id, starts_on);
create unique index one_open_season on seasons (team_id) where closed_at is null;

create table venues (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  address text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  -- How close counts as "at the venue". Big parks need more than a gym.
  check_in_radius_m int not null default 150 check (check_in_radius_m between 50 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lat_lng_together check ((lat is null) = (lng is null))
);
create index on venues (team_id);

create table event_series (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  rrule text not null,
  tz text not null,
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
  season_id uuid references seasons(id) on delete set null,
  series_id uuid references event_series(id) on delete set null,
  type text not null check (type in ('training','match','tournament','social','other')),
  competition text check (competition in ('league','cup','friendly','tournament')),
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  meet_at timestamptz,
  tz text not null,
  time_tbd boolean not null default false,
  venue_id uuid references venues(id) on delete set null,
  location_text text,
  opponent text,
  home_away text check (home_away in ('home','away','neutral')),
  notes text,
  squad_size int check (squad_size between 1 and 60),   -- how many the captain needs
  status text not null default 'active' check (status in ('active','postponed','cancelled')),
  status_reason text,
  potm_open boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_at > start_at),
  constraint opponent_only_for_matches check (type in ('match','tournament') or (opponent is null and home_away is null))
);
create index on events (team_id, start_at);
create index on events (season_id);
create index on events (series_id);
create index on events (venue_id);

-- Someone put in charge of one event (an away trip, a tournament) without team-wide rights.
create table event_managers (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  permissions text[] not null default '{attendance,scoring}'
    check (permissions <@ array['attendance','scoring','edit_event','carpools']),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index on event_managers (user_id);

-- What players said they'd do.
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  response text not null check (response in ('going','not_going','maybe')),
  note text check (length(note) <= 500),
  responded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on rsvps (user_id);

-- What actually happened, recorded by staff or the event manager.
create table attendance (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null check (status in ('present','late','absent','excused')),
  minutes_late int check (minutes_late between 0 and 600),
  -- 'geo' = the player checked in at the venue; 'staff' = a captain or event manager marked it.
  -- We keep how far away and how accurate the fix was, never the coordinates themselves.
  method text not null default 'staff' check (method in ('staff','geo')),
  checked_in_at timestamptz,
  distance_m int check (distance_m >= 0),
  accuracy_m int check (accuracy_m >= 0),
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint late_has_minutes check (status <> 'late' or minutes_late is not null),
  constraint geo_has_fix check (method <> 'geo' or (checked_in_at is not null and distance_m is not null and accuracy_m is not null))
);
create index on attendance (user_id);

-- Geo check-in. The phone sends one location fix; we work out the distance here and store only
-- the distance and accuracy. Opens 60 minutes before the start and closes at the end.
-- A mark a captain already made wins: check-in never overwrites a staff row.
create or replace function check_in(p_event uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision)
returns table (status text, minutes_late int, distance_m int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  e events%rowtype; v venues%rowtype; t teams%rowtype;
  d double precision; late_after int; mins int; st text; existing attendance%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = 'insufficient_privilege'; end if;
  select * into e from events where id = p_event;
  if not found then raise exception 'Event not found' using errcode = 'no_data_found'; end if;
  select * into t from teams where id = e.team_id;
  if not exists (select 1 from roster_members r where r.team_id = e.team_id and r.user_id = auth.uid()
                 and r.status = 'active' and r.is_player) then
    raise exception 'Only players on this team can check in' using errcode = 'insufficient_privilege';
  end if;
  if not t.geo_checkin_enabled then raise exception 'Check-in is off for this team' using errcode = 'check_violation'; end if;
  if e.status <> 'active' then raise exception 'This event is %', e.status using errcode = 'check_violation'; end if;
  if now() < e.start_at - interval '60 minutes' then raise exception 'Check-in opens an hour before the start' using errcode = 'check_violation'; end if;
  if now() > e.end_at then raise exception 'Check-in has closed' using errcode = 'check_violation'; end if;
  select * into v from venues where id = e.venue_id;
  if v.lat is null then raise exception 'This venue has no map pin yet' using errcode = 'check_violation'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Bad location' using errcode = 'invalid_parameter_value';
  end if;
  if p_accuracy_m is null or p_accuracy_m > 200 then
    raise exception 'Your location is too rough (± % m). Step outside and try again, or ask your captain.', round(coalesce(p_accuracy_m, 0))
      using errcode = 'check_violation';
  end if;
  -- Haversine, metres.
  d := 2 * 6371000 * asin(sqrt(
         power(sin(radians(p_lat - v.lat) / 2), 2)
       + cos(radians(v.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - v.lng) / 2), 2)));
  if d > v.check_in_radius_m then
    raise exception 'You''re % m from %. Check in when you get there.', round(d), v.name using errcode = 'check_violation';
  end if;

  select * into existing from attendance a where a.event_id = p_event and a.user_id = auth.uid();
  if found and existing.method = 'staff' then
    return query select existing.status, existing.minutes_late, round(d)::int;
    return;
  end if;
  if found and existing.method = 'geo' then   -- already checked in: first check-in time stands
    return query select existing.status, existing.minutes_late, existing.distance_m;
    return;
  end if;

  late_after := coalesce((t.points_rules->>'late_after_minutes')::int, 15);
  mins := greatest(0, floor(extract(epoch from (now() - e.start_at)) / 60))::int;
  st := case when mins >= late_after then 'late' else 'present' end;
  insert into attendance (event_id, user_id, status, minutes_late, method, checked_in_at, distance_m, accuracy_m, recorded_by)
  values (p_event, auth.uid(), st, case when st = 'late' then mins end, 'geo', now(), round(d)::int, round(p_accuracy_m)::int, auth.uid());
  return query select st, case when st = 'late' then mins end, round(d)::int;
end $$;
revoke all on function check_in(uuid, double precision, double precision, double precision) from public;
grant execute on function check_in(uuid, double precision, double precision, double precision) to authenticated;

-- Live score and result.
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

create table match_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  minute int check (minute between 0 and 200),
  kind text not null check (kind in ('goal','own_goal','assist','yellow','red','sub_on','sub_off','wicket','note')),
  side text not null default 'us' check (side in ('us','them')),
  user_id uuid references profiles(id) on delete set null,   -- our player, when known
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on match_events (event_id);
create index on match_events (user_id);

-- Player of the match: one vote per player who played; no voting for yourself.
create table potm_votes (
  event_id uuid not null references events(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  nominee_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, voter_id),
  constraint no_self_vote check (voter_id <> nominee_id)
);
create index on potm_votes (nominee_id);

-- ---------------------------------------------------------------------------
-- points: a ledger, so every change is explained and can be reversed
-- ---------------------------------------------------------------------------

create table points_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  season_id uuid references seasons(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  points int not null check (points between -100 and 100),
  reason text not null check (reason in ('training','match','away_bonus','late_penalty','potm','manual')),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Automatic rows are unique per event and reason, so re-recording attendance can't double-award.
create unique index points_once_per_reason on points_ledger (event_id, user_id, reason) where reason <> 'manual';
create index on points_ledger (team_id, season_id, user_id);

-- ---------------------------------------------------------------------------
-- carpools
-- ---------------------------------------------------------------------------

create table ride_offers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  driver_id uuid not null references profiles(id) on delete cascade,
  seats int not null check (seats between 1 and 8),
  leaves_from text not null check (length(leaves_from) <= 120),
  leaves_at timestamptz,
  return_trip boolean not null default true,
  note text check (length(note) <= 200),
  status text not null default 'open' check (status in ('open','full','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, driver_id)
);
create index on ride_offers (event_id);

create table ride_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  rider_id uuid not null references profiles(id) on delete cascade,
  pickup_area text check (length(pickup_area) <= 120),
  offer_id uuid references ride_offers(id) on delete set null,
  status text not null default 'looking' check (status in ('looking','matched','cancelled')),
  picked_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, rider_id),
  constraint matched_has_offer check (status <> 'matched' or offer_id is not null)
);
create index on ride_requests (offer_id);
create index on ride_requests (rider_id);

-- Seats are a database rule, not a UI rule: block a match beyond the driver's seats.
create or replace function check_ride_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; taken int;
begin
  if new.status = 'matched' and new.offer_id is not null then
    select seats into cap from ride_offers where id = new.offer_id for update;
    select count(*) into taken from ride_requests
      where offer_id = new.offer_id and status = 'matched' and id <> new.id;
    if cap is null or taken >= cap then
      raise exception 'This car is full' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger ride_seats before insert or update on ride_requests
  for each row execute function check_ride_seats();

-- ---------------------------------------------------------------------------
-- dues: manual tracking (cash, e-Transfer). No card payments in this version.
-- ---------------------------------------------------------------------------

create table fees (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  season_id uuid references seasons(id) on delete set null,
  name text not null check (length(name) between 1 and 80),   -- "Season fee", "Kit", "Tournament entry"
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  due_on date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on fees (team_id, season_id);

-- What each player owes for a fee (lets a captain waive or discount one player).
create table dues (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references fees(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  waived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fee_id, user_id)
);
create index on dues (user_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references dues(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  method text not null check (method in ('etransfer','cash','card_elsewhere','other')),
  paid_on date not null,
  reference text check (length(reference) <= 80),
  reported_by uuid references profiles(id) on delete set null,   -- the player can report "I sent it"
  verified_by uuid references profiles(id) on delete set null,   -- only someone with payments permission
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_pair check ((verified_by is null) = (verified_at is null))
);
create index on payments (due_id);

-- ---------------------------------------------------------------------------
-- chat and messages
-- ---------------------------------------------------------------------------

create table conversations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  kind text not null default 'team' check (kind in ('team','staff','event','direct')),
  event_id uuid references events(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_team_chat on conversations (team_id) where kind = 'team';
create unique index one_staff_chat on conversations (team_id) where kind = 'staff';

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  client_id uuid not null,
  reply_to uuid references chat_messages(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','poll','system')),
  body text check (length(body) <= 4000),
  attachments jsonb not null default '[]',
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
  primary key (message_id, user_id)
);
create index on poll_votes (option_id);
create index on poll_votes (user_id);

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
  reminders boolean not null default true,
  chat text not null default 'mentions' check (chat in ('all','mentions','off')),
  live_scores boolean not null default true,
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

create table calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,   -- null = all my teams
  token_hash text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on calendar_feeds (user_id);
create index on calendar_feeds (team_id);

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
  foreach t in array array['profiles','member_private','clubs','teams','roster_members','availability_periods',
    'seasons','venues','event_series','events','rsvps','attendance','scores','ride_offers','ride_requests',
    'fees','dues','payments','conversations','chat_messages','messages','outbox']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- access helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function is_club_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_admins where club_id = c and user_id = auth.uid())
$$;

create or replace function is_club_owner(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_admins where club_id = c and user_id = auth.uid() and role = 'owner')
$$;

create or replace function is_club_admin_of_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams tm join club_admins ca on ca.club_id = tm.club_id
    where tm.id = t and ca.user_id = auth.uid() and ca.role in ('owner','admin')
  )
$$;

create or replace function is_club_treasurer_of_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams tm join club_admins ca on ca.club_id = tm.club_id
    where tm.id = t and ca.user_id = auth.uid()
  )
$$;

create or replace function is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roster_members r
    where r.team_id = t and r.user_id = auth.uid() and r.status in ('active','inactive')
  )
  or exists (select 1 from teams where id = t and created_by = auth.uid())
  or is_club_admin_of_team(t)
$$;

create or replace function has_team_perm(t uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = t and created_by = auth.uid())
  or is_club_admin_of_team(t)
  or (perm = 'payments' and is_club_treasurer_of_team(t))
  or exists (
    select 1 from roster_members r
    where r.team_id = t and r.user_id = auth.uid() and r.status = 'active' and perm = any (r.permissions)
  )
$$;

-- Staff = anyone with at least one permission on the team.
create or replace function is_team_staff(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = t and created_by = auth.uid())
  or is_club_admin_of_team(t)
  or exists (
    select 1 from roster_members r
    where r.team_id = t and r.user_id = auth.uid() and r.status = 'active' and r.permissions <> '{}'
  )
$$;

create or replace function event_team(e uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from events where id = e
$$;

-- Team-wide permission, or this person manages this one event.
create or replace function has_event_perm(e uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select has_team_perm(event_team(e), perm)
  or exists (select 1 from event_managers m where m.event_id = e and m.user_id = auth.uid() and perm = any (m.permissions))
$$;

create or replace function played_in(e uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from attendance where event_id = e and user_id = u and status in ('present','late'))
$$;

create or replace function can_view_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_team_member(t)
  or exists (select 1 from teams where id = t and is_public and archived_at is null)
$$;

-- Teammates: share an active team where the roster is visible (or I'm staff there).
create or replace function shares_team_with(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid() or exists (
    select 1 from roster_members r join teams tm on tm.id = r.team_id
    where r.user_id = u and r.status in ('active','inactive') and is_team_member(r.team_id)
      and (tm.roster_visible or is_team_staff(r.team_id))
  )
$$;

create or replace function is_staff_of_user(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roster_members r where r.user_id = u and r.status <> 'removed' and is_team_staff(r.team_id)
  )
$$;

create or replace function conversation_team(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from conversations where id = c
$$;

create or replace function can_read_conversation(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case (select kind from conversations where id = c)
    when 'staff' then is_team_staff(conversation_team(c))
    else is_team_member(conversation_team(c))
  end
$$;

create or replace function fee_team(f uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from fees where id = f
$$;

create or replace function due_team(d uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select f.team_id from dues du join fees f on f.id = du.fee_id where du.id = d
$$;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','member_private','clubs','club_admins','teams','roster_members','follows',
    'availability_periods','seasons','venues','event_series','events','event_managers','rsvps','attendance',
    'scores','match_events','potm_votes','points_ledger','ride_offers','ride_requests','fees','dues','payments',
    'conversations','chat_messages','chat_reactions','chat_reads','poll_options','poll_votes','messages',
    'message_recipients','notification_prefs','push_subscriptions','calendar_feeds','outbox']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
-- outbox has no policies: service role only.

-- profiles
create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_teammates on profiles for select using (shares_team_with(id) or is_staff_of_user(id));

create policy private_self on member_private for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy private_staff on member_private for select using (is_staff_of_user(user_id));

-- clubs
create policy clubs_read on clubs for select using (true);
create policy clubs_insert on clubs for insert with check (created_by = auth.uid());
create policy clubs_update on clubs for update using (is_club_admin(id)) with check (is_club_admin(id));
create policy club_admins_read on club_admins for select using (user_id = auth.uid() or is_club_admin(club_id));
create policy club_admins_write on club_admins for all using (is_club_owner(club_id)) with check (is_club_owner(club_id));

-- teams
create policy teams_read on teams for select using (can_view_team(id));
create policy teams_insert on teams for insert with check (
  created_by = auth.uid() and (club_id is null or is_club_admin(club_id))
);
create policy teams_update on teams for update
  using (has_team_perm(id, 'edit_settings')) with check (has_team_perm(id, 'edit_settings'));

-- roster
create policy roster_read on roster_members for select using (
  user_id = auth.uid()
  or is_team_staff(team_id)
  or (is_team_member(team_id) and status in ('active','inactive')
      and exists (select 1 from teams t where t.id = team_id and t.roster_visible))
);
create policy roster_write on roster_members for all
  using (has_team_perm(team_id, 'roster')) with check (has_team_perm(team_id, 'roster'));

create policy follows_self on follows for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and can_view_team(team_id));

-- availability: own rows, staff rows; teammates read through availability_public
create policy avail_own on availability_periods for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and (team_id is null or is_team_member(team_id)));
create policy avail_staff on availability_periods for all
  using (is_staff_of_user(user_id)) with check (is_staff_of_user(user_id));

create view availability_public with (security_invoker = false) as
  select a.user_id, a.team_id, a.starts_on, a.ends_on
  from availability_periods a
  where shares_team_with(a.user_id);

-- seasons, venues, series, events
create policy seasons_read on seasons for select using (is_team_member(team_id));
create policy seasons_write on seasons for all
  using (has_team_perm(team_id, 'edit_settings')) with check (has_team_perm(team_id, 'edit_settings'));

create policy venues_read on venues for select using (can_view_team(team_id));
create policy venues_write on venues for all
  using (has_team_perm(team_id, 'schedule_events') or has_team_perm(team_id, 'schedule_games'))
  with check (has_team_perm(team_id, 'schedule_events') or has_team_perm(team_id, 'schedule_games'));

create policy series_read on event_series for select using (is_team_member(team_id));
create policy series_write on event_series for all
  using (has_team_perm(team_id, 'schedule_events')) with check (has_team_perm(team_id, 'schedule_events'));

-- Followers see matches only; members see everything.
create policy events_read on events for select using (
  is_team_member(team_id) or (type in ('match','tournament') and can_view_team(team_id))
);
create policy events_write on events for all
  using (has_team_perm(team_id, case when type in ('match','tournament') then 'schedule_games' else 'schedule_events' end))
  with check (has_team_perm(team_id, case when type in ('match','tournament') then 'schedule_games' else 'schedule_events' end));
create policy events_manager_update on events for update
  using (exists (select 1 from event_managers m where m.event_id = id and m.user_id = auth.uid() and 'edit_event' = any (m.permissions)))
  with check (exists (select 1 from event_managers m where m.event_id = id and m.user_id = auth.uid() and 'edit_event' = any (m.permissions)));

create policy managers_read on event_managers for select using (is_team_member(event_team(event_id)));
create policy managers_write on event_managers for all
  using (has_team_perm(event_team(event_id), 'schedule_events') or has_team_perm(event_team(event_id), 'schedule_games'))
  with check (has_team_perm(event_team(event_id), 'schedule_events') or has_team_perm(event_team(event_id), 'schedule_games'));

-- rsvps: answer for yourself; staff can set them (e.g. a player who texted the captain)
create policy rsvps_read on rsvps for select using (user_id = auth.uid() or is_team_staff(event_team(event_id)));
create policy rsvps_write on rsvps for all
  using (user_id = auth.uid() or is_team_staff(event_team(event_id)))
  with check (
    (user_id = auth.uid() or is_team_staff(event_team(event_id)))
    and exists (select 1 from roster_members r where r.team_id = event_team(event_id)
                and r.user_id = rsvps.user_id and r.status = 'active' and r.is_player)
  );

create view rsvps_public with (security_invoker = false) as
  select r.event_id, r.user_id, r.response, r.updated_at
  from rsvps r where is_team_member(event_team(r.event_id));

-- attendance: own row, plus whoever can record attendance for that event
create policy attendance_read on attendance for select
  using (user_id = auth.uid() or is_team_staff(event_team(event_id)) or has_event_perm(event_id, 'attendance'));
create policy attendance_write on attendance for all
  using (has_event_perm(event_id, 'attendance')) with check (has_event_perm(event_id, 'attendance'));

-- scores and match events
create policy scores_read on scores for select using (can_view_team(event_team(event_id)));
create policy scores_write on scores for all
  using (has_event_perm(event_id, 'scoring')) with check (has_event_perm(event_id, 'scoring'));
create policy match_events_read on match_events for select using (can_view_team(event_team(event_id)));
create policy match_events_write on match_events for all
  using (has_event_perm(event_id, 'scoring')) with check (has_event_perm(event_id, 'scoring'));

-- player of the match: vote once, only if you were marked present or late, only while open
create policy potm_own on potm_votes for select using (voter_id = auth.uid() or is_team_staff(event_team(event_id)));
create policy potm_vote on potm_votes for insert with check (
  voter_id = auth.uid()
  and exists (select 1 from events e where e.id = event_id and e.potm_open)
  and played_in(event_id, auth.uid())
  and played_in(event_id, nominee_id)
);
create policy potm_change on potm_votes for update using (voter_id = auth.uid()) with check (voter_id = auth.uid());

create view potm_results with (security_invoker = false) as
  select v.event_id, v.nominee_id, count(*) as votes
  from potm_votes v join events e on e.id = v.event_id
  where is_team_member(e.team_id) and not e.potm_open
  group by v.event_id, v.nominee_id;

-- points: own rows; whole team if the leaderboard is public; staff all. Written by staff
-- (manual) or by the server action that records attendance (automatic, service role).
create policy points_read on points_ledger for select using (
  user_id = auth.uid() or is_team_staff(team_id)
  or (is_team_member(team_id) and exists (select 1 from teams t where t.id = team_id and t.points_enabled and t.points_public))
);
create policy points_manual on points_ledger for insert with check (
  reason = 'manual' and created_by = auth.uid() and has_team_perm(team_id, 'attendance')
);

-- carpools: anyone on the team; drivers manage their offer; riders their request
create policy offers_read on ride_offers for select using (is_team_member(event_team(event_id)));
create policy offers_own on ride_offers for all
  using (driver_id = auth.uid() or has_event_perm(event_id, 'carpools') or is_team_staff(event_team(event_id)))
  with check ((driver_id = auth.uid() and is_team_member(event_team(event_id))) or has_event_perm(event_id, 'carpools') or is_team_staff(event_team(event_id)));
create policy requests_read on ride_requests for select using (is_team_member(event_team(event_id)));
create policy requests_own on ride_requests for all
  using (rider_id = auth.uid()
         or exists (select 1 from ride_offers o where o.id = offer_id and o.driver_id = auth.uid())
         or has_event_perm(event_id, 'carpools') or is_team_staff(event_team(event_id)))
  with check ((rider_id = auth.uid() and is_team_member(event_team(event_id)))
         or exists (select 1 from ride_offers o where o.id = offer_id and o.driver_id = auth.uid())
         or has_event_perm(event_id, 'carpools') or is_team_staff(event_team(event_id)));

-- dues: players see their own; the payments permission sees and verifies all
create policy fees_read on fees for select using (is_team_member(team_id));
create policy fees_write on fees for all using (has_team_perm(team_id, 'payments')) with check (has_team_perm(team_id, 'payments'));
create policy dues_read on dues for select using (user_id = auth.uid() or has_team_perm(fee_team(fee_id), 'payments'));
create policy dues_write on dues for all using (has_team_perm(fee_team(fee_id), 'payments')) with check (has_team_perm(fee_team(fee_id), 'payments'));
create policy payments_read on payments for select using (
  exists (select 1 from dues d where d.id = due_id and d.user_id = auth.uid()) or has_team_perm(due_team(due_id), 'payments')
);
-- A player may report a payment for their own due, never as verified.
create policy payments_report on payments for insert with check (
  (reported_by = auth.uid() and verified_by is null
   and exists (select 1 from dues d where d.id = due_id and d.user_id = auth.uid()))
  or has_team_perm(due_team(due_id), 'payments')
);
create policy payments_verify on payments for update
  using (has_team_perm(due_team(due_id), 'payments')) with check (has_team_perm(due_team(due_id), 'payments'));
create policy payments_delete on payments for delete using (has_team_perm(due_team(due_id), 'payments'));

-- chat
create policy conversations_read on conversations for select using (can_read_conversation(id));
create policy conversations_staff on conversations for all using (is_team_staff(team_id)) with check (is_team_staff(team_id));

create policy chat_read on chat_messages for select using (can_read_conversation(conversation_id));
create policy chat_insert on chat_messages for insert with check (
  author_id = auth.uid() and can_read_conversation(conversation_id)
  and (is_team_staff(conversation_team(conversation_id))
       or exists (select 1 from teams t where t.id = conversation_team(conversation_id) and t.members_can_post))
);
create policy chat_update on chat_messages for update
  using (author_id = auth.uid() or is_team_staff(conversation_team(conversation_id)))
  with check (author_id = auth.uid() or is_team_staff(conversation_team(conversation_id)));

create policy reactions_read on chat_reactions for select using (
  exists (select 1 from chat_messages m where m.id = message_id and can_read_conversation(m.conversation_id))
);
create policy reactions_own on chat_reactions for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from chat_messages m where m.id = message_id and can_read_conversation(m.conversation_id)));
create policy reads_read on chat_reads for select using (can_read_conversation(conversation_id));
create policy reads_own on chat_reads for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and can_read_conversation(conversation_id));
create policy poll_options_read on poll_options for select using (
  exists (select 1 from chat_messages m where m.id = message_id and can_read_conversation(m.conversation_id))
);
create policy poll_options_author on poll_options for insert with check (
  exists (select 1 from chat_messages m where m.id = message_id and m.author_id = auth.uid())
);
create policy poll_votes_read on poll_votes for select using (
  exists (select 1 from chat_messages m where m.id = message_id and can_read_conversation(m.conversation_id))
);
create policy poll_votes_own on poll_votes for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from poll_options o join chat_messages m on m.id = o.message_id
    where o.id = option_id and o.message_id = poll_votes.message_id and can_read_conversation(m.conversation_id)));

-- messages
create policy messages_read on messages for select using (
  author_id = auth.uid() or is_team_staff(team_id)
  or exists (select 1 from message_recipients mr where mr.message_id = messages.id and mr.user_id = auth.uid())
);
create policy recipients_read on message_recipients for select using (
  user_id = auth.uid()
  or exists (select 1 from messages m where m.id = message_id and (m.author_id = auth.uid() or is_team_staff(m.team_id)))
);
create policy recipients_mark_read on message_recipients for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- personal settings
create policy prefs_own on notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy feeds_own on calendar_feeds for select using (user_id = auth.uid());

-- realtime:
-- alter publication supabase_realtime add table chat_messages, chat_reactions, chat_reads, poll_votes, scores, match_events, rsvps, events, ride_offers, ride_requests;

-- ---------------------------------------------------------------------------
-- sponsors: a business backing a team or a whole club. They get a tier badge and a
-- sponsor view of the main events (fixtures, results, news the team chooses to share).
-- They are NOT team members: rosters, chat, attendance, dues, injuries and contact
-- details stay closed to them by the policies above. Everything they see comes through
-- the two security-definer functions below, which return only sponsor-safe columns.
-- ---------------------------------------------------------------------------

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,     -- a club sponsor backs every club team
  team_id uuid references teams(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  tier text not null check (tier in ('diamond','platinum','gold','silver','bronze')),
  logo_url text,
  website text check (website is null or website ~* '^https?://'),
  blurb text check (length(blurb) <= 200),
  contact_user_id uuid references profiles(id) on delete set null,   -- who signs in for the sponsor
  invited_email citext,
  invite_token_hash text unique,
  status text not null default 'invited' check (status in ('invited','active','ended')),
  starts_on date,
  ends_on date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_scope check ((club_id is null) <> (team_id is null)),
  constraint contact_or_invite check (contact_user_id is not null or invited_email is not null),
  constraint dates_in_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index on sponsors (team_id);
create index on sponsors (club_id);
create index on sponsors (contact_user_id);
create trigger sponsors_updated before update on sponsors for each row execute function set_updated_at();

-- Captains choose per event; empty means "the usual": matches, tournaments and socials yes, trainings no.
alter table events add column sponsor_visible boolean;
-- Announcements can go to sponsors too.
alter table messages add column to_sponsors boolean not null default false;

create or replace function tier_rank(t text) returns int
language sql immutable as $$
  select case t when 'diamond' then 1 when 'platinum' then 2 when 'gold' then 3 when 'silver' then 4 else 5 end
$$;

-- Am I the active contact for a sponsor of this team (directly, or through its club)?
create or replace function is_sponsor_of_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sponsors s left join teams tm on tm.id = t
    where s.contact_user_id = auth.uid() and s.status = 'active'
      and (s.ends_on is null or s.ends_on >= current_date)
      and (s.team_id = t or (s.club_id is not null and s.club_id = tm.club_id))
  )
$$;

create or replace function can_manage_sponsors(p_team uuid, p_club uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_team is not null then has_team_perm(p_team, 'edit_settings') else is_club_admin(p_club) end
$$;

alter table sponsors enable row level security;
-- The sponsor contact sees their own row; whoever runs the team or club sees and edits all of them.
create policy sponsors_read on sponsors for select using (contact_user_id = auth.uid() or can_manage_sponsors(team_id, club_id));
create policy sponsors_write on sponsors for all
  using (can_manage_sponsors(team_id, club_id)) with check (can_manage_sponsors(team_id, club_id));

-- What anyone may see about a team's sponsors (the strip on team and club pages): no emails.
create or replace view sponsors_public with (security_invoker = false) as
  select s.id, s.club_id, s.team_id, s.name, s.tier, s.logo_url, s.website, s.blurb
  from sponsors s
  where s.status = 'active' and (s.ends_on is null or s.ends_on >= current_date)
  order by tier_rank(s.tier), s.name;
grant select on sponsors_public to anon, authenticated;

-- The sponsor view: main events only, with sponsor-safe columns. No notes, no answers,
-- no squad list. Results show the score and the player of the match once voting closes.
create or replace function sponsor_feed(p_team uuid)
returns table (event_id uuid, type text, title text, opponent text, home_away text, competition text,
               start_at timestamptz, end_at timestamptz, tz text, venue_name text, status text,
               team_score int, opponent_score int, score_status text, player_of_match text)
language sql stable security definer set search_path = public as $$
  select e.id, e.type, e.title, e.opponent, e.home_away, e.competition, e.start_at, e.end_at, e.tz,
         v.name, e.status, sc.team_score, sc.opponent_score, sc.status,
         case when not e.potm_open then (
           select p.first_name || ' ' || p.last_name from potm_votes pv join profiles p on p.id = pv.nominee_id
           where pv.event_id = e.id group by p.id, p.first_name, p.last_name order by count(*) desc limit 1) end
  from events e
  left join venues v on v.id = e.venue_id
  left join scores sc on sc.event_id = e.id
  where e.team_id = p_team
    and (is_sponsor_of_team(p_team) or is_team_member(p_team))
    and coalesce(e.sponsor_visible, e.type in ('match','tournament','social'))
    and e.start_at > now() - interval '120 days'
  order by e.start_at
$$;

create or replace function sponsor_news(p_team uuid)
returns table (message_id uuid, subject text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.subject, m.body, m.created_at from messages m
  where m.team_id = p_team and m.to_sponsors and (is_sponsor_of_team(p_team) or is_team_member(p_team))
  order by m.created_at desc limit 20
$$;
revoke all on function sponsor_feed(uuid), sponsor_news(uuid) from public;
grant execute on function sponsor_feed(uuid), sponsor_news(uuid) to authenticated;
