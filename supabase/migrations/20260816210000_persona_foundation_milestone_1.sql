-- Persona Foundation Milestone 1
-- Persist the exact manual identity-review evidence used by Identity Lock.
-- Additive only; legacy snapshots remain readable and are not rewritten.

alter table public.persona_identity_lock_snapshots
  add column if not exists identity_review_id uuid
    references public.persona_identity_reviews(id) on delete restrict,
  add column if not exists identity_reviewed_at timestamptz,
  add column if not exists identity_reviewed_by text;

create index if not exists persona_identity_lock_snapshots_review_idx
  on public.persona_identity_lock_snapshots (workspace_id, identity_review_id)
  where identity_review_id is not null;

comment on column public.persona_identity_lock_snapshots.identity_review_id is
  'Persisted manual identity review used to satisfy the Identity Lock quality gate.';

comment on column public.persona_identity_lock_snapshots.identity_reviewed_at is
  'Review timestamp copied into the immutable Identity Lock evidence.';

comment on column public.persona_identity_lock_snapshots.identity_reviewed_by is
  'Review actor copied into the immutable Identity Lock evidence.';
