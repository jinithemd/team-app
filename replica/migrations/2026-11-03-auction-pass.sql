-- Auction: captains can pass on a player. A team that passes is out for that player; the
-- player is sold (or goes unsold) as soon as every other team is out.
alter table public.auction_lots add column if not exists passed uuid[] not null default '{}';

-- Adds a team to a lot's passes in one step, so two teams passing at once both count.
create or replace function public.auction_pass(p_lot uuid, p_squad uuid)
returns boolean
language sql
set search_path = ''
as $$
  with u as (
    update public.auction_lots set passed = array_append(passed, p_squad)
    where id = p_lot and status = 'open' and not (p_squad = any(passed)) and top_squad_id is distinct from p_squad
    returning 1
  )
  select exists(select 1 from u);
$$;
revoke all on function public.auction_pass(uuid, uuid) from public, anon, authenticated;
