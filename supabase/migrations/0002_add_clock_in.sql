-- Migration: add clock-IN support (separate scheduled time + enable flag).
-- The attendance tap endpoint is the same for in/out; "action" is our intent.
-- Run this in the Supabase SQL Editor.

alter table public.accounts
  add column if not exists scheduled_clock_in_time text,                       -- 'HH:MM'
  add column if not exists clock_in_enabled        boolean not null default false,
  add column if not exists last_clock_in_run_date  date,
  add column if not exists last_action             text;                        -- 'in' | 'out'

-- Track which action each log row represents.
alter table public.clock_out_logs
  add column if not exists action text not null default 'out';                  -- 'in' | 'out'
