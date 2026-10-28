-- A posted game session also sits on the team's calendar as an event (schedule, calendar,
-- phone feeds). Booking still happens on the session page.
alter table public.events add column if not exists session_id uuid references public.game_sessions(id) on delete cascade;
create unique index if not exists events_session_id_key on public.events (session_id) where session_id is not null;
