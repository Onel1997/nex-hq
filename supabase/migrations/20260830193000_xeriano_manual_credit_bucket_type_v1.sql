-- Additive prerequisite for OWNER-issued beta/support credits.
-- Kept separate because PostgreSQL enum values must be committed before they
-- are referenced by functions in the following migration.

alter type public.xeriano_credit_bucket_type
  add value if not exists 'MANUAL';
