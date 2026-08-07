-- Phase 2.2G — durable historical biological protection lifecycle on novelty records.
-- Existing rows default to unprotected (discovery casting data, not forbidden identities).
-- No data deletion.

ALTER TABLE persona_face_novelty_records
  ADD COLUMN IF NOT EXISTS historical_protection_status text NOT NULL DEFAULT 'unprotected',
  ADD COLUMN IF NOT EXISTS historical_protection_promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS historical_protection_reason text,
  ADD COLUMN IF NOT EXISTS historical_protection_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'persona_face_novelty_historical_protection_status_check'
  ) THEN
    ALTER TABLE persona_face_novelty_records
      ADD CONSTRAINT persona_face_novelty_historical_protection_status_check
      CHECK (
        historical_protection_status IN (
          'unprotected',
          'selected_brand_face',
          'approved_persona',
          'identity_locked',
          'brand_cast_approved'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS persona_face_novelty_historical_protection_idx
  ON persona_face_novelty_records (workspace_id, historical_protection_status)
  WHERE historical_protection_status <> 'unprotected';

COMMENT ON COLUMN persona_face_novelty_records.historical_protection_status IS
  'Phase 2.2G: unprotected discovery faces are not cross-project biological blockers. selected_brand_face / approved_persona / identity_locked / brand_cast_approved enter the historical pool.';
