
-- Madan Official Market
-- Database awal untuk profil, katalog, dan chat pelanggan.

create extension if not exists pgcrypto;

-- Profil pengguna.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer'
    check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Katalog produk.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric(14, 2) not null default 0 check (price >= 0),
  category text not null default 'Lainnya',
  image_url text,
  created_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Percakapan pelanggan dengan admin.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

-- Pesan dalam percakapan.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists products_published_created_idx
  on public.products (is_published, created_at desc);

create index if not exists conversations_customer_idx
  on public.conversations (customer_id, created_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- Buat profil otomatis ketika akun Auth didaftarkan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Fungsi pemeriksaan admin.
-- SECURITY DEFINER mencegah kebijakan profil memanggil dirinya sendiri.
create or replace function public.is_madan_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_madan_admin() from public;
grant execute on function public.is_madan_admin()
  to anon, authenticated;

-- Aktifkan Row Level Security.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- PROFILES
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_madan_admin());

drop policy if exists "Users can update own display name" on public.profiles;
create policy "Users can update own display name"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role = 'customer');

-- PRODUCTS
drop policy if exists "Published products are public" on public.products;
create policy "Published products are public"
on public.products for select
to anon, authenticated
using (is_published = true or public.is_madan_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products for insert
to authenticated
with check (
  public.is_madan_admin()
  and created_by = (select auth.uid())
);

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products for update
to authenticated
using (public.is_madan_admin())
with check (public.is_madan_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products for delete
to authenticated
using (public.is_madan_admin());

-- CONVERSATIONS
drop policy if exists "Customers and admins can view conversations"
  on public.conversations;
create policy "Customers and admins can view conversations"
on public.conversations for select
to authenticated
using (
  customer_id = (select auth.uid())
  or public.is_madan_admin()
);

drop policy if exists "Customers can start conversations"
  on public.conversations;
create policy "Customers can start conversations"
on public.conversations for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'open'
);

drop policy if exists "Admins can update conversations"
  on public.conversations;
create policy "Admins can update conversations"
on public.conversations for update
to authenticated
using (public.is_madan_admin())
with check (public.is_madan_admin());

-- MESSAGES
drop policy if exists "Conversation participants can read messages"
  on public.messages;
create policy "Conversation participants can read messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (
        c.customer_id = (select auth.uid())
        or public.is_madan_admin()
      )
  )
);

drop policy if exists "Conversation participants can send messages"
  on public.messages;
create policy "Conversation participants can send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.status = 'open'
      and (
        c.customer_id = (select auth.uid())
        or public.is_madan_admin()
      )
  )
);

-- Storage untuk foto produk.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_madan_admin()
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_madan_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_madan_admin()
);

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_madan_admin()
);

-- Aktifkan Realtime untuk pesan chat.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime belum tersedia; aktifkan Realtime melalui dashboard Supabase.';
end;
$$;
