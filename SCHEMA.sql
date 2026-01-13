-- KhetGo Advanced Backend Schema
-- Copy and run this in your Supabase SQL Editor

-- 1. Enable Extensions
create extension if not exists "uuid-ossp";

-- 2. Create User Profiles
-- This table automatically links to Supabase Auth users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('farmer', 'buyer')),
  pincode text,
  district text,
  state text,
  avatar_url text,
  is_verified boolean default false,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create Crop Listings (Enhanced)
create table if not exists public.listings (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null,
  unit text not null,
  quantity text,
  category text check (category in ('Grains', 'Vegetables', 'Fruits', 'Organic', 'Spices')),
  pincode text not null,
  location_name text,
  image_url text,
  gallery_urls text[], -- Array of additional image URLs
  harvest_date date,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Create Service Bookings
create table if not exists public.bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  item_name text not null,
  item_type text,
  price_per_unit numeric,
  start_date date,
  end_date date,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  booking_date timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Real-time Messaging (Chat)
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id),
  receiver_id uuid references public.profiles(id),
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Trigger for New User Profile
-- Automatically create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'role');
  return new;
end;
$$ language plpgsql security modeller;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. RLS Fixes
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;

-- Profile Policies
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Listing Policies
create policy "Listings are viewable by everyone" on public.listings for select using (true);
create policy "Farmers can insert listings" on public.listings for insert with check (auth.uid() = owner_id);
create policy "Farmers can update/delete own listings" on public.listings for all using (auth.uid() = owner_id);

-- Message Policies
create policy "Users can see their own messages" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can send messages" on public.messages for insert with check (auth.uid() = sender_id);
