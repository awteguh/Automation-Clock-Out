-- ============================================================
-- Automation Clock Out — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- ============================================================

create extension if not exists "pgcrypto";

-- One row per employee account that we clock out.
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,                 -- friendly name shown in the UI
  employee_id     text not null,                 -- login: employee_id
  password        text not null,                 -- login: password
  ssid            text not null default 'LT. 2 Bharata-5G',
  mac_address     text not null default 'C4:B2:5B:CE:DB:CF',
  device_id       text not null default 'Currently unused',
  latitude        double precision not null,
  longitude       double precision not null,
  is_active       boolean not null default true,

  -- scheduling (cron taps at the scheduled time, in CRON_TIMEZONE)
  -- clock-OUT schedule
  scheduled_time          text,                   -- 'HH:MM' (24h), null = no schedule
  schedule_enabled        boolean not null default false,
  last_scheduled_run_date date,                   -- guard: at most one auto clock-out per day
  -- clock-IN schedule
  scheduled_clock_in_time text,                   -- 'HH:MM' (24h), null = no schedule
  clock_in_enabled        boolean not null default false,
  last_clock_in_run_date  date,                   -- guard: at most one auto clock-in per day

  -- result bookkeeping
  last_bearer        text,
  bearer_expires_at  timestamptz,                 -- last login + 72h (token expiry)
  last_status        text,                        -- 'success' | 'error'
  last_message       text,
  last_action        text,                        -- 'in' | 'out' (last tap intent)
  last_clock_out_at  timestamptz,                 -- timestamp of last tap (in or out)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- History of every clock-out attempt.
create table if not exists public.clock_out_logs (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  status       text not null,                    -- 'success' | 'error'
  action       text not null default 'out',      -- 'in' | 'out'
  message      text,
  created_at   timestamptz not null default now()
);

create index if not exists clock_out_logs_account_id_idx
  on public.clock_out_logs (account_id, created_at desc);

-- Raw request/response logger (one row per login/tap HTTP call).
create table if not exists public.request_logs (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid references public.accounts(id) on delete set null,
  account_label  text,
  action         text,                 -- 'in' | 'out'
  step           text not null,        -- 'login' | 'tap'
  success        boolean not null,
  http_status    integer,              -- null on network/exception errors
  response_body  text,                 -- raw response (or error message), truncated
  created_at     timestamptz not null default now()
);

create index if not exists request_logs_created_at_idx
  on public.request_logs (created_at desc);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────
-- This app talks to Supabase from the server using the SECRET / service_role
-- key, which BYPASSES RLS. We enable RLS with NO policies so that the public
-- publishable (anon) key — which is shipped to browsers — cannot read the
-- stored passwords or bearer tokens. Server routes keep full access via the
-- secret key.
alter table public.accounts enable row level security;
alter table public.clock_out_logs enable row level security;
alter table public.request_logs enable row level security;

-- (Intentionally no policies: anon/authenticated get zero access.
--  All access is server-side via the secret key.)
