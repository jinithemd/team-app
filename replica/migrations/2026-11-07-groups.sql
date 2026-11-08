-- Groups: a team's named circles of players (e.g. "Sunday Fun"), each with its own chat.
-- Members can be on the team or not (followers, guest players, anyone with an account).
-- Reached only through the server (service checks permissions), so RLS is on with no policies.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  about text check (about is null or char_length(about) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists groups_team_idx on public.groups(team_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_idx on public.group_messages(group_id, created_at desc);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
revoke all on public.groups, public.group_members, public.group_messages from anon, authenticated;

-- A drop-in posted to one group: only that group hears about it, held spots are for it.
alter table public.game_sessions add column if not exists group_id uuid references public.groups(id) on delete set null;

-- Weekly drop-ins can belong to a group too.
alter table public.session_series add column if not exists group_id uuid references public.groups(id) on delete set null;
