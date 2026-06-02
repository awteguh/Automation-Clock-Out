-- Migration: raw request/response logger.
-- Records the HTTP response of each login and tap call, separate from the
-- summary in clock_out_logs. Run this in the Supabase SQL Editor.

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

-- Same RLS posture as the rest of the app: enabled, no policies. Only the
-- server's secret key can read/write.
alter table public.request_logs enable row level security;
