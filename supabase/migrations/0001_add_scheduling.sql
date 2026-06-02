-- Migration: add per-account scheduling.
-- Run this in the Supabase SQL Editor if you already created the tables
-- before scheduling was added. (schema.sql already includes these columns.)

alter table public.accounts
  add column if not exists scheduled_time          text,
  add column if not exists schedule_enabled        boolean not null default false,
  add column if not exists last_scheduled_run_date date;
