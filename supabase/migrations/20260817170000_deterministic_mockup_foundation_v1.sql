-- Deterministic Mockup Production Architecture V1.
-- Additive only. Historical Image input v1 rows remain NULL in new version fields.
-- This migration must be applied only through a separately authorized preflight.

alter table public.design_master_artworks
  add column if not exists pixel_width integer check (pixel_width is null or pixel_width > 0),
  add column if not exists pixel_height integer check (pixel_height is null or pixel_height > 0),
  add column if not exists transparency text check (
    transparency is null or transparency in ('HAS_ALPHA', 'OPAQUE', 'UNKNOWN')
  ),
  add column if not exists production_representations jsonb check (
    production_representations is null or jsonb_typeof(production_representations) = 'array'
  );

create table if not exists public.product_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brain_workspaces(id) on delete restrict,
  profile_key text not null,
  version integer not null default 1 check (version > 0),
  name text not null,
  product_type text not null,
  authority text not null check (authority in (
    'SHOPIFY_LIVE', 'MANUAL_PROFILE', 'SEED', 'UNKNOWN'
  )),
  shopify_product_id text,
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  colorways jsonb not null default '[]'::jsonb check (jsonb_typeof(colorways) = 'array'),
  sizes jsonb not null default '[]'::jsonb check (jsonb_typeof(sizes) = 'array'),
  collections jsonb not null default '[]'::jsonb check (jsonb_typeof(collections) = 'array'),
  active boolean,
  available boolean,
  construction jsonb not null default '{}'::jsonb check (jsonb_typeof(construction) = 'object'),
  visual_references jsonb not null default '[]'::jsonb check (jsonb_typeof(visual_references) = 'array'),
  print_regions jsonb not null default '[]'::jsonb check (jsonb_typeof(print_regions) = 'array'),
  embroidery_regions jsonb not null default '[]'::jsonb check (jsonb_typeof(embroidery_regions) = 'array'),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_key, version),
  check (
    (authority = 'SHOPIFY_LIVE' and shopify_product_id is not null)
    or (authority = 'MANUAL_PROFILE' and shopify_product_id is null)
    or authority in ('SEED', 'UNKNOWN')
  )
);

create index if not exists product_profiles_recent_idx
  on public.product_profiles (workspace_id, updated_at desc);
create index if not exists product_profiles_shopify_idx
  on public.product_profiles (workspace_id, shopify_product_id)
  where shopify_product_id is not null;

alter table public.product_profiles enable row level security;
revoke all on public.product_profiles from public, anon, authenticated;
grant select, insert, update on public.product_profiles to service_role;

alter table public.image_generation_jobs
  add column if not exists input_contract_version text check (
    input_contract_version is null or input_contract_version = 'image-generation-input-v2'
  ),
  add column if not exists production_mode text check (
    production_mode is null or production_mode in (
      'DETERMINISTIC_COMPOSITE', 'DRAFT_GENERATIVE_ARTWORK'
    )
  );

alter table public.image_generation_jobs
  add constraint image_generation_jobs_v2_mode_consistency
  check (
    (input_contract_version is null and production_mode is null)
    or (input_contract_version = 'image-generation-input-v2' and production_mode is not null)
  );

create table if not exists public.image_production_stage_outputs (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.image_generation_jobs(id) on delete restrict,
  stage text not null check (stage in ('BASE_GENERATION', 'DETERMINISTIC_COMPOSITE')),
  stage_attempt integer not null default 1 check (stage_attempt > 0),
  status text not null check (status in ('SUCCEEDED', 'FAILED')),
  storage_path text,
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{64}$'),
  provider_request_id text,
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  unique (generation_job_id, stage, stage_attempt),
  unique (generation_job_id, id),
  check (
    (status = 'SUCCEEDED' and storage_path is not null and checksum is not null)
    or (status = 'FAILED' and storage_path is null and checksum is null)
  ),
  check (stage = 'BASE_GENERATION' or provider_request_id is null)
);

create unique index if not exists image_stage_one_succeeded_base_idx
  on public.image_production_stage_outputs (generation_job_id)
  where stage = 'BASE_GENERATION' and status = 'SUCCEEDED';
create index if not exists image_stage_job_idx
  on public.image_production_stage_outputs (generation_job_id, stage, created_at desc);
create unique index if not exists image_stage_storage_path_idx
  on public.image_production_stage_outputs (storage_path)
  where storage_path is not null;

alter table public.image_production_stage_outputs enable row level security;
revoke all on public.image_production_stage_outputs from public, anon, authenticated;
grant select, insert on public.image_production_stage_outputs to service_role;

alter table public.image_production_assets
  add column if not exists base_stage_output_id uuid,
  add column if not exists composite_stage_output_id uuid,
  add column if not exists mockup_review jsonb check (
    mockup_review is null or jsonb_typeof(mockup_review) = 'object'
  );

alter table public.image_production_assets
  add constraint image_assets_base_stage_same_job_fk
    foreign key (generation_job_id, base_stage_output_id)
    references public.image_production_stage_outputs(generation_job_id, id)
    on delete restrict,
  add constraint image_assets_composite_stage_same_job_fk
    foreign key (generation_job_id, composite_stage_output_id)
    references public.image_production_stage_outputs(generation_job_id, id)
    on delete restrict;

create or replace function public.validate_image_asset_stage_lineage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.base_stage_output_id is not null and not exists (
    select 1 from public.image_production_stage_outputs stage
    where stage.id = new.base_stage_output_id
      and stage.generation_job_id = new.generation_job_id
      and stage.stage = 'BASE_GENERATION'
      and stage.status = 'SUCCEEDED'
  ) then
    raise exception 'base_stage_output_id must identify a succeeded base for the same job';
  end if;
  if new.composite_stage_output_id is not null and not exists (
    select 1 from public.image_production_stage_outputs stage
    where stage.id = new.composite_stage_output_id
      and stage.generation_job_id = new.generation_job_id
      and stage.stage = 'DETERMINISTIC_COMPOSITE'
      and stage.status = 'SUCCEEDED'
  ) then
    raise exception 'composite_stage_output_id must identify a succeeded composite for the same job';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_image_asset_stage_lineage() from public, anon, authenticated;

create trigger validate_image_asset_stage_lineage_before_write
before insert or update of generation_job_id, base_stage_output_id, composite_stage_output_id
on public.image_production_assets
for each row execute function public.validate_image_asset_stage_lineage();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-profile-references',
  'product-profile-references',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
