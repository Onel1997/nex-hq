-- Xeriano V1 identity and tenancy authority.
-- Additive and intentionally unapplied until an owner-controlled rollout.

do $$ begin
  create type public.xeriano_role as enum ('OWNER', 'ADMIN', 'CUSTOMER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.xeriano_membership_status as enum ('ACTIVE', 'SUSPENDED', 'REMOVED');
exception when duplicate_object then null; end $$;

create table if not exists public.xeriano_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  locale text not null default 'de' check (locale in ('de', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xeriano_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  studio_workspace_key text not null unique check (studio_workspace_key ~ '^[a-zA-Z0-9_-]{1,128}$'),
  brain_workspace_id uuid unique references public.brain_workspaces(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xeriano_account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.xeriano_role not null default 'CUSTOMER',
  status public.xeriano_membership_status not null default 'ACTIVE',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create unique index if not exists xeriano_memberships_one_primary_per_user
  on public.xeriano_account_memberships(user_id) where is_primary and status = 'ACTIVE';
create index if not exists xeriano_memberships_account_idx
  on public.xeriano_account_memberships(account_id, status, role);
create index if not exists xeriano_memberships_user_idx
  on public.xeriano_account_memberships(user_id, status);

create or replace function public.xeriano_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.xeriano_touch_updated_at() from public;

drop trigger if exists xeriano_profiles_touch_updated_at on public.xeriano_profiles;
create trigger xeriano_profiles_touch_updated_at
  before update on public.xeriano_profiles
  for each row execute function public.xeriano_touch_updated_at();
drop trigger if exists xeriano_accounts_touch_updated_at on public.xeriano_accounts;
create trigger xeriano_accounts_touch_updated_at
  before update on public.xeriano_accounts
  for each row execute function public.xeriano_touch_updated_at();
drop trigger if exists xeriano_memberships_touch_updated_at on public.xeriano_account_memberships;
create trigger xeriano_memberships_touch_updated_at
  before update on public.xeriano_account_memberships
  for each row execute function public.xeriano_touch_updated_at();

create or replace function public.xeriano_is_account_member(
  p_account_id uuid,
  p_roles public.xeriano_role[] default null
) returns boolean
language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.xeriano_account_memberships m
    where m.account_id = p_account_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and (p_roles is null or m.role = any(p_roles))
  );
$$;

revoke all on function public.xeriano_is_account_member(uuid, public.xeriano_role[]) from public;
grant execute on function public.xeriano_is_account_member(uuid, public.xeriano_role[]) to authenticated, service_role;

create or replace function public.xeriano_provision_customer_account()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_account_id uuid := gen_random_uuid();
  v_name text;
begin
  v_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Xeriano'
    ),
    120
  );
  insert into public.xeriano_profiles(user_id, display_name)
  values (new.id, v_name) on conflict (user_id) do nothing;
  insert into public.xeriano_accounts(id, slug, name, created_by, studio_workspace_key)
  values (v_account_id, 'x-' || replace(new.id::text, '-', ''), v_name, new.id, v_account_id::text);
  insert into public.xeriano_account_memberships(account_id, user_id, role, status, is_primary)
  values (v_account_id, new.id, 'CUSTOMER', 'ACTIVE', true);
  return new;
end;
$$;

revoke all on function public.xeriano_provision_customer_account() from public;

drop trigger if exists xeriano_auth_user_provision on auth.users;
create trigger xeriano_auth_user_provision
  after insert on auth.users for each row execute function public.xeriano_provision_customer_account();

alter table public.xeriano_profiles enable row level security;
alter table public.xeriano_accounts enable row level security;
alter table public.xeriano_account_memberships enable row level security;

revoke all on public.xeriano_profiles, public.xeriano_accounts, public.xeriano_account_memberships from public, anon, authenticated;
grant select on public.xeriano_profiles, public.xeriano_accounts, public.xeriano_account_memberships to authenticated;
grant update(display_name, locale) on public.xeriano_profiles to authenticated;

drop policy if exists xeriano_profiles_read_self on public.xeriano_profiles;
create policy xeriano_profiles_read_self on public.xeriano_profiles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists xeriano_profiles_update_self on public.xeriano_profiles;
create policy xeriano_profiles_update_self on public.xeriano_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists xeriano_accounts_read_member on public.xeriano_accounts;
create policy xeriano_accounts_read_member on public.xeriano_accounts
  for select to authenticated using (public.xeriano_is_account_member(id));
drop policy if exists xeriano_memberships_read_self on public.xeriano_account_memberships;
create policy xeriano_memberships_read_self on public.xeriano_account_memberships
  for select to authenticated using (user_id = auth.uid());

grant all on public.xeriano_profiles, public.xeriano_accounts, public.xeriano_account_memberships to service_role;
