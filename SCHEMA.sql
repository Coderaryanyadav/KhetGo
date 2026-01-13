-- KhetGo Backend Schema
-- Copy and run this in your Supabase SQL Editor

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Crop Listings Table
create table if not exists public.listings (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price numeric not null,
  unit text not null,
  pincode text not null,
  location text,
  farmer text default 'Ram Singh',
  image_url text,
  category text,
  is_verified boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create Service Bookings Table
create table if not exists public.bookings (
  id uuid default uuid_generate_v4() primary key,
  item_name text not null,
  item_type text,
  price_per_unit numeric,
  user_name text default 'Ram Singh',
  booking_date timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Set up Row Level Security (RLS)
-- For this prototype, we'll allow all operations, but in production you should restrict this.
alter table public.listings enable row level security;
alter table public.bookings enable row level security;

create policy "Allow public access to listings" on public.listings for select using (true);
create policy "Allow authenticated insert to listings" on public.listings for insert with check (true);
create policy "Allow authenticated delete to listings" on public.listings for delete using (true);

create policy "Allow public access to bookings" on public.bookings for select using (true);
create policy "Allow authenticated insert to bookings" on public.bookings for insert with check (true);
