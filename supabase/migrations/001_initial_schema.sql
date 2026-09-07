-- 1. PROFILES TABLE
create table profiles (
  -- Core Identity
  id uuid references auth.users not null primary key,
  email text not null,
  username text unique,
  avatar_url text,
  bio text,
  
  -- Preferences & Settings
  theme text default 'dark',
  custom_theme jsonb,
  last_non_custom_theme text,
  currency text default 'USD',
  plan text default 'free',
  onboarding_completed boolean default false,
  
  -- Creator Profile Metadata
  software text[],
  style text[],
  
  -- Shop Customization
  shop_settings jsonb default '{
    "bg_color": "var(--color-bg)",
    "accent_color": "var(--color-accent)",
    "banner_url": null,
    "profile_image_url": null,
    "card_radius": "16px",
    "shadow_intensity": "0.05",
    "show_follower_count": false,
    "external_links": []
  }'::jsonb,
  
  -- E-commerce Mocks
  products text[] default '{}',
  purchases text[] default '{}',
  wishlist_collections jsonb default '[{"id": "default", "name": "Saved Items", "isPublic": false, "items": []}]'::jsonb,
  
  -- Financial Metrics
  balance integer default 0,
  sales_count integer default 0,
  revenue integer default 0,
  
  -- Gamification
  xp integer default 0,
  level integer default 1,
  next_level_xp integer default 200,
  streak integer default 0,
  last_claimed_date timestamptz,
  unlocked_badges text[] default '{}',
  displayed_badges text[] default '{}',
  selected_frame text default 'none',
  
  -- Timestamps
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table profiles enable row level security;

-- Profiles Policies
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, avatar_url)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. FOLLOWS JOIN TABLE
create table follows (
  follower_id uuid references profiles(id) not null,
  creator_id uuid references profiles(id) not null,
  last_viewed_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (follower_id, creator_id),
  constraint no_self_follow check (follower_id <> creator_id)
);

-- Enable RLS on follows
alter table follows enable row level security;

-- Follows Policies
create policy "Users can view own follows"
  on follows for select
  using ( auth.uid() = follower_id );

create policy "Users can insert own follows"
  on follows for insert
  with check ( auth.uid() = follower_id );

create policy "Users can update own follows"
  on follows for update
  using ( auth.uid() = follower_id );

create policy "Users can delete own follows"
  on follows for delete
  using ( auth.uid() = follower_id );

-- 3. PUBLIC VIEWS
create view public_profiles as
select 
  id, 
  username, 
  avatar_url, 
  bio, 
  software, 
  style, 
  shop_settings, 
  unlocked_badges, 
  displayed_badges, 
  selected_frame,
  -- Compute Tier server-side to prevent leaking raw sales data
  CASE 
    WHEN sales_count >= 200 THEN 'platinum'
    WHEN sales_count >= 50 THEN 'gold'
    WHEN sales_count >= 10 THEN 'silver'
    ELSE 'bronze'
  END as tier
from profiles;

-- Grant access to public view
grant select on public_profiles to anon, authenticated;

create view public_follower_counts as
select
  creator_id,
  count(*) as follower_count
from follows
group by creator_id;

-- Grant access to counts view
grant select on public_follower_counts to anon, authenticated;
