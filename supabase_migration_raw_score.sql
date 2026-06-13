-- Migration: add raw_score column to scores table
-- Run this in Supabase → SQL Editor if you already ran the original supabase_setup.sql

alter table scores add column if not exists raw_score numeric;

-- Migration: add onboarded column to profiles table
-- Tracks whether a user has seen the first-time onboarding carousel
alter table profiles add column if not exists onboarded boolean default false;

-- Migration: add team_slot column to profiles (tracks which slot 0 or 1 within team)
alter table profiles add column if not exists team_slot int;

-- Migration: brackets table for air hockey, horseshoes, scavenger hunt
create table if not exists brackets (
  event_key text primary key,
  state jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter publication supabase_realtime add table brackets;

-- Migration: bonus_points table
-- Stores manually entered bonus points per player with a reason
create table if not exists bonus_points (
  id bigint generated always as identity primary key,
  player_id uuid references profiles(id) on delete cascade,
  points int not null,
  reason text,
  created_at timestamptz default now()
);

alter publication supabase_realtime add table bonus_points;
