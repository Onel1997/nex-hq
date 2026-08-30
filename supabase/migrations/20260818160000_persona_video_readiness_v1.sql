-- Persona Video Identity Readiness + explicit Video Use Approval V1
-- Additive only. No existing Persona, approval, or historical job is rewritten.

alter table public.persona_personas
  add column if not exists video_identity_review_id uuid,
  add column if not exists video_identity_ready_at timestamptz,
  add column if not exists video_identity_ready_by uuid,
  add column if not exists video_identity_ready_lock_snapshot_id uuid,
  add column if not exists video_identity_ready_lock_version integer,
  add column if not exists video_identity_ready_identity_fingerprint text,
  add column if not exists video_identity_ready_reference_package_fingerprint text,
  add column if not exists video_use_approval_review_id uuid,
  add column if not exists video_use_approval_lock_snapshot_id uuid,
  add column if not exists video_use_approval_lock_version integer,
  add column if not exists video_use_approval_identity_fingerprint text,
  add column if not exists video_use_approval_reference_package_fingerprint text;

alter table public.persona_personas
  add constraint persona_video_ready_lock_version_positive
    check (
      video_identity_ready_lock_version is null
      or video_identity_ready_lock_version > 0
    ),
  add constraint persona_video_approval_lock_version_positive
    check (
      video_use_approval_lock_version is null
      or video_use_approval_lock_version > 0
    ),
  add constraint persona_video_ready_evidence_complete
    check (
      video_identity_ready = false
      or (
        video_identity_review_id is not null
        and video_identity_ready_at is not null
        and video_identity_ready_by is not null
        and video_identity_ready_lock_snapshot_id is not null
        and video_identity_ready_lock_version is not null
        and nullif(video_identity_ready_identity_fingerprint, '') is not null
        and nullif(video_identity_ready_reference_package_fingerprint, '') is not null
      )
    ) not valid,
  add constraint persona_video_approval_evidence_complete
    check (
      video_use_approved = false
      or (
        video_use_approved_at is not null
        and video_use_approved_by is not null
        and video_use_approval_review_id is not null
        and video_use_approval_lock_snapshot_id is not null
        and video_use_approval_lock_version is not null
        and nullif(video_use_approval_identity_fingerprint, '') is not null
        and nullif(video_use_approval_reference_package_fingerprint, '') is not null
      )
    ) not valid;

create unique index if not exists persona_identity_lock_snapshots_id_workspace_uidx
  on public.persona_identity_lock_snapshots (id, workspace_id);
create unique index if not exists brain_events_id_workspace_uidx
  on public.brain_events (id, workspace_id);

alter table public.persona_personas
  add constraint persona_video_ready_lock_snapshot_fk
    foreign key (video_identity_ready_lock_snapshot_id, workspace_id)
    references public.persona_identity_lock_snapshots(id, workspace_id)
    on delete restrict
    not valid,
  add constraint persona_video_approval_lock_snapshot_fk
    foreign key (video_use_approval_lock_snapshot_id, workspace_id)
    references public.persona_identity_lock_snapshots(id, workspace_id)
    on delete restrict
    not valid,
  add constraint persona_video_identity_review_event_fk
    foreign key (video_identity_review_id, workspace_id)
    references public.brain_events(id, workspace_id)
    on delete restrict
    not valid,
  add constraint persona_video_approval_review_event_fk
    foreign key (video_use_approval_review_id, workspace_id)
    references public.brain_events(id, workspace_id)
    on delete restrict
    not valid;

create index if not exists persona_personas_video_eligibility_idx
  on public.persona_personas (
    workspace_id,
    video_identity_ready,
    video_use_approved,
    identity_lock_version
  );

comment on column public.persona_personas.video_identity_review_id is
  'Immutable brain_events ID for the current human Video identity review.';
comment on column public.persona_personas.video_identity_ready_lock_snapshot_id is
  'Exact Identity Lock snapshot approved by the current human Video identity review.';
comment on column public.persona_personas.video_identity_ready_reference_package_fingerprint is
  'Exact locked reference package fingerprint reviewed for Video identity readiness.';
comment on column public.persona_personas.video_use_approval_review_id is
  'Exact current Video identity review explicitly approved for Video Studio use.';
comment on column public.persona_personas.video_use_approval_lock_snapshot_id is
  'Exact Identity Lock snapshot bound by explicit Video Studio use approval.';

-- Existing table RLS and grants remain unchanged. These columns are reachable
-- only through the same server-authorized Persona repository boundary.

