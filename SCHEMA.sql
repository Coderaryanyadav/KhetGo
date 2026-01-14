-- KhetGo: BULLETPROOF Production Schema
-- This script is safe to run multiple times and handles all edge cases

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. DROP AND RECREATE APPROACH (Clean slate - handles everything)
-- Only do this if you want a fresh start. Comment out if you have user data!

-- Uncomment the next line ONLY if you want to completely reset the database
-- drop schema public cascade; create schema public;

-- 3. CREATE TABLES (with all columns from the start)

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('farmer', 'buyer', 'admin')) default 'farmer',
  avatar_url text,
  bio text,
  district text,
  pincode text,
  is_verified boolean default false,
  phone text,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.mandi_prices (
  id uuid default uuid_generate_v4() primary key,
  crop text not null,
  price numeric not null,
  unit text default 'Quintal',
  trend text check (trend in ('up', 'down', 'stable')),
  change_pct text,
  market_name text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.listings (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  price numeric not null,
  unit text not null,
  quantity text,
  category text,
  description text,
  pincode text,
  location_name text,
  image_url text,
  harvest_date date,
  is_verified boolean default false,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.agri_services (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  type text,
  price_per_day numeric,
  provider_id uuid references public.profiles(id),
  image_url text,
  location text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.store_products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  brand text,
  price numeric not null,
  unit text,
  category text,
  image_url text,
  description text,
  stock_status text default 'In Stock',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.forum_posts (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.profiles(id) on delete cascade,
  owner_id uuid,
  title text not null,
  content text not null,
  category text,
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.news_articles (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text,
  category text,
  image_url text,
  author_name text default 'KhetGo Editor',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  item_name text not null,
  item_type text check (item_type in ('Produce', 'Service', 'Product')),
  price_per_unit numeric,
  status text default 'pending',
  booking_date timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.ledger_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric not null,
  type text check (type in ('income', 'expense')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.academy_content (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  video_url text,
  thumbnail_url text,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. MIGRATION LOGIC - Add missing columns to existing tables
do $$ 
begin 
  -- Listings migrations
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='listings' and column_name='lat') then
    alter table public.listings add column lat numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='listings' and column_name='lng') then
    alter table public.listings add column lng numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='listings' and column_name='location_name') then
    alter table public.listings add column location_name text;
  end if;
  
  -- Agri Services migrations
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='agri_services' and column_name='description') then
    alter table public.agri_services add column description text;
  end if;
  
  -- Forum Posts migrations
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='forum_posts' and column_name='owner_id') then
    alter table public.forum_posts add column owner_id uuid;
  end if;
end $$;

-- 5. Add unique constraints if they don't exist
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mandi_prices_crop_key') then
    alter table public.mandi_prices add constraint mandi_prices_crop_key unique (crop);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agri_services_title_key') then
    alter table public.agri_services add constraint agri_services_title_key unique (title);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'store_products_name_key') then
    alter table public.store_products add constraint store_products_name_key unique (name);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_content_title_key') then
    alter table public.academy_content add constraint academy_content_title_key unique (title);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'news_articles_title_key') then
    alter table public.news_articles add constraint news_articles_title_key unique (title);
  end if;
end $$;

-- 6. AUTOMATION - Profile Auto-Creation Trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'farmer'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. SECURITY - Enable RLS
alter table public.profiles enable row level security;
alter table public.mandi_prices enable row level security;
alter table public.listings enable row level security;
alter table public.agri_services enable row level security;
alter table public.store_products enable row level security;
alter table public.forum_posts enable row level security;
alter table public.news_articles enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.academy_content enable row level security;

-- 8. RLS POLICIES (Drop existing and recreate)

-- Profiles
drop policy if exists "Profiles viewable" on public.profiles;
create policy "Profiles viewable" on public.profiles for select using (true);
drop policy if exists "Users update own" on public.profiles;
create policy "Users update own" on public.profiles for update using (auth.uid() = id);

