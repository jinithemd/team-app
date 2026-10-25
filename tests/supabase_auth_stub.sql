create schema if not exists extensions;
-- Supabase puts the extensions schema on every role's search path.
do $$ begin execute format('alter database %I set search_path = public, extensions', current_database()); end $$;
set search_path = public, extensions;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if; end $$;
