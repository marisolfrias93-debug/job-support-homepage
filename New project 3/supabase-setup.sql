create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  username text,
  anonymous boolean default false,
  profile_major text,
  institution text,
  graduation_year text,
  career_interests text,
  job_goal text,
  excited_about text,
  struggling_with text,
  profile_photo_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = user_id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;
