-- Report approval workflow — extend brain_records status values

ALTER TABLE public.brain_records
  DROP CONSTRAINT IF EXISTS brain_records_status_check;

ALTER TABLE public.brain_records
  ADD CONSTRAINT brain_records_status_check CHECK (
    status IN (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'revision_requested',
      'archived',
      'superseded'
    )
  );
