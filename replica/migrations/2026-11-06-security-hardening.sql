-- Security review, 6 Nov 2026.

-- 1) The *_public views run with their owner's rights (so they can show filtered rows from
--    tables people can't read directly). Simple views are also writable, which would let a
--    signed-in user change rows through them past the tables' rules (any team's sponsors,
--    teammates' answers and availability). They are for reading only.
revoke insert, update, delete, truncate on public.availability_public, public.rsvps_public, public.potm_results, public.sponsors_public, public.played_public from anon, authenticated;

-- 2) A profile's email follows the sign-in account. People can still edit their name, phone,
--    photo and settings, but an email typed into the profile row is ignored, so nobody can
--    pass themselves off as someone else's address (e.g. when a captain adds a guest by email).
create or replace function public.pin_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' then
      new.email := old.email;
    else
      new.email := (select u.email from auth.users u where u.id = new.id);
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pin_profile_email() from public, anon, authenticated;
drop trigger if exists pin_profile_email on public.profiles;
create trigger pin_profile_email before insert or update on public.profiles
  for each row execute function public.pin_profile_email();

-- 3) A trigger function is never called directly.
revoke execute on function public.tournament_roster_guard() from public, anon, authenticated;
