-- Xeriamo global maintenance gate. Infrastructure remains online; only
-- customer/public product access is paused by the application boundary.
create table if not exists public.xeriano_system_status (
  id text primary key check (id = 'XERIAMO'),
  maintenance_enabled boolean not null default false,
  maintenance_message text check (
    maintenance_message is null
    or char_length(maintenance_message) between 1 and 1000
  ),
  maintenance_expected_back_at timestamptz,
  maintenance_discord_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete restrict
);

create table if not exists public.xeriano_system_status_events (
  id uuid primary key default gen_random_uuid(),
  previous_state text not null check (previous_state in ('ONLINE','MAINTENANCE')),
  next_state text not null check (next_state in ('ONLINE','MAINTENANCE')),
  maintenance_message text check (
    maintenance_message is null
    or char_length(maintenance_message) between 1 and 1000
  ),
  maintenance_expected_back_at timestamptz,
  maintenance_discord_enabled boolean not null default false,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists xeriano_system_status_events_created_idx
  on public.xeriano_system_status_events(created_at desc);

insert into public.xeriano_system_status(id,maintenance_enabled)
values('XERIAMO',false)
on conflict(id) do nothing;

alter table public.xeriano_system_status enable row level security;
alter table public.xeriano_system_status_events enable row level security;
revoke all on public.xeriano_system_status,public.xeriano_system_status_events
  from public,anon,authenticated;
grant all on public.xeriano_system_status,public.xeriano_system_status_events
  to service_role;

-- Public/sessionless read authority returns only presentation-safe fields.
-- Actor IDs and the audit trail stay service-role only.
create or replace function public.xeriano_get_public_maintenance_status()
returns table(
  maintenance_enabled boolean,
  maintenance_message text,
  maintenance_expected_back_at timestamptz,
  maintenance_discord_enabled boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    status.maintenance_enabled,
    status.maintenance_message,
    status.maintenance_expected_back_at,
    status.maintenance_discord_enabled,
    status.updated_at
  from public.xeriano_system_status as status
  where status.id = 'XERIAMO'
  limit 1;
$$;

-- The application proves exact OWNER authority before invoking this
-- service-role-only transaction. The row lock keeps status + audit atomic.
create or replace function public.xeriano_set_maintenance_status(
  p_maintenance_enabled boolean,
  p_maintenance_message text,
  p_maintenance_expected_back_at timestamptz,
  p_maintenance_discord_enabled boolean,
  p_actor_user_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_enabled boolean;
  v_message text;
begin
  if p_actor_user_id is null then
    raise exception using errcode = 'P0001', message = 'XERIAMO_MAINTENANCE_ACTOR_REQUIRED';
  end if;

  v_message := nullif(btrim(p_maintenance_message), '');
  if v_message is not null and char_length(v_message) > 1000 then
    raise exception using errcode = '22023', message = 'XERIAMO_MAINTENANCE_MESSAGE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('xeriamo-system-status', 0));
  select maintenance_enabled into v_previous_enabled
  from public.xeriano_system_status
  where id = 'XERIAMO'
  for update;

  if v_previous_enabled is null then
    raise exception using errcode = 'P0001', message = 'XERIAMO_SYSTEM_STATUS_MISSING';
  end if;

  update public.xeriano_system_status
  set maintenance_enabled = p_maintenance_enabled,
      maintenance_message = v_message,
      maintenance_expected_back_at = p_maintenance_expected_back_at,
      maintenance_discord_enabled = p_maintenance_discord_enabled,
      updated_at = now(),
      updated_by = p_actor_user_id
  where id = 'XERIAMO';

  insert into public.xeriano_system_status_events(
    previous_state,next_state,maintenance_message,
    maintenance_expected_back_at,maintenance_discord_enabled,actor_user_id
  ) values (
    case when v_previous_enabled then 'MAINTENANCE' else 'ONLINE' end,
    case when p_maintenance_enabled then 'MAINTENANCE' else 'ONLINE' end,
    v_message,p_maintenance_expected_back_at,p_maintenance_discord_enabled,
    p_actor_user_id
  );
end;
$$;

revoke all on function public.xeriano_get_public_maintenance_status()
  from public,anon,authenticated;
grant execute on function public.xeriano_get_public_maintenance_status()
  to anon,authenticated,service_role;

revoke all on function public.xeriano_set_maintenance_status(boolean,text,timestamptz,boolean,uuid)
  from public,anon,authenticated;
grant execute on function public.xeriano_set_maintenance_status(boolean,text,timestamptz,boolean,uuid)
  to service_role;
