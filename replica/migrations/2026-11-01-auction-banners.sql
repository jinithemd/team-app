-- Big-screen banners for an auction: a tournament poster across the top and a sponsors
-- banner along the bottom (both optional).
alter table public.auctions add column if not exists banner text;
alter table public.auctions add column if not exists banner_at timestamptz;
alter table public.auctions add column if not exists sponsor_banner text;
alter table public.auctions add column if not exists sponsor_banner_at timestamptz;
