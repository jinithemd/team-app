-- Auction teams can have a logo; auction players carry their photo (or their profile photo),
-- position and shirt number for the player card on the big screen.
alter table public.auction_squads add column if not exists logo text;
alter table public.auction_squads add column if not exists logo_at timestamptz;
alter table public.auction_players add column if not exists photo text;
alter table public.auction_players add column if not exists photo_at timestamptz;
alter table public.auction_players add column if not exists position text;
alter table public.auction_players add column if not exists jersey text;
