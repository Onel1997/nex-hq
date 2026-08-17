-- Persona Foundation Milestone 2
-- Server-authorized Persona access with RLS as deny-by-default defense in depth.
--
-- NexHQ has no durable user↔workspace membership relation yet. It is therefore
-- unsafe to invent authenticated-user workspace policies. Persona tables are
-- intentionally server-only: service-role repositories operate only after the
-- application authorization guard, while anon/authenticated direct access is
-- revoked and receives no permissive RLS policy.

-- Milestone 1 prerequisite and review/persona/workspace consistency for new
-- lock snapshots. NOT VALID preserves legacy rows while enforcing new writes.
do $$
begin
  if to_regclass('public.persona_identity_lock_snapshots') is null
     or to_regclass('public.persona_identity_reviews') is null then
    raise exception
      'Persona foundation prerequisite tables are missing; apply prior Persona migrations first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'persona_identity_lock_snapshots'
      and column_name = 'identity_review_id'
  ) then
    raise exception
      'Milestone 1 identity_review_id is missing; apply 20260816210000 first.';
  end if;
end $$;

create unique index if not exists persona_identity_reviews_scope_identity_idx
  on public.persona_identity_reviews (workspace_id, persona_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'persona_lock_review_scope_fk'
      and conrelid = 'public.persona_identity_lock_snapshots'::regclass
  ) then
    alter table public.persona_identity_lock_snapshots
      add constraint persona_lock_review_scope_fk
      foreign key (workspace_id, persona_id, identity_review_id)
      references public.persona_identity_reviews (workspace_id, persona_id, id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'persona_lock_review_time_check'
      and conrelid = 'public.persona_identity_lock_snapshots'::regclass
  ) then
    alter table public.persona_identity_lock_snapshots
      add constraint persona_lock_review_time_check
      check (identity_review_id is null or identity_reviewed_at is not null)
      not valid;
  end if;
end $$;

-- Remove every known permissive or ineffective direct-client Persona policy.
drop policy if exists "persona_personas_select" on public.persona_personas;
drop policy if exists "persona_personas_insert" on public.persona_personas;
drop policy if exists "persona_personas_update" on public.persona_personas;
drop policy if exists "persona_personas_delete" on public.persona_personas;
drop policy if exists "persona_locations_all" on public.persona_locations;
drop policy if exists "persona_camera_presets_all" on public.persona_camera_presets;
drop policy if exists "persona_poses_all" on public.persona_poses;
drop policy if exists "persona_brand_looks_all" on public.persona_brand_looks;
drop policy if exists "persona_outfits_all" on public.persona_outfits;
drop policy if exists "persona_reference_assets_all" on public.persona_reference_assets;
drop policy if exists "persona_persona_locations_all" on public.persona_persona_locations;
drop policy if exists "persona_persona_camera_presets_all" on public.persona_persona_camera_presets;
drop policy if exists "persona_persona_poses_all" on public.persona_persona_poses;
drop policy if exists "persona_persona_brand_looks_all" on public.persona_persona_brand_looks;
drop policy if exists "persona_persona_outfits_all" on public.persona_persona_outfits;
drop policy if exists "persona_creation_projects_all" on public.persona_creation_projects;
drop policy if exists "persona_candidates_all" on public.persona_candidates;
drop policy if exists "persona_candidate_assets_all" on public.persona_candidate_assets;
drop policy if exists "persona_identity_reviews_all" on public.persona_identity_reviews;
drop policy if exists "persona_brand_cast_requirements_all" on public.persona_brand_cast_requirements;
drop policy if exists persona_generation_jobs_service_all on public.persona_generation_jobs;
drop policy if exists persona_generation_confirmations_service_all on public.persona_generation_confirmations;
drop policy if exists persona_discovery_attempts_service_all on public.persona_discovery_attempts;
drop policy if exists novelty_records_workspace_read on public.persona_face_novelty_records;
drop policy if exists face_emb_backfill_jobs_workspace_read on public.persona_face_embedding_backfill_jobs;
drop policy if exists face_emb_backfill_results_workspace_read on public.persona_face_embedding_backfill_results;

-- All inspected Persona persistence is server-side. Enable RLS consistently and
-- revoke direct anon/authenticated access without affecting service_role.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'persona_personas',
    'persona_locations',
    'persona_camera_presets',
    'persona_poses',
    'persona_brand_looks',
    'persona_outfits',
    'persona_reference_assets',
    'persona_persona_locations',
    'persona_persona_camera_presets',
    'persona_persona_poses',
    'persona_persona_brand_looks',
    'persona_persona_outfits',
    'persona_creation_projects',
    'persona_candidates',
    'persona_candidate_assets',
    'persona_identity_reviews',
    'persona_brand_cast_requirements',
    'persona_generation_jobs',
    'persona_generation_confirmations',
    'persona_discovery_attempts',
    'persona_face_novelty_records',
    'persona_face_embedding_backfill_jobs',
    'persona_face_embedding_backfill_results',
    'persona_reference_package_sessions',
    'persona_reference_package_attempts',
    'persona_identity_lock_snapshots'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      table_name
    );
    -- RLS bypass alone is not a table grant. Keep server repositories
    -- operational even if project default privileges differ.
    execute format(
      'grant all privileges on table public.%I to service_role',
      table_name
    );
  end loop;
end $$;

comment on table public.persona_identity_lock_snapshots is
  'Immutable Persona Identity Lock snapshots. Direct anon/authenticated access is denied; server authorization is mandatory.';
