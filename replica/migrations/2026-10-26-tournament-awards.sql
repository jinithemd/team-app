-- ---------------------------------------------------------------------------
-- Player of the match (optional, per game) and tournament awards (best player, top
-- scorer, best goalkeeper, or anything the host names). Winners come from the rosters,
-- so a player linked to their Clbx account gets the badge on their profile.
-- ---------------------------------------------------------------------------

alter table tournament_matches add column if not exists motm_roster_id uuid references tournament_roster(id) on delete set null;

create table if not exists tournament_awards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  title text not null check (length(title) between 1 and 60),
  entry_id uuid references tournament_teams(id) on delete cascade,
  roster_id uuid references tournament_roster(id) on delete cascade,
  note text check (length(note) <= 120),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint award_has_winner check (entry_id is not null or roster_id is not null)
);
create index if not exists tournament_awards_t on tournament_awards (tournament_id);
create index if not exists tournament_awards_r on tournament_awards (roster_id);
alter table tournament_awards enable row level security;
drop policy if exists tawards_read on tournament_awards;
create policy tawards_read on tournament_awards for select using (can_view_tournament(tournament_id));
drop policy if exists tawards_write on tournament_awards;
create policy tawards_write on tournament_awards for all
  using (is_tournament_organizer(tournament_id)) with check (is_tournament_organizer(tournament_id));
grant select, insert, update, delete on tournament_awards to authenticated;
