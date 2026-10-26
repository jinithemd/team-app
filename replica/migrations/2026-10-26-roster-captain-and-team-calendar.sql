-- ---------------------------------------------------------------------------
-- 1) A captain on each tournament roster (one per team). A host change after submission
--    is marked like any other.
-- 2) Tournaments on team calendars: a team that's in a tournament gets the tournament and
--    each of its games as team events, kept in step by the app.
-- ---------------------------------------------------------------------------

alter table tournament_roster
  add column if not exists is_captain boolean not null default false,
  add column if not exists prev_captain boolean;
create unique index if not exists tournament_roster_one_captain on tournament_roster (entry_id)
  where is_captain and host_change is distinct from 'removed';

create or replace function tournament_roster_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare submitted timestamptz; lim int; n int;
begin
  select e.roster_submitted_at, t.roster_max into submitted, lim
  from tournament_teams e join tournaments t on t.id = e.tournament_id
  where e.id = coalesce(new.entry_id, old.entry_id);

  if tg_op = 'DELETE' then
    if submitted is not null then
      update tournament_roster set host_change = 'removed', host_changed_at = now(), is_captain = false,
        prev_name = coalesce(prev_name, old.name), prev_jersey = coalesce(prev_jersey, old.jersey),
        prev_captain = coalesce(prev_captain, old.is_captain)
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
    new.host_change := null; new.host_changed_at := null; new.prev_name := null; new.prev_jersey := null; new.prev_captain := null;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.host_change := 'added'; new.host_changed_at := now(); new.prev_name := null; new.prev_jersey := null; new.prev_captain := null;
    return new;
  end if;
  if new.host_change = 'removed' and old.host_change is distinct from 'removed' then
    new.host_changed_at := now(); new.is_captain := false;
    new.prev_name := coalesce(old.prev_name, old.name); new.prev_jersey := coalesce(old.prev_jersey, old.jersey);
    new.prev_captain := coalesce(old.prev_captain, old.is_captain);
    return new;
  end if;
  if old.host_change = 'removed' then
    raise exception 'This person was removed from the roster' using errcode = 'check_violation';
  end if;
  if new.name = old.name and new.jersey is not distinct from old.jersey and new.role = old.role and new.is_captain = old.is_captain then
    new.host_change := old.host_change; new.host_changed_at := old.host_changed_at;
    new.prev_name := old.prev_name; new.prev_jersey := old.prev_jersey; new.prev_captain := old.prev_captain;
    return new;
  end if;
  new.host_change := case when old.host_change = 'added' then 'added' else 'edited' end;
  new.host_changed_at := now();
  new.prev_name := case when old.host_change is null then old.name else old.prev_name end;
  new.prev_jersey := case when old.host_change is null then old.jersey else old.prev_jersey end;
  new.prev_captain := case when old.host_change is null then old.is_captain else old.prev_captain end;
  return new;
end $$;

alter table events
  add column if not exists tournament_id uuid references tournaments(id) on delete cascade,
  add column if not exists tournament_match_id uuid references tournament_matches(id) on delete cascade;
create unique index if not exists events_tournament_once on events (team_id, tournament_id)
  where tournament_id is not null and tournament_match_id is null;
create unique index if not exists events_tournament_match_once on events (team_id, tournament_match_id)
  where tournament_match_id is not null;
