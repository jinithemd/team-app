-- ---------------------------------------------------------------------------
-- Tournaments: a club hosts, invites Clbx teams or adds guest teams, generates fixtures,
-- officials enter results, standings and brackets are worked out from them.
-- ---------------------------------------------------------------------------

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  name text not null check (length(name) between 2 and 80),
  logo text check (logo is null or length(logo) <= 400000),
  format text not null check (format in ('league', 'round_robin', 'knockout', 'groups_knockout')),
  legs int not null default 1 check (legs in (1, 2)),
  group_count int not null default 2 check (group_count between 1 and 16),
  advance_per_group int not null default 2 check (advance_per_group between 1 and 8),
  starts_on date not null,
  ends_on date not null,
  venue_name text check (length(venue_name) <= 120),
  venue_address text check (length(venue_address) <= 200),
  venue_lat double precision,
  venue_lng double precision,
  rules text check (length(rules) <= 5000),
  fee_cents int not null default 0 check (fee_cents between 0 and 10000000),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  pay_to text check (length(pay_to) <= 200),
  points_win int not null default 3,
  points_draw int not null default 1,
  points_loss int not null default 0,
  max_teams int check (max_teams between 2 and 128),
  status text not null default 'draft' check (status in ('draft', 'registration', 'in_progress', 'finished')),
  is_public boolean not null default true,
  registration_open boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dates_in_order check (ends_on >= starts_on)
);
create index if not exists tournaments_club on tournaments (club_id);

