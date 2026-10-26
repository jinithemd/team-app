-- ---------------------------------------------------------------------------
-- Tournament rosters: the host sets the limits and criteria; each team lists its players
-- (with jersey numbers), a manager and a coach, then submits. Once submitted only the host
-- can change it, and every host change is marked on the roster (added / edited / removed,
-- with what it was before). The marks are set here, not by the app, so they can't be faked.
-- ---------------------------------------------------------------------------

alter table tournaments
  add column if not exists roster_max int check (roster_max between 1 and 80),
  add column if not exists roster_min int check (roster_min between 1 and 80),
  add column if not exists roster_rules text check (length(roster_rules) <= 3000),
  add column if not exists roster_deadline timestamptz;

alter table tournament_teams
  add column if not exists roster_submitted_at timestamptz,
  add column if not exists roster_submitted_by uuid references profiles(id) on delete set null;

create table if not exists tournament_roster (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  entry_id uuid not null references tournament_teams(id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'manager', 'coach')),
  name text not null check (length(name) between 1 and 80),
  jersey int check (jersey between 0 and 999),
  user_id uuid references profiles(id) on delete set null,
  host_change text check (host_change in ('added', 'edited', 'removed')),
  host_changed_at timestamptz,
  prev_name text,
  prev_jersey int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_has_number check (role <> 'player' or jersey is not null or host_change = 'removed')
);
create index if not exists tournament_roster_entry on tournament_roster (entry_id);
create unique index if not exists tournament_roster_number on tournament_roster (entry_id, jersey)
  where role = 'player' and host_change is distinct from 'removed';
create unique index if not exists tournament_roster_one_staff on tournament_roster (entry_id, role)
  where role in ('manager', 'coach') and host_change is distinct from 'removed';

-- Staff (captain / manager / coach) of the Clbx team behind an entry.
create or replace function is_entry_staff(p_entry uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from tournament_teams e where e.id = p_entry and e.team_id is not null and is_team_staff(e.team_id))
$$;