-- Mandi
drop policy if exists "Mandi viewable" on public.mandi_prices;
create policy "Mandi viewable" on public.mandi_prices for select using (true);
drop policy if exists "Admins manage mandi" on public.mandi_prices;
create policy "Admins manage mandi" on public.mandi_prices for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Listings
drop policy if exists "Listings viewable" on public.listings;
create policy "Listings viewable" on public.listings for select using (true);
drop policy if exists "Auth create listings" on public.listings;
create policy "Auth create listings" on public.listings for insert with check (auth.role() = 'authenticated');
drop policy if exists "Owners manage listings" on public.listings;
create policy "Owners manage listings" on public.listings for all using (
  auth.uid() = owner_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Services
drop policy if exists "Services viewable" on public.agri_services;
create policy "Services viewable" on public.agri_services for select using (true);
drop policy if exists "Admins manage services" on public.agri_services;
create policy "Admins manage services" on public.agri_services for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Store
drop policy if exists "Store viewable" on public.store_products;
create policy "Store viewable" on public.store_products for select using (true);
drop policy if exists "Admins manage store" on public.store_products;
create policy "Admins manage store" on public.store_products for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Forum
drop policy if exists "Forum viewable" on public.forum_posts;
create policy "Forum viewable" on public.forum_posts for select using (true);
drop policy if exists "Auth create posts" on public.forum_posts;
create policy "Auth create posts" on public.forum_posts for insert with check (auth.role() = 'authenticated');

-- News
drop policy if exists "News viewable" on public.news_articles;
create policy "News viewable" on public.news_articles for select using (true);
drop policy if exists "Admins manage news" on public.news_articles;
create policy "Admins manage news" on public.news_articles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Bookings
drop policy if exists "Users see bookings" on public.bookings;
create policy "Users see bookings" on public.bookings for select using (
  auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
drop policy if exists "Auth create bookings" on public.bookings;
create policy "Auth create bookings" on public.bookings for insert with check (auth.role() = 'authenticated');

-- Ledger
drop policy if exists "Users see ledger" on public.ledger_entries;
create policy "Users see ledger" on public.ledger_entries for select using (auth.uid() = user_id);
drop policy if exists "Users manage ledger" on public.ledger_entries;
create policy "Users manage ledger" on public.ledger_entries for all using (auth.uid() = user_id);

-- Messages
drop policy if exists "Users see messages" on public.messages;
create policy "Users see messages" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "Users send messages" on public.messages;
create policy "Users send messages" on public.messages for insert with check (auth.uid() = sender_id);

-- Academy
drop policy if exists "Academy viewable" on public.academy_content;
create policy "Academy viewable" on public.academy_content for select using (true);
drop policy if exists "Admins manage academy" on public.academy_content;
create policy "Admins manage academy" on public.academy_content for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 9. SEED DATA (Safe inserts with conflict handling)

-- Mandi Prices
insert into public.mandi_prices (crop, price, change_pct, trend, market_name) values 
('Premium Wheat', 2850, '+3.2%', 'up', 'Nagpur Central Mandi'),
('Mustard Grade-A', 5400, '-1.8%', 'down', 'Indore Hub'),
('Sona Masuri Rice', 4200, '+0.5%', 'up', 'Nashik Market'),
('Organic Potatoes', 1800, '+2.4%', 'up', 'Pune Agri Hub'),
('Red Onions', 2100, '-0.9%', 'down', 'Solapur Mandi'),
('Basmati Rice', 6800, '+4.1%', 'up', 'Delhi Azadpur'),
('Tur Dal', 8200, '+1.2%', 'stable', 'Latur Mandi'),
('Tomatoes', 1450, '-3.5%', 'down', 'Nashik APMC')
on conflict (crop) do update set 
  price = excluded.price,
  change_pct = excluded.change_pct,
  trend = excluded.trend,
  updated_at = now();

-- News
insert into public.news_articles (title, category, content, image_url) values 
('Export Ban Lifted on Basmati Rice', 'Global Trade', 'Government lifts minimum export price for Basmati rice, triggering international demand surge.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400'),
('New Drone Subsidies for Precision Farming', 'Technology', 'Certified farmers can now apply for 50% subsidies on agricultural drones.', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'),
('Monsoon Forecast: Above Normal Rainfall', 'Weather', 'IMD predicts 106% of long-period average rainfall this monsoon season.', 'https://images.unsplash.com/photo-1504133558287-1de3ada4e1ec?auto=format&fit=crop&q=80&w=400'),
('Government Announces ₹2000/Quintal MSP Hike', 'Policy', 'Minimum Support Price increased across 23 crops for farmer profitability.', 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=400')
on conflict (title) do nothing;

-- Store Products
insert into public.store_products (name, brand, price, unit, category, image_url, description) values 
('Bio-Boost Organic Fertilizer', 'GreenGrow', 1250, '50kg Bag', 'Organic Fertilizer', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'NPK 10:10:10 ratio for soil health'),
('High-Yield Paddy Seeds', 'Mahindra Agri', 3400, '25kg Pack', 'Verified Seeds', 'https://images.unsplash.com/photo-1574943320219-553eb213f721?auto=format&fit=crop&q=80&w=400', '45 quintals/hectare yield'),
('Power-Blade Cultivator Pro', 'TATA Agri', 18500, 'Unit', 'Modern Tools', 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400', 'Deep soil preparation'),
('Nano-Phosphorus Fertilizer', 'Coromandel', 2100, '5 Liter', 'Liquid Fertilizer', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'Fast-acting foliar spray'),
('Organic Neem Oil Pesticide', 'Bayer', 680, '1 Liter', 'Plant Protection', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', 'USDA-certified organic')
on conflict (name) do nothing;

-- Services
insert into public.agri_services (title, type, price_per_day, location, image_url, description) values 
('Tractor 55HP (Double Clutch)', 'Industrial', 2500, 'Maharashtra', 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400', 'Mahindra 575 DI with front loader'),
('Laser Land Leveler', 'Precision', 4500, 'Punjab/Haryana', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=400', 'GPS-enabled ±2cm precision'),
('Digital Soil Sensor', 'Diagnostic', 800, 'All-India', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'NPK/pH/moisture analyzer'),
('Combine Harvester', 'Industrial', 8000, 'North India', 'https://images.unsplash.com/photo-1574943320219-553eb213f721?auto=format&fit=crop&q=80&w=400', '2-acre/hour capacity'),
('Rotavator Heavy Duty', 'Tillage', 1800, 'Central India', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400', '42 blades, 7-feet width')
on conflict (title) do nothing;

-- Academy
insert into public.academy_content (title, category, description, thumbnail_url, video_url) values 
('Quantum Crop Diagnostics', 'Technical', 'Multispectral imaging for crop stress identification', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Supply Chain Liquidity', 'Economic', 'Financial strategies for market volatility', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Organic Composting at Home', 'Organic Farming', 'Vermiculture setup for nutrient-rich compost', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Integrated Pest Management', 'Crop Protection', 'Biological control with natural predators', 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Drip Irrigation Mastery', 'Soil Management', '60% water savings with automated timers', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Climate-Adaptive Varieties', 'Crop Protection', 'Drought and heat-tolerant crop selection', 'https://images.unsplash.com/photo-1504133558287-1de3ada4e1ec?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
on conflict (title) do nothing;

-- Forum (using temporary UUIDs that won't cause FK errors)
insert into public.forum_posts (owner_id, title, content, category, likes_count) 
select 
  null,
  'Best Practices for Monsoon Sowing?',
  'Looking for advice on optimal sowing dates for Soybean in Vidarbha region.',
  'Crop Advisory',
  34
where not exists (select 1 from public.forum_posts where title = 'Best Practices for Monsoon Sowing?');

insert into public.forum_posts (owner_id, title, content, category, likes_count) 
select 
  null,
  'Organic Certification Process Help',
  'Has anyone obtained NPOP organic certification? What are the requirements?',
  'Policy',
  28
where not exists (select 1 from public.forum_posts where title = 'Organic Certification Process Help');

insert into public.forum_posts (owner_id, title, content, category, likes_count) 
select 
  null,
  'Tomato Prices Crashing - Advice?',
  'Local mandi at ₹4/kg. Hold inventory or sell at loss? Cold storage ₹200/quintal.',
  'Market Analysis',
  67
where not exists (select 1 from public.forum_posts where title = 'Tomato Prices Crashing - Advice?');

insert into public.forum_posts (owner_id, title, content, category, likes_count) 
select 
  null,
  'Doubled Yield with Mulching!',
  'Plastic mulch in capsicum: 45% water reduction, yield 15→32 tons/hectare!',
  'Success Stories',
  102
where not exists (select 1 from public.forum_posts where title = 'Doubled Yield with Mulching!');

insert into public.forum_posts (owner_id, title, content, category, likes_count) 
select 
  null,
  'Drone Spraying ROI Analysis',
  'Manual ₹800/acre vs drone ₹300/acre. Investment ₹3.5L. Worth it?',
  'Technology',
  45
where not exists (select 1 from public.forum_posts where title = 'Drone Spraying ROI Analysis');