create or replace function public.record_persona_video_identity_review(
  p_workspace_id uuid,
  p_persona_id uuid,
  p_operation_id uuid,
  p_reviewer_id uuid,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona public.persona_personas%rowtype;
  v_snapshot public.persona_identity_lock_snapshots%rowtype;
  v_existing public.brain_events%rowtype;
  v_created_at timestamptz;
  v_decision text := p_evidence ->> 'decision';
  v_check_count integer;
  v_failed_checks integer;
  v_rights_count integer;
  v_same_current_review boolean;
begin
  select * into v_persona
  from public.persona_personas
  where id = p_persona_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'persona_not_found_or_wrong_workspace'; end if;
  if v_persona.identity_lock_status <> 'approved' then
    raise exception 'current_identity_lock_required';
  end if;

  select * into v_snapshot
  from public.persona_identity_lock_snapshots
  where id = (p_evidence ->> 'identityLockSnapshotId')::uuid
    and workspace_id = p_workspace_id
    and persona_id = p_persona_id
    and identity_lock_version = (p_evidence ->> 'identityLockVersion')::integer;
  if not found
    or v_persona.identity_lock_version <> v_snapshot.identity_lock_version
    or v_snapshot.reference_package_fingerprint <> p_evidence ->> 'identityFingerprint'
    or v_snapshot.reference_package_fingerprint <> p_evidence ->> 'referencePackageFingerprint'
    or v_snapshot.master_reference_asset_id <> (p_evidence ->> 'masterReferenceAssetId')::uuid
  then
    raise exception 'stale_or_mismatched_video_identity_review';
  end if;

  if jsonb_array_length(p_evidence -> 'canonicalReferenceAssetIds') <> 5
    or not (p_evidence -> 'canonicalReferenceAssetIds') @>
      to_jsonb(array[
        v_snapshot.front_asset_id,
        v_snapshot.three_quarter_left_asset_id,
        v_snapshot.three_quarter_right_asset_id,
        v_snapshot.left_profile_asset_id,
        v_snapshot.right_profile_asset_id
      ])
  then
    raise exception 'mismatched_video_reference_package';
  end if;

  select count(*) into v_rights_count
  from public.persona_reference_assets
  where workspace_id = p_workspace_id
    and persona_id = p_persona_id
    and rights_confirmed = true
    and id = any(array[
      v_snapshot.master_reference_asset_id,
      v_snapshot.front_asset_id,
      v_snapshot.three_quarter_left_asset_id,
      v_snapshot.three_quarter_right_asset_id,
      v_snapshot.left_profile_asset_id,
      v_snapshot.right_profile_asset_id
    ]);
  if v_rights_count <> 6 then raise exception 'video_reference_rights_missing'; end if;

  select count(*), count(*) filter (where value <> 'true'::jsonb)
  into v_check_count, v_failed_checks
  from jsonb_each(coalesce(p_evidence -> 'checklist', '{}'::jsonb));
  if v_decision not in ('APPROVE', 'REJECT') then
    raise exception 'invalid_video_identity_review_decision';
  end if;
  if v_decision = 'APPROVE' and (v_check_count <> 9 or v_failed_checks <> 0) then
    raise exception 'video_identity_review_checklist_incomplete';
  end if;

  select * into v_existing from public.brain_events where id = p_operation_id;
  if found and (
    v_existing.workspace_id is distinct from p_workspace_id
    or v_existing.record_id is distinct from p_persona_id
    or v_existing.payload is distinct from p_evidence
  ) then
    raise exception 'video_identity_review_operation_conflict';
  end if;
  if not found then
    insert into public.brain_events (
      id, workspace_id, event_type, domain, record_id, actor_type, actor_id, payload
    ) values (
      p_operation_id,
      p_workspace_id,
      case when v_decision = 'APPROVE'
        then 'persona.video_identity_review_approved'
        else 'persona.video_identity_review_rejected' end,
      'persona_studio', p_persona_id, 'human', p_reviewer_id::text, p_evidence
    ) returning created_at into v_created_at;
  else
    v_created_at := v_existing.created_at;
  end if;

  v_same_current_review :=
    v_persona.video_identity_review_id = p_operation_id
    and v_persona.video_identity_ready_lock_snapshot_id = v_snapshot.id
    and v_persona.video_identity_ready_lock_version = v_snapshot.identity_lock_version
    and v_persona.video_identity_ready_identity_fingerprint = v_snapshot.reference_package_fingerprint
    and v_persona.video_identity_ready_reference_package_fingerprint = v_snapshot.reference_package_fingerprint;

  if v_decision = 'APPROVE' then
    update public.persona_personas set
      video_identity_ready = true,
      video_identity_review_id = p_operation_id,
      video_identity_ready_at = (p_evidence ->> 'reviewedAt')::timestamptz,
      video_identity_ready_by = p_reviewer_id,
      video_identity_ready_lock_snapshot_id = v_snapshot.id,
      video_identity_ready_lock_version = v_snapshot.identity_lock_version,
      video_identity_ready_identity_fingerprint = v_snapshot.reference_package_fingerprint,
      video_identity_ready_reference_package_fingerprint = v_snapshot.reference_package_fingerprint,
      video_use_approved = case when v_same_current_review then video_use_approved else false end,
      video_use_approved_at = case when v_same_current_review then video_use_approved_at else null end,
      video_use_approved_by = case when v_same_current_review then video_use_approved_by else null end,
      video_use_approval_review_id = case when v_same_current_review then video_use_approval_review_id else null end,
      video_use_approval_lock_snapshot_id = case when v_same_current_review then video_use_approval_lock_snapshot_id else null end,
      video_use_approval_lock_version = case when v_same_current_review then video_use_approval_lock_version else null end,
      video_use_approval_identity_fingerprint = case when v_same_current_review then video_use_approval_identity_fingerprint else null end,
      video_use_approval_reference_package_fingerprint = case when v_same_current_review then video_use_approval_reference_package_fingerprint else null end,
      updated_at = now()
    where id = p_persona_id and workspace_id = p_workspace_id;
  else
    update public.persona_personas set
      video_identity_ready = false,
      video_identity_review_id = p_operation_id,
      video_identity_ready_at = null,
      video_identity_ready_by = null,
      video_identity_ready_lock_snapshot_id = null,
      video_identity_ready_lock_version = null,
      video_identity_ready_identity_fingerprint = null,
      video_identity_ready_reference_package_fingerprint = null,
      video_use_approved = false,
      video_use_approved_at = null,
      video_use_approved_by = null,
      video_use_approval_review_id = null,
      video_use_approval_lock_snapshot_id = null,
      video_use_approval_lock_version = null,
      video_use_approval_identity_fingerprint = null,
      video_use_approval_reference_package_fingerprint = null,
      updated_at = now()
    where id = p_persona_id and workspace_id = p_workspace_id;
  end if;

  return jsonb_build_object('evidence', p_evidence, 'createdAt', v_created_at);
end;
$$;

create or replace function public.approve_persona_video_use(
  p_workspace_id uuid,
  p_persona_id uuid,
  p_operation_id uuid,
  p_approved_by uuid,
  p_expected_review_id uuid,
  p_expected_lock_snapshot_id uuid,
  p_expected_lock_version integer,
  p_expected_identity_fingerprint text,
  p_expected_reference_package_fingerprint text,
  p_approved_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona public.persona_personas%rowtype;
  v_payload jsonb;
begin
  select * into v_persona
  from public.persona_personas
  where id = p_persona_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'persona_not_found_or_wrong_workspace'; end if;

  if v_persona.video_use_approved
    and v_persona.video_use_approval_review_id = p_expected_review_id
    and v_persona.video_use_approval_lock_snapshot_id = p_expected_lock_snapshot_id
    and v_persona.video_use_approval_lock_version = p_expected_lock_version
    and v_persona.video_use_approval_identity_fingerprint = p_expected_identity_fingerprint
    and v_persona.video_use_approval_reference_package_fingerprint = p_expected_reference_package_fingerprint
  then return true; end if;

  if not v_persona.video_identity_ready
    or v_persona.video_identity_review_id is distinct from p_expected_review_id
    or v_persona.video_identity_ready_lock_snapshot_id is distinct from p_expected_lock_snapshot_id
    or v_persona.video_identity_ready_lock_version is distinct from p_expected_lock_version
    or v_persona.video_identity_ready_identity_fingerprint is distinct from p_expected_identity_fingerprint
    or v_persona.video_identity_ready_reference_package_fingerprint is distinct from p_expected_reference_package_fingerprint
    or v_persona.identity_lock_version is distinct from p_expected_lock_version
  then raise exception 'current_video_identity_readiness_required'; end if;

  v_payload := jsonb_build_object(
    'personaId', p_persona_id,
    'approvedAt', p_approved_at,
    'approvedBy', p_approved_by,
    'identityLockSnapshotId', p_expected_lock_snapshot_id,
    'identityLockVersion', p_expected_lock_version,
    'identityFingerprint', p_expected_identity_fingerprint,
    'referencePackageFingerprint', p_expected_reference_package_fingerprint,
    'videoIdentityReviewId', p_expected_review_id
  );
  insert into public.brain_events (
    id, workspace_id, event_type, domain, record_id, actor_type, actor_id, payload
  ) values (
    p_operation_id, p_workspace_id, 'persona.video_use_approved',
    'persona_studio', p_persona_id, 'human', p_approved_by::text, v_payload
  );

  update public.persona_personas set
    video_use_approved = true,
    video_use_approved_at = p_approved_at,
    video_use_approved_by = p_approved_by,
    video_use_approval_review_id = p_expected_review_id,
    video_use_approval_lock_snapshot_id = p_expected_lock_snapshot_id,
    video_use_approval_lock_version = p_expected_lock_version,
    video_use_approval_identity_fingerprint = p_expected_identity_fingerprint,
    video_use_approval_reference_package_fingerprint = p_expected_reference_package_fingerprint,
    updated_at = now()
  where id = p_persona_id and workspace_id = p_workspace_id;
  return true;
end;
$$;

revoke all on function public.record_persona_video_identity_review(uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_persona_video_identity_review(uuid, uuid, uuid, uuid, jsonb)
  to service_role;
revoke all on function public.approve_persona_video_use(uuid, uuid, uuid, uuid, uuid, uuid, integer, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.approve_persona_video_use(uuid, uuid, uuid, uuid, uuid, uuid, integer, text, text, timestamptz)
  to service_role;
