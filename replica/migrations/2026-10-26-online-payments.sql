-- Online payments through Stripe Connect (fully embedded, like Spond).
-- A person sets up a payout account once (Stripe holds their ID, SIN and bank details;
-- we keep only the Stripe account id and its status). A team or a tournament picks whose
-- payout account its online payments go to. Players pay amount + Clbx fee (3.2% + 90¢);
-- the payout account receives exactly the amount.
-- All writes go through the server (server key) after the app checks permissions.

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_account_id text unique,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  transfers_enabled boolean not null default false,
  needs_info boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists payout_accounts_own on public.payout_accounts;
create policy payout_accounts_own on public.payout_accounts for select using (user_id = auth.uid());

alter table public.teams add column if not exists payout_account_id uuid references public.payout_accounts(id) on delete set null;
alter table public.tournaments add column if not exists payout_account_id uuid references public.payout_accounts(id) on delete set null;
alter table public.events add column if not exists fee_cents integer not null default 0;
alter table public.events drop constraint if exists events_fee_cents_check;
alter table public.events add constraint events_fee_cents_check check (fee_cents between 0 and 100000);

create table if not exists public.online_payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dues', 'event', 'tournament')),
  ref_id uuid not null,               -- dues.id, events.id or tournament_teams.id
  team_id uuid references public.teams(id) on delete set null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  payer_id uuid references public.profiles(id) on delete set null,
  for_user_id uuid references public.profiles(id) on delete set null, -- the player it covers (dues, event)
  payout_account_id uuid references public.payout_accounts(id) on delete set null,
  method text not null default 'card' check (method in ('card', 'cash')),
  amount_cents integer not null check (amount_cents > 0),   -- what the team/host gets
  fee_cents integer not null default 0 check (fee_cents >= 0), -- Clbx fee on top
  total_cents integer not null check (total_cents >= amount_cents),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  label text,
  stripe_session_id text unique,
  stripe_payment_intent text,
  recorded_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists online_payments_ref on public.online_payments (kind, ref_id);
create index if not exists online_payments_team on public.online_payments (team_id);
create index if not exists online_payments_tournament on public.online_payments (tournament_id);
alter table public.online_payments enable row level security;
drop policy if exists online_payments_mine on public.online_payments;
create policy online_payments_mine on public.online_payments for select using (payer_id = auth.uid() or for_user_id = auth.uid());

-- Dues paid by card count as confirmed payments.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('etransfer', 'cash', 'card', 'card_elsewhere', 'other'));
