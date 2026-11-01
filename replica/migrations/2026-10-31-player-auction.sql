-- Player auction: a team splits its players into squads for an internal tournament. Each squad
-- has a captain (and a manager) who bid points from a fixed budget; every player has a base
-- price. The host puts players up one at a time; the highest bid when the clock runs out wins.
-- Everything is read and written by the server after it checks who's asking.

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  status text not null default 'setup' check (status in ('setup', 'live', 'done')),
  budget integer not null check (budget between 1 and 1000000),
  base_price integer not null check (base_price >= 0),
  min_increment integer not null default 10 check (min_increment >= 1),
  bid_seconds integer not null default 20 check (bid_seconds between 5 and 300),
  squad_min integer not null default 0 check (squad_min >= 0),
  squad_max integer check (squad_max >= 1),
  captains_play boolean not null default true,
  current_lot_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists auctions_team on public.auctions (team_id, created_at desc);

create table if not exists public.auction_squads (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  color text not null default '#2346D8',
  captain_id uuid references public.profiles(id) on delete set null,
  manager_id uuid references public.profiles(id) on delete set null,
  sort integer not null default 0
);
create index if not exists auction_squads_auction on public.auction_squads (auction_id);

create table if not exists public.auction_players (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  base_price integer not null check (base_price >= 0),
  status text not null default 'pool' check (status in ('pool', 'sold', 'unsold', 'captain')),
  squad_id uuid references public.auction_squads(id) on delete set null,
  price integer,
  sort integer not null default 0
);
create index if not exists auction_players_auction on public.auction_players (auction_id);

create table if not exists public.auction_lots (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  player_id uuid not null references public.auction_players(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'sold', 'unsold')),
  top_bid integer,
  top_squad_id uuid references public.auction_squads(id) on delete set null,
  bids integer not null default 0,
  ends_at timestamptz not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists auction_lots_auction on public.auction_lots (auction_id, opened_at desc);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.auction_lots(id) on delete cascade,
  squad_id uuid not null references public.auction_squads(id) on delete cascade,
  amount integer not null,
  bid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists auction_bids_lot on public.auction_bids (lot_id, created_at desc);

alter table public.auctions enable row level security;
alter table public.auction_squads enable row level security;
alter table public.auction_players enable row level security;
alter table public.auction_lots enable row level security;
alter table public.auction_bids enable row level security;