create table if not exists tournament_officials (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'official' check (role in ('organizer', 'official')),
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
create index if not exists tournament_officials_user on tournament_officials (user_id);

-- One row per team in the tournament: a Clbx team (team_id) or a guest team (name only).
create table if not exists tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  status text not null default 'invited' check (status in ('invited', 'applied', 'accepted', 'declined', 'withdrawn')),
  paid boolean not null default false,
  group_label text check (group_label ~ '^[A-P]$'),
  seed int,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tournament_teams_once on tournament_teams (tournament_id, team_id) where team_id is not null;
create index if not exists tournament_teams_team on tournament_teams (team_id);

-- Guest teams' contact emails: organizers only (kept off the public rows).
create table if not exists tournament_team_contacts (
  entry_id uuid primary key references tournament_teams(id) on delete cascade,
  email citext not null
);

create table if not exists tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  stage text not null check (stage in ('league', 'group', 'knockout')),
  group_label text,
  round int not null,
  slot int not null default 0,
  round_name text,
  home_id uuid references tournament_teams(id) on delete set null,
  away_id uuid references tournament_teams(id) on delete set null,
  -- Where a knockout slot's team comes from: 'A1' (group A winner), 'W:<match id>', 'L:<match id>'.
  home_source text,
  away_source text,
  kickoff_at timestamptz,
  pitch text check (length(pitch) <= 60),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score int check (home_score between 0 and 999),
  away_score int check (away_score between 0 and 999),
  home_pens int check (home_pens between 0 and 99),
  away_pens int check (away_pens between 0 and 99),
  winner_id uuid references tournament_teams(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists tournament_matches_t on tournament_matches (tournament_id, stage, round, slot);

create table if not exists tournament_match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references tournament_matches(id) on delete cascade,
  entry_id uuid not null references tournament_teams(id) on delete cascade,
  kind text not null check (kind in ('goal', 'own_goal', 'penalty_goal', 'yellow', 'red')),
  minute int check (minute between 0 and 200),
  player text check (length(player) <= 60),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tournament_match_events_m on tournament_match_events (match_id);

-- ---------- who may do what ----------

create or replace function is_tournament_organizer(t uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from tournaments x join club_admins a on a.club_id = x.club_id
    where x.id = t and a.user_id = auth.uid() and a.role in ('owner', 'admin')
  ) or exists (select 1 from tournament_officials o where o.tournament_id = t and o.user_id = auth.uid() and o.role = 'organizer')
$$;

create or replace function is_tournament_official(t uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select is_tournament_organizer(t)
  or exists (select 1 from tournament_officials o where o.tournament_id = t and o.user_id = auth.uid())
$$;

create or replace function can_view_tournament(t uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from tournaments x where x.id = t and x.is_public and x.status <> 'draft')
  or is_tournament_official(t)
  or exists (select 1 from tournament_teams e where e.tournament_id = t and e.team_id is not null and is_team_member(e.team_id))
$$;

alter table tournaments enable row level security;
alter table tournament_officials enable row level security;
alter table tournament_teams enable row level security;
alter table tournament_team_contacts enable row level security;
alter table tournament_matches enable row level security;
alter table tournament_match_events enable row level security;

drop policy if exists tournaments_read on tournaments;
create policy tournaments_read on tournaments for select using (can_view_tournament(id));
drop policy if exists tournaments_insert on tournaments;
create policy tournaments_insert on tournaments for insert with check (
  created_by = (select auth.uid())
  and exists (select 1 from club_admins a where a.club_id = tournaments.club_id and a.user_id = (select auth.uid()) and a.role in ('owner', 'admin'))
);
drop policy if exists tournaments_update on tournaments;
create policy tournaments_update on tournaments for update using (is_tournament_organizer(id)) with check (is_tournament_organizer(id));
drop policy if exists tournaments_delete on tournaments;
create policy tournaments_delete on tournaments for delete using (is_tournament_organizer(id));

drop policy if exists officials_read on tournament_officials;
create policy officials_read on tournament_officials for select using (user_id = (select auth.uid()) or is_tournament_official(tournament_id));
drop policy if exists officials_write on tournament_officials;
create policy officials_write on tournament_officials for all using (is_tournament_organizer(tournament_id)) with check (is_tournament_organizer(tournament_id));

drop policy if exists tteams_read on tournament_teams;
create policy tteams_read on tournament_teams for select using (
  can_view_tournament(tournament_id) or (team_id is not null and is_team_staff(team_id))
);
drop policy if exists tteams_write on tournament_teams;
create policy tteams_write on tournament_teams for all using (is_tournament_organizer(tournament_id)) with check (is_tournament_organizer(tournament_id));

drop policy if exists tcontacts_all on tournament_team_contacts;
create policy tcontacts_all on tournament_team_contacts for all
  using (is_tournament_organizer((select e.tournament_id from tournament_teams e where e.id = entry_id)))
  with check (is_tournament_organizer((select e.tournament_id from tournament_teams e where e.id = entry_id)));

drop policy if exists tmatches_read on tournament_matches;
create policy tmatches_read on tournament_matches for select using (can_view_tournament(tournament_id));
drop policy if exists tmatches_update on tournament_matches;
create policy tmatches_update on tournament_matches for update using (is_tournament_official(tournament_id)) with check (is_tournament_official(tournament_id));
drop policy if exists tmatches_insert on tournament_matches;
create policy tmatches_insert on tournament_matches for insert with check (is_tournament_organizer(tournament_id));
drop policy if exists tmatches_delete on tournament_matches;
create policy tmatches_delete on tournament_matches for delete using (is_tournament_organizer(tournament_id));

drop policy if exists tevents_read on tournament_match_events;
create policy tevents_read on tournament_match_events for select using (
  can_view_tournament((select m.tournament_id from tournament_matches m where m.id = match_id))
);
drop policy if exists tevents_write on tournament_match_events;
create policy tevents_write on tournament_match_events for all
  using (is_tournament_official((select m.tournament_id from tournament_matches m where m.id = match_id)))
  with check (is_tournament_official((select m.tournament_id from tournament_matches m where m.id = match_id)));

-- ---------- what a team's staff can do from their side ----------

-- Answer an invitation for a team you run.
create or replace function respond_tournament_invite(p_entry uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare e tournament_teams;
begin
  select * into e from tournament_teams where id = p_entry for update;
  if e.id is null or e.team_id is null or not is_team_staff(e.team_id) then
    raise exception 'Only the team''s captains and managers can answer this' using errcode = 'insufficient_privilege';
  end if;
  if e.status not in ('invited', 'accepted', 'declined') then
    raise exception 'This invitation is no longer open' using errcode = 'check_violation';
  end if;
  update tournament_teams set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now() where id = p_entry;
end $$;

-- Ask to join a tournament that's taking teams, for a team you run.
create or replace function apply_to_tournament(p_tournament uuid, p_team uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare t tournaments; team_name text; new_id uuid; existing tournament_teams;
begin
  select * into t from tournaments where id = p_tournament;
  if t.id is null or not t.registration_open or t.status not in ('registration', 'draft') or not t.is_public then
    raise exception 'This tournament isn''t taking teams' using errcode = 'check_violation';
  end if;
  if not is_team_staff(p_team) then
    raise exception 'Only the team''s captains and managers can enter it' using errcode = 'insufficient_privilege';
  end if;
  select * into existing from tournament_teams where tournament_id = p_tournament and team_id = p_team;
  if existing.id is not null then
    if existing.status in ('declined', 'withdrawn') then
      update tournament_teams set status = 'applied', updated_at = now() where id = existing.id;
    end if;
    return existing.id;
  end if;
  select name into team_name from teams where id = p_team;
  insert into tournament_teams (tournament_id, team_id, name, status, created_by)
  values (p_tournament, p_team, team_name, 'applied', auth.uid()) returning id into new_id;
  return new_id;
end $$;

-- Pull your team out (before or during registration).
create or replace function withdraw_from_tournament(p_entry uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare e tournament_teams;
begin
  select * into e from tournament_teams where id = p_entry;
  if e.id is null or e.team_id is null or not is_team_staff(e.team_id) then
    raise exception 'Only the team''s captains and managers can do this' using errcode = 'insufficient_privilege';
  end if;
  update tournament_teams set status = 'withdrawn', updated_at = now() where id = p_entry;
end $$;

revoke all on function respond_tournament_invite(uuid, boolean) from public, anon;
revoke all on function apply_to_tournament(uuid, uuid) from public, anon;
revoke all on function withdraw_from_tournament(uuid) from public, anon;
grant execute on function respond_tournament_invite(uuid, boolean) to authenticated;
grant execute on function apply_to_tournament(uuid, uuid) to authenticated;
grant execute on function withdraw_from_tournament(uuid) to authenticated;

drop trigger if exists tournaments_updated on tournaments;
create trigger tournaments_updated before update on tournaments for each row execute function set_updated_at();
drop trigger if exists tournament_teams_updated on tournament_teams;
create trigger tournament_teams_updated before update on tournament_teams for each row execute function set_updated_at();
drop trigger if exists tournament_matches_updated on tournament_matches;
create trigger tournament_matches_updated before update on tournament_matches for each row execute function set_updated_at();
