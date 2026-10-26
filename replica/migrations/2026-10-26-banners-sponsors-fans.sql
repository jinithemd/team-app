-- ---------------------------------------------------------------------------
-- 1) Tournament banners / posters, kept apart from the tournaments row so lists stay light.
-- 2) Sponsors: the contact email and the badge (tier) are optional.
-- 3) Fans: follows already exist (followers see public teams' games and scores).
-- ---------------------------------------------------------------------------

alter table tournaments add column if not exists banner_at timestamptz;

create table if not exists tournament_banners (
  tournament_id uuid primary key references tournaments(id) on delete cascade,
  image text not null check (length(image) <= 2000000),
  updated_at timestamptz not null default now()
);
alter table tournament_banners enable row level security;
drop policy if exists tbanners_read on tournament_banners;
create policy tbanners_read on tournament_banners for select using (can_view_tournament(tournament_id));
drop policy if exists tbanners_write on tournament_banners;
create policy tbanners_write on tournament_banners for all
  using (is_tournament_organizer(tournament_id)) with check (is_tournament_organizer(tournament_id));
grant select, insert, update, delete on tournament_banners to authenticated;

alter table sponsors alter column tier drop not null;
alter table sponsors drop constraint if exists contact_or_invite;
create or replace function tier_rank(t text) returns int
language sql immutable set search_path = public, extensions as $$
  select case t when 'diamond' then 1 when 'platinum' then 2 when 'gold' then 3 when 'silver' then 4 when 'bronze' then 5 else 6 end
$$;
