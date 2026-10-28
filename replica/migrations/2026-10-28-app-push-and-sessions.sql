-- 1) Phones that get push notifications from the Clbx app (one row per device token; the
--    token moves to whoever signed in on that phone last). Written by the server only.
create table if not exists public.push_devices (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id);
alter table public.push_devices enable row level security;
drop policy if exists push_devices_own on public.push_devices;
create policy push_devices_own on public.push_devices for select using (user_id = auth.uid());

-- 2) Game sessions: drop-in games a team posts for its players and supporters (followers).
--    Some spots can be held for the team's own players; the rest are open to anyone.
create table if not exists public.session_series (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  weekday smallint not null check (weekday between 0 and 6),        -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  tz text not null default 'America/Toronto',
  venue_name text,
  venue_address text,
  price_cents integer not null default 0 check (price_cents between 0 and 100000),
  capacity integer not null check (capacity between 1 and 500),
  member_spots integer not null default 0 check (member_spots >= 0),
  release_hours integer check (release_hours between 0 and 336),    -- held spots open up this long before
  post_days_before smallint not null default 6 check (post_days_before between 0 and 27),
  post_time time not null default '09:00',
  notes text,
  skip_dates date[] not null default '{}',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  series_id uuid references public.session_series(id) on delete set null,
  title text not null check (length(title) between 1 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  tz text not null default 'America/Toronto',
  venue_name text,
  venue_address text,
  price_cents integer not null default 0 check (price_cents between 0 and 100000),
  capacity integer not null check (capacity between 1 and 500),
  member_spots integer not null default 0 check (member_spots >= 0),
  release_at timestamptz,                -- held spots open to everyone from this time
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  post_at timestamptz not null default now(),   -- shown and announced from this time
  announced_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, starts_at)
);
create index if not exists game_sessions_team on public.game_sessions (team_id, starts_at);

create table if not exists public.session_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'held', 'waitlist', 'cancelled')),
  member boolean not null default false,
  paid text check (paid in ('card', 'cash')),
  hold_until timestamptz,                -- a spot kept while the person pays by card
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists session_bookings_session on public.session_bookings (session_id);

-- Everything is read and written by the server after it checks who's asking.
alter table public.session_series enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_bookings enable row level security;
drop policy if exists session_bookings_own on public.session_bookings;
create policy session_bookings_own on public.session_bookings for select using (user_id = auth.uid());

-- Session bookings can be paid online too.
alter table public.online_payments drop constraint if exists online_payments_kind_check;
alter table public.online_payments add constraint online_payments_kind_check check (kind in ('dues', 'event', 'tournament', 'session'));

-- 3) Every 15 minutes: post weekly sessions that are due, announce them, send waiting
--    email and phone notifications. Replace <SESSIONS_CRON_KEY> with the value set in Vercel.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('clbx-sessions') where exists (select 1 from cron.job where jobname = 'clbx-sessions');
select cron.schedule('clbx-sessions', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://clbx.ca/api/cron/sessions',
    headers := jsonb_build_object('x-cron-key', '<SESSIONS_CRON_KEY>', 'content-type', 'application/json'),
    body := '{}'::jsonb
  );
$$);
