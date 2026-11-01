-- Auction monitor (runs the big screen and sees the full summary) and a private link for the
-- big-screen view, so a TV or projector can show the auction live without signing in.
alter table public.auctions add column if not exists monitor_id uuid references public.profiles(id) on delete set null;
alter table public.auctions add column if not exists screen_token text;
update public.auctions set screen_token = replace(gen_random_uuid()::text, '-', '') where screen_token is null;
create unique index if not exists auctions_screen_token on public.auctions (screen_token);
