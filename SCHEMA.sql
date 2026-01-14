-- KhetGo: All-in-One Supabase Backend Schema
-- Comprehensive tables, RLS policies, triggers, and premium seed data

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLES

-- Profiles Registry
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

-- Mandi Prices (Volatility Feed)
create table if not exists public.mandi_prices (
  id uuid default uuid_generate_v4() primary key,
  crop text unique not null,
  price numeric not null,
  unit text default 'Quintal',
  trend text check (trend in ('up', 'down', 'stable')),
  change_pct text,
  market_name text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Marketplace Listings
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
  image_url text,
  harvest_date date,
  is_verified boolean default false,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Agri Services (Rentals)
create table if not exists public.agri_services (
  id uuid default uuid_generate_v4() primary key,
  title text unique not null,
  type text,
  price_per_day numeric,
  provider_id uuid references public.profiles(id),
  image_url text,
  location text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Agri Store (Premium Products)
create table if not exists public.store_products (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  brand text,
  price numeric not null,
  unit text,
  category text,
  image_url text,
  description text,
  stock_status text default 'In Stock',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Community Forum Posts
create table if not exists public.forum_posts (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  category text,
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- News Articles (Intelligence Feed)
create table if not exists public.news_articles (
  id uuid default uuid_generate_v4() primary key,
  title text unique not null,
  content text,
  category text,
  image_url text,
  author_name text default 'KhetGo Editor',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Bookings & Transaction Records
create table if not exists public.bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  item_name text not null,
  item_type text check (item_type in ('Produce', 'Service', 'Product')),
  price_per_unit numeric,
  status text default 'pending',
  booking_date timestamp with time zone default timezone('utc'::text, now())
);

-- Encrypted Message Threads
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Farmer's Khata (Digital Ledger)
create table if not exists public.ledger_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric not null,
  type text check (type in ('income', 'expense')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- KhetGo Academy (Educational Assets)
create table if not exists public.academy_content (
  id uuid default uuid_generate_v4() primary key,
  title text unique not null,
  description text,
  video_url text,
  thumbnail_url text,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. AUTOMATION (TRIGGERS)

-- Create a profile automatically when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'farmer'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. SECURITY (RLS & POLICIES)

-- Enable RLS on all tables
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

-- Profile Policies
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Mandi Policies
create policy "Mandi data is viewable by everyone" on public.mandi_prices for select using (true);
create policy "Admins can manage mandi prices" on public.mandi_prices for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Marketplace Policies
create policy "Listings are viewable by everyone" on public.listings for select using (true);
create policy "Authenticated users can create listings" on public.listings for insert with check (auth.role() = 'authenticated');
create policy "Owners can manage their listings" on public.listings for all using (
  auth.uid() = owner_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Agri Store & Services Policies
create policy "Store and Services are viewable by everyone" on public.agri_services for select using (true);
create policy "Store products are viewable by everyone" on public.store_products for select using (true);
create policy "Admins can manage store and services" on public.store_products for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can manage agri services" on public.agri_services for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Forum & News Policies
create policy "Forum posts are viewable by everyone" on public.forum_posts for select using (true);
create policy "Members can create forum posts" on public.forum_posts for insert with check (auth.role() = 'authenticated');
create policy "News is viewable by everyone" on public.news_articles for select using (true);
create policy "Admins can manage news" on public.news_articles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Transactions & Bookings Policies
create policy "Users can see their own bookings" on public.bookings for select using (
  auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Authenticated users can create bookings" on public.bookings for insert with check (auth.role() = 'authenticated');

-- Ledger Policies
create policy "Users can see their own ledger" on public.ledger_entries for select using (auth.uid() = user_id);
create policy "Users can manage their own ledger" on public.ledger_entries for all using (auth.uid() = user_id);

-- Communication Policies
create policy "Users can see their own messages" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can send messages" on public.messages for insert with check (auth.uid() = sender_id);

-- Academy Policies
create policy "Academy content is viewable by everyone" on public.academy_content for select using (true);
create policy "Admins can manage academy content" on public.academy_content for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 5. PREMIUM SEED DATA

-- Volatile Market Feed
insert into public.mandi_prices (crop, price, change_pct, trend, market_name) values 
('Premium Wheat', 2850, '+3.2%', 'up', 'Nagpur Central Mandi'),
('Mustard Grade-A', 5400, '-1.8%', 'down', 'Indore Hub'),
('Sona Masuri Rice', 4200, '+0.5%', 'up', 'Nashik Market'),
('Organic Potatoes', 1800, '+2.4%', 'up', 'Pune Agri Hub'),
('Red Onions', 2100, '-0.9%', 'down', 'Solapur Mandi')
on conflict (crop) do nothing;

-- Intelligence Feed
insert into public.news_articles (title, category, content, image_url) values 
('Export Ban Lifted on Basmati Rice', 'Global Trade', 'The government has lifted the minimum export price for Basmati rice, initializing a massive surge in international demand.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400'),
('New Drone Subsidies for Precision Farming', 'Technology', 'Certified farmers can now apply for a 50% subsidy on agricultural drones for automated field monitoring.', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400')
on conflict (title) do nothing;

-- Premium Inventory
insert into public.store_products (name, brand, price, unit, category, image_url, description) values 
('Bio-Boost Organic Fertilizer', 'GreenGrow', 1250, '50kg Bag', 'Organic Fertilizer', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'Laboratory-tested organic catalyst for soil health.'),
('High-Yield Paddy Seeds', 'Mahindra', 3400, '25kg Pack', 'Verified Seeds', 'https://images.unsplash.com/photo-1574943320219-553eb213f721?auto=format&fit=crop&q=80&w=400', 'Optimized for high-yield performance in diverse climates.'),
('Power-Blade Cultivator', 'TATA Agri', 18500, 'Unit', 'Modern Tools', 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400', 'Industrial-strength hand cultivator for precise soil prep.')
on conflict (name) do nothing;

-- Industrial Rental Hub
insert into public.agri_services (title, type, price_per_day, location, image_url) values 
('Tractor 55HP (Double Clutch)', 'Industrial', 2500, 'Maharashtra Region', 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400'),
('Laser Land Leveler', 'Precision', 4500, 'Punjab/Haryana Hub', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=400'),
('Digital Soil Sensor System', 'Diagnostic', 800, 'All-India Service', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400')
on conflict (title) do nothing;

-- Intelligence Modules (Academy)
insert into public.academy_content (title, category, description, thumbnail_url, video_url) values 
('Quantum Crop Diagnostics', 'Technical', 'Advanced methods for identifying spectral signatures of crop stress.', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Supply Chain Liquidity', 'Economic', 'Managing financial reserves during high market volatility.', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
on conflict (title) do nothing;
