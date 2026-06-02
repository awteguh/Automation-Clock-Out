-- Migration: track when each account's bearer token expires.
-- The attendance API issues 72h tokens. We stamp `bearer_expires_at` = the
-- moment of the last successful login + 72h (set in lib/clockout.ts), so the
-- dashboard can warn before the token dies and the tap-only cron stops working.
-- Run this in the Supabase SQL Editor.

alter table public.accounts
  add column if not exists bearer_expires_at timestamptz;
