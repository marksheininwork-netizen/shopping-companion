-- Natural Studio Commerce only. Apply only to the dedicated NSC Free project.
-- Existing Northstar Studio and other business databases are not part of this migration.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_download boolean not null default false,
  download_object_key text unique,
  price_cents integer check (price_cents is null or price_cents > 0),
  currency text not null default 'usd' check (currency = lower(currency) and length(currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint downloadable_product_has_key check (not is_download or status <> 'active' or download_object_key is not null)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = lower(currency) and length(currency) = 3),
  stripe_checkout_session_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists products_public_catalog_idx on public.products (status, is_download);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('order', 'digital-download', 'product-question', 'accessibility', 'other')),
  message text not null check (length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'in-progress', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists support_user_created_idx on public.support_requests (user_id, created_at desc);
create index if not exists support_queue_created_idx on public.support_requests (status, created_at);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.support_requests enable row level security;

drop policy if exists "Customers read their own profile" on public.profiles;
create policy "Customers read their own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "Customers update their own profile" on public.profiles;
create policy "Customers update their own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public sees active catalog only" on public.products;
create policy "Public sees active catalog only" on public.products
  for select to anon, authenticated using (status = 'active');

drop policy if exists "Customers read their own orders" on public.orders;
create policy "Customers read their own orders" on public.orders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Customers read their own support requests" on public.support_requests;
create policy "Customers read their own support requests" on public.support_requests
  for select to authenticated using (auth.uid() = user_id);

-- Checkout and support writes use service-role Edge Functions. No customer insert/update
-- policy is granted for orders, webhook events, or support requests.
-- Paid assets are stored in a private bucket. With no object policies, customer access
-- is denied; the download Edge Function creates a brief signed URL after checking payment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nsc-digital-products', 'nsc-digital-products', false, 20971520, array['application/pdf', 'image/png', 'image/svg+xml'])
on conflict (id) do update set public = false;

create or replace function public.handle_new_nsc_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_nsc_user_created on auth.users;
create trigger on_nsc_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_nsc_user();

-- The Edge Function verifies Stripe's signature before calling this atomic, service-only RPC.
create or replace function public.apply_nsc_stripe_event(
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_order_id uuid,
  p_payment_status text,
  p_amount_cents integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  already_processed boolean;
  affected integer;
  expected_amount integer;
  expected_currency text;
  expected_session text;
  expected_status text;
begin
  insert into public.stripe_webhook_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;

  select processed into already_processed
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if already_processed then
    return 'duplicate';
  end if;

  if p_event_type = 'checkout.session.async_payment_failed' then
    update public.orders
      set status = 'failed', updated_at = now()
      where id = p_order_id
        and stripe_checkout_session_id = p_session_id
        and status = 'pending';
    get diagnostics affected = row_count;
    if affected = 0 then return 'unmatched'; end if;
    update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
    return 'failed';
  end if;

  if p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
    return 'ignored';
  end if;

  if p_payment_status <> 'paid' then
    update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
    return 'unpaid';
  end if;

  select amount_cents, currency, stripe_checkout_session_id, status
    into expected_amount, expected_currency, expected_session, expected_status
    from public.orders
    where id = p_order_id
    for update;

  if not found then
    -- Leave unmatched events retryable. A fast checkout can race the session-id update.
    return 'unmatched';
  end if;

  if expected_session is distinct from p_session_id
     or expected_amount <> p_amount_cents
     or expected_currency <> lower(p_currency) then
    update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
    return 'mismatch';
  end if;

  if expected_status = 'paid' then
    update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
    return 'already-paid';
  end if;

  if expected_status <> 'pending' then
    update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
    return 'mismatch';
  end if;

  update public.orders
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = p_order_id;

  update public.stripe_webhook_events set processed = true, processed_at = now() where event_id = p_event_id;
  return 'paid';
end;
$$;

revoke all on function public.apply_nsc_stripe_event(text, text, text, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.apply_nsc_stripe_event(text, text, text, uuid, text, integer, text) to service_role;

revoke all on public.profiles, public.products, public.orders, public.stripe_webhook_events, public.support_requests from anon, authenticated;
grant select on public.products to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.orders, public.support_requests to authenticated;
