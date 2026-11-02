-- Team sheets: the lineup a captain picks for a match (formation, who plays where, subs).
-- Read and written only by the server, which checks the person's team permissions.
create table if not exists public.event_lineups (
  event_id uuid primary key references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  formation text not null,
  slots jsonb not null default '[]'::jsonb,
  subs jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.event_lineups enable row level security;
create index if not exists event_lineups_team on public.event_lineups(team_id);
