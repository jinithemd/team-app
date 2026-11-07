-- Followers choose their updates. A team says what it shares with followers (null = all),
-- and each follower picks from that (null = everything the team shares).
alter table public.teams add column if not exists fan_updates text[];
alter table public.follows add column if not exists updates text[];
