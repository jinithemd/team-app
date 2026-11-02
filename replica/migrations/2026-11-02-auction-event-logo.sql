-- An event logo for an auction (shown on the big screen's top bar and the card deck). Optional.
alter table public.auctions add column if not exists event_logo text;
alter table public.auctions add column if not exists event_logo_at timestamptz;
