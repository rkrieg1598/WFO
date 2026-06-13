-- ============================================================
--  WHITE FAMILY OLYMPICS — Supabase setup
--  Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  team_no int,
  created_at timestamptz default now()
);

-- ---------- SCORES ----------
-- one row per player per event; place = finishing position
create table if not exists scores (
  id bigint generated always as identity primary key,
  event_key text not null,
  player_id uuid references profiles(id) on delete cascade,
  place int not null,
  created_at timestamptz default now()
);

-- ---------- RESULTS (which events are completed) ----------
create table if not exists results (
  event_key text primary key,
  completed boolean default false
);

-- ---------- INSTRUCTIONS ----------
create table if not exists instructions (
  event_key text primary key,
  body text,
  image_url text,
  map_embed text
);

-- ---------- PHOTO GALLERY ----------
create table if not exists photos (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,
  author_name text,
  author_avatar text,
  image_url text not null,
  caption text,
  created_at timestamptz default now()
);
create table if not exists photo_likes (
  id bigint generated always as identity primary key,
  photo_id bigint references photos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  unique (photo_id, user_id)
);
create table if not exists photo_comments (
  id bigint generated always as identity primary key,
  photo_id bigint references photos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  author_name text,
  body text,
  created_at timestamptz default now()
);

-- ---------- SETTINGS (scavenger unlock, etc) ----------
create table if not exists settings (
  key text primary key,
  value text
);
insert into settings (key, value) values ('scavenger_unlocked', 'false')
  on conflict (key) do nothing;

-- ============================================================
--  ROW LEVEL SECURITY
--  Everyone signed in can READ. Only the admin email can WRITE
--  the competition data. Users manage their own profile/photos.
-- ============================================================
alter table profiles        enable row level security;
alter table scores          enable row level security;
alter table results         enable row level security;
alter table instructions    enable row level security;
alter table photos          enable row level security;
alter table photo_likes     enable row level security;
alter table photo_comments  enable row level security;
alter table settings        enable row level security;

-- helper: is the current user the admin?
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'regankrieg@gmail.com';
$$;

-- PROFILES: anyone signed in can read; you can insert/update only your own row
create policy "profiles read"   on profiles for select to authenticated using (true);
create policy "profiles insert" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update" on profiles for update to authenticated using (auth.uid() = id or is_admin());

-- SCORES / RESULTS / INSTRUCTIONS / SETTINGS: read all, write = admin only
create policy "scores read"  on scores  for select to authenticated using (true);
create policy "scores write" on scores  for all    to authenticated using (is_admin()) with check (is_admin());

create policy "results read"  on results for select to authenticated using (true);
create policy "results write" on results for all    to authenticated using (is_admin()) with check (is_admin());

create policy "instr read"  on instructions for select to authenticated using (true);
create policy "instr write" on instructions for all    to authenticated using (is_admin()) with check (is_admin());

create policy "settings read"  on settings for select to authenticated using (true);
create policy "settings write" on settings for all    to authenticated using (is_admin()) with check (is_admin());

-- PHOTOS: read all; create your own; admin or owner can delete
create policy "photos read"   on photos for select to authenticated using (true);
create policy "photos insert" on photos for insert to authenticated with check (auth.uid() = user_id);
create policy "photos delete" on photos for delete to authenticated using (auth.uid() = user_id or is_admin());

create policy "likes read"   on photo_likes for select to authenticated using (true);
create policy "likes write"  on photo_likes for all    to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "comments read"   on photo_comments for select to authenticated using (true);
create policy "comments insert" on photo_comments for insert to authenticated with check (auth.uid() = user_id);
create policy "comments delete" on photo_comments for delete to authenticated using (auth.uid() = user_id or is_admin());

-- ============================================================
--  REALTIME (for live leaderboard + gallery)
-- ============================================================
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table photos;
alter publication supabase_realtime add table photo_likes;
alter publication supabase_realtime add table photo_comments;

-- ============================================================
--  STORAGE BUCKETS
--  After running this, also create two PUBLIC buckets in
--  Storage → New bucket:  "avatars"  and  "photos"
--  (toggle "Public bucket" ON for both)
-- ============================================================
-- Storage access policies (run after buckets exist):
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('photos','photos', true) on conflict do nothing;

create policy "avatars read"   on storage.objects for select to public using (bucket_id = 'avatars');
create policy "avatars write"  on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars update" on storage.objects for update to authenticated using (bucket_id = 'avatars');

create policy "photos read"    on storage.objects for select to public using (bucket_id = 'photos');
create policy "photos write"   on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "photos update"  on storage.objects for update to authenticated using (bucket_id = 'photos');
