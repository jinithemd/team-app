-- Guest players: people who aren't on a team's roster but play some games (Sunday pickup,
-- a match, a tournament). The team keeps a guest list; each game says which guests are
-- invited and what they answered. Read and written only by the server, which checks the
-- person's team permissions (and, for a guest, that the invite is theirs).
create table if not exists public.team_guests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  on_list boolean not null default true,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists team_guests_user on public.team_guests(team_id, user_id) where user_id is not null;
create unique index if not exists team_guests_email on public.team_guests(team_id, lower(email)) where email is not null;
create index if not exists team_guests_user_any on public.team_guests(user_id);
alter table public.team_guests enable row level security;

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  guest_id uuid not null references public.team_guests(id) on delete cascade,
  response text check (response in ('going', 'maybe', 'not_going')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, guest_id)
);
create index if not exists event_guests_guest on public.event_guests(guest_id);
create index if not exists event_guests_team on public.event_guests(team_id);
alter table public.event_guests enable row level security;
