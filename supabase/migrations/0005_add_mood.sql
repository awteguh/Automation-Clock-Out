-- Migration: per-account mood, sent to /api/attendance/mood with each tap.
-- Stores the mood KEY (e.g. 'moodHappy'); the body sent is { emoji: <key> }.
-- Run this in the Supabase SQL Editor.

alter table public.accounts
  add column if not exists mood text not null default 'moodNeutral';
