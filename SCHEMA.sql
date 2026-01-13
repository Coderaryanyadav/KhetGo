-- KhetGo REAL Backend Schema (No Mock Data Version)

-- 1. Enable UUID
create extension if not exists "uuid-ossp";

-- 2. Profiles (Extended)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('farmer', 'buyer', 'admin')),
  avatar_url text,
  bio text,
  district text,
  pincode text,
  is_verified boolean default false,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Mandi Prices (Live Feed)
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

-- 4. Listings (Crops)
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
  gallery_urls text[],
  harvest_date date,
  is_verified boolean default false,
  lat numeric,
  lng numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure columns exist if table was already created
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='listings' and column_name='lat') then
    alter table public.listings add column lat numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='listings' and column_name='lng') then
    alter table public.listings add column lng numeric;
  end if;
end $$;

-- 5. Agri Services (Rentals)
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

-- 6. Agri Store (Products)
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

-- 7. Community Forum
create table if not exists public.forum_posts (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  category text,
  likes_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. News Articles (Agri-Buzz)
create table if not exists public.news_articles (
  id uuid default uuid_generate_v4() primary key,
  title text unique not null,
  content text,
  category text,
  image_url text,
  author_name text default 'KhetGo Editor',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure unique constraints for idempotent seeding
do $$ 
begin 
  if not exists (select 1 from information_schema.table_constraints where table_name='mandi_prices' and constraint_type='UNIQUE') then
    alter table public.mandi_prices add constraint mandi_prices_crop_unique unique (crop);
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_name='news_articles' and constraint_type='UNIQUE') then
    alter table public.news_articles add constraint news_articles_title_unique unique (title);
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_name='store_products' and constraint_type='UNIQUE') then
    alter table public.store_products add constraint store_products_name_unique unique (name);
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_name='agri_services' and constraint_type='UNIQUE') then
    alter table public.agri_services add constraint agri_services_title_unique unique (title);
  end if;
  if not exists (select 1 from information_schema.table_constraints where table_name='academy_content' and constraint_type='UNIQUE') then
    alter table public.academy_content add constraint academy_content_title_unique unique (title);
  end if;
end $$;

-- 9. Bookings & Orders
create table if not exists public.bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  item_id uuid,
  item_name text not null,
  item_type text check (item_type in ('Produce', 'Service', 'StoreProduct')),
  price_per_unit numeric,
  status text default 'pending',
  booking_date timestamp with time zone default timezone('utc'::text, now())
);

-- 10. Direct Messages
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 11. Farmer's Khata (Ledger)
create table if not exists public.ledger_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric not null,
  type text check (type in ('income', 'expense')),
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 12. KhetGo Academy (Learning Content)
create table if not exists public.academy_content (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  video_url text,
  thumbnail_url text,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 13. Security (RLS)
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

-- Policies (Basic)
drop policy if exists "Select Prof" on public.profiles;
create policy "Select Prof" on public.profiles for select using (true);

drop policy if exists "Update Prof" on public.profiles;
create policy "Update Prof" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Select Mandi" on public.mandi_prices;
create policy "Select Mandi" on public.mandi_prices for select using (true);

drop policy if exists "Select List" on public.listings;
create policy "Select List" on public.listings for select using (true);

drop policy if exists "Insert List" on public.listings;
create policy "Insert List" on public.listings for insert with check (auth.role() = 'authenticated');

drop policy if exists "Delete List" on public.listings;
create policy "Delete List" on public.listings for delete using (auth.uid() = owner_id);

drop policy if exists "Select Service" on public.agri_services;
create policy "Select Service" on public.agri_services for select using (true);

drop policy if exists "Select Store" on public.store_products;
create policy "Select Store" on public.store_products for select using (true);

drop policy if exists "Select Forum" on public.forum_posts;
create policy "Select Forum" on public.forum_posts for select using (true);

drop policy if exists "Select News" on public.news_articles;
create policy "Select News" on public.news_articles for select using (true);

drop policy if exists "Select Book" on public.bookings;
create policy "Select Book" on public.bookings for select using (auth.uid() = user_id);

drop policy if exists "Insert Book" on public.bookings;
create policy "Insert Book" on public.bookings for insert with check (auth.role() = 'authenticated');

drop policy if exists "Select Msg" on public.messages;
create policy "Select Msg" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Insert Msg" on public.messages;
create policy "Insert Msg" on public.messages for insert with check (auth.uid() = sender_id);

drop policy if exists "Select Ledger" on public.ledger_entries;
create policy "Select Ledger" on public.ledger_entries for select using (auth.uid() = user_id);

drop policy if exists "Insert Ledger" on public.ledger_entries;
create policy "Insert Ledger" on public.ledger_entries for insert with check (auth.uid() = user_id);

drop policy if exists "Select Acad" on public.academy_content;
create policy "Select Acad" on public.academy_content for select using (true);

-- 14. SEED DATA (Idempotent)
insert into public.mandi_prices (crop, price, change_pct, trend) values 
('Wheat', 2450, '+2.1%', 'up'),
('Mustard', 5600, '-1.4%', 'down'),
('Potato', 1200, '+0.5%', 'up')
on conflict (crop) do nothing;

insert into public.news_articles (title, category, image_url) values 
('New Fertilizer Subsidy Announced', 'Policy', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400'),
('Organic Farming Workshop in Nagpur', 'Event', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400')
on conflict do nothing;

insert into public.store_products (name, brand, price, unit, category, image_url) values 
('High Yield Seeds', 'Mahyco', 1200, '20kg', 'Seeds', 'https://images.unsplash.com/photo-1574943320219-553eb213f721?auto=format&fit=crop&q=80&w=400'),
('Organic Fertilizer', 'IFFCO', 850, '50kg', 'Fertilizer', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400')
on conflict do nothing;

insert into public.agri_services (title, type, price_per_day, location, image_url) values 
('Heavy Duty Tractor', 'Rental', 1500, 'Nagpur', 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400')
on conflict do nothing;

insert into public.academy_content (title, category, thumbnail_url, video_url) values 
('Mastering Drip Irrigation', 'Technical', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
('Organic Fertilizer Preparation', 'Organic', 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
on conflict do nothing;
