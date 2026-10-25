-- What Supabase grants on the auth schema once Auth has created it.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