-- People taking part: organizers, officials, and members of any team in it.
create or replace function is_tournament_participant(t uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select is_tournament_official(t)
  or exists (select 1 from tournament_teams e where e.tournament_id = t and e.team_id is not null
             and e.status = 'accepted' and is_team_member(e.team_id))
$$;

-- When the team itself may still change its roster: not submitted, before the deadline,
-- and before its first kick-off.
create or replace function team_can_edit_roster(p_entry uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from tournament_teams e join tournaments t on t.id = e.tournament_id
    where e.id = p_entry and e.status = 'accepted' and e.roster_submitted_at is null
      and t.status <> 'finished'
      and (t.roster_deadline is null or now() < t.roster_deadline)
      and not exists (select 1 from tournament_matches m where (m.home_id = e.id or m.away_id = e.id)
                      and m.home_source is distinct from 'BYE' and m.away_source is distinct from 'BYE'
                      and ((m.kickoff_at is not null and m.kickoff_at <= now()) or m.status in ('live', 'finished')))
  ) and is_entry_staff(p_entry)
$$;

alter table tournament_roster enable row level security;
drop policy if exists troster_read on tournament_roster;
create policy troster_read on tournament_roster for select using (is_tournament_participant(tournament_id) or is_entry_staff(entry_id));
drop policy if exists troster_write on tournament_roster;
create policy troster_write on tournament_roster for all
  using (is_tournament_organizer(tournament_id) or team_can_edit_roster(entry_id))
  with check (
    (is_tournament_organizer(tournament_id) or team_can_edit_roster(entry_id))
    and tournament_id = (select e.tournament_id from tournament_teams e where e.id = entry_id)
  );
grant select, insert, update, delete on tournament_roster to authenticated;

-- Marks host changes after submission, keeps what it was, turns a delete into "removed",
-- and holds the player limit.
create or replace function tournament_roster_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare submitted timestamptz; lim int; n int;
begin
  select e.roster_submitted_at, t.roster_max into submitted, lim
  from tournament_teams e join tournaments t on t.id = e.tournament_id
  where e.id = coalesce(new.entry_id, old.entry_id);

  if tg_op = 'DELETE' then
    if submitted is not null then
      update tournament_roster set host_change = 'removed', host_changed_at = now(),
        prev_name = coalesce(prev_name, old.name), prev_jersey = coalesce(prev_jersey, old.jersey)
      where id = old.id and host_change is distinct from 'removed';
      return null;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' and new.role = 'player' and lim is not null then
    select count(*) into n from tournament_roster where entry_id = new.entry_id and role = 'player' and host_change is distinct from 'removed';
    if n >= lim then
      raise exception 'This tournament allows % players per team', lim using errcode = 'check_violation';
    end if;
  end if;

  if submitted is null then
    new.host_change := null; new.host_changed_at := null; new.prev_name := null; new.prev_jersey := null;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.host_change := 'added'; new.host_changed_at := now(); new.prev_name := null; new.prev_jersey := null;
    return new;
  end if;
  -- UPDATE after submission (only the host gets here).
  if new.host_change = 'removed' and old.host_change is distinct from 'removed' then
    new.host_changed_at := now();
    new.prev_name := coalesce(old.prev_name, old.name); new.prev_jersey := coalesce(old.prev_jersey, old.jersey);
    return new;
  end if;
  if old.host_change = 'removed' then
    raise exception 'This person was removed from the roster' using errcode = 'check_violation';
  end if;
  if new.name = old.name and new.jersey is not distinct from old.jersey and new.role = old.role then
    new.host_change := old.host_change; new.host_changed_at := old.host_changed_at;
    new.prev_name := old.prev_name; new.prev_jersey := old.prev_jersey;
    return new;
  end if;
  new.host_change := case when old.host_change = 'added' then 'added' else 'edited' end;
  new.host_changed_at := now();
  new.prev_name := case when old.host_change is null then old.name else old.prev_name end;
  new.prev_jersey := case when old.host_change is null then old.jersey else old.prev_jersey end;
  return new;
end $$;

drop trigger if exists tournament_roster_guard_iu on tournament_roster;
create trigger tournament_roster_guard_iu before insert or update on tournament_roster for each row execute function tournament_roster_guard();
drop trigger if exists tournament_roster_guard_d on tournament_roster;
create trigger tournament_roster_guard_d before delete on tournament_roster for each row execute function tournament_roster_guard();
drop trigger if exists tournament_roster_updated on tournament_roster;
create trigger tournament_roster_updated before update on tournament_roster for each row execute function set_updated_at();

-- Submit a roster: the team's staff (while it's still open) or the host (any time).
create or replace function submit_tournament_roster(p_entry uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare e tournament_teams; t tournaments; n int;
begin
  select * into e from tournament_teams where id = p_entry for update;
  if e.id is null then raise exception 'That team isn''t in this tournament' using errcode = 'no_data_found'; end if;
  select * into t from tournaments where id = e.tournament_id;
  if not (is_tournament_organizer(t.id) or team_can_edit_roster(p_entry)) then
    raise exception 'This roster can''t be submitted now' using errcode = 'insufficient_privilege';
  end if;
  if e.roster_submitted_at is not null then
    raise exception 'This roster is already submitted' using errcode = 'check_violation';
  end if;
  select count(*) into n from tournament_roster where entry_id = p_entry and role = 'player' and host_change is distinct from 'removed';
  if n < greatest(coalesce(t.roster_min, 1), 1) then
    raise exception 'Add at least % players before submitting', greatest(coalesce(t.roster_min, 1), 1) using errcode = 'check_violation';
  end if;
  if t.roster_max is not null and n > t.roster_max then
    raise exception 'This tournament allows % players per team', t.roster_max using errcode = 'check_violation';
  end if;
  update tournament_teams set roster_submitted_at = now(), roster_submitted_by = auth.uid() where id = p_entry;
end $$;
revoke all on function submit_tournament_roster(uuid) from public, anon;
grant execute on function submit_tournament_roster(uuid) to authenticated;
