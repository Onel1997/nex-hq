# Image Paid Job Migration Preflight — 2026-08-17

Status: Internal operational evidence  
Result for `20260817013000_image_paid_generation_jobs.sql`: **READY**  
Result for `20260817030000_design_image_production_authority.sql`: **READY**  
Applied: **YES** — both migrations applied on 2026-08-17 to linked project `lggogmvpktedkimbpzix`

## Controlled read-only evidence

- Linked project ref: `lggogmvpktedkimbpzix` (`milaene-hq` per existing canonical operations record).
- Supabase CLI used: `2.101.0`.
- Initial remote migration history matched every local migration through both applied Persona Foundation migrations:
  - `20260816210000_persona_foundation_milestone_1.sql`
  - `20260816220000_persona_foundation_milestone_2_security.sql`
- At the Phase 1 checkpoint, exactly one migration was pending: `20260817013000_image_paid_generation_jobs.sql`.
- `npx supabase db push --dry-run` proposed exactly that one migration and did not apply it.
- Read-only Storage inspection found `persona-references` private and found no existing `image-generation-inputs` bucket. The migration therefore does not overwrite an existing bucket configuration in the observed project state.

## SQL review

- Additive table, indexes, private bucket definition, RLS enablement, direct-client revocation, and service-role grants only.
- No `DROP`, `TRUNCATE`, business-row `DELETE`, schema reset, or historical business-data rewrite.
- The `workspace_id` foreign key uses `ON DELETE RESTRICT`.
- Direct `PUBLIC`, `anon`, and `authenticated` table access is revoked; the server-side service role retains the narrow table operations used by the repository.
- The private input bucket allows PNG/JPEG/WebP up to 20 MB and has no public object policy.
- The atomic claim RPC is `SECURITY DEFINER`, pins `search_path`, is executable only by `service_role`, binds workspace/job/fingerprint/confirmation, and performs a single conditional `UPDATE ... RETURNING` transition.
- Unique fingerprint and one-running-shot indexes provide duplicate-preparation and concurrent-execution protection.

## Warnings / follow-up

- This READY result applies to the exact Phase 1 file as inspected before later mission work created a second additive migration.
- `20260817030000_design_image_production_authority.sql` is now also pending. A later combined dry run proposed the two migrations in order and nothing else.
- The second migration adds the durable Design/Image authority tables, private output buckets, project linkage, and a 30-minute claim TTL by safely replacing the claim RPC. Both files require one final exact pre-apply review together.
- Pre-apply evidence only: no live table, row, policy, grant, function, or bucket was mutated before the controlled apply on 2026-08-17.

## Post-apply verification (2026-08-17)

- Linked project ref reverified: `lggogmvpktedkimbpzix`.
- Fresh dry-run proposed exactly `20260817013000` then `20260817030000`; both applied successfully in that order.
- Migration history synchronized locally and remotely; no pending migrations remain.
- Live schema verified: `image_generation_jobs`, `design_master_artworks`, `image_production_projects`, `image_production_assets`, `claim_image_generation_job` (with `confirmation_expires_at >= p_now`), indexes/constraints/FKs, RLS enabled on all four tables, no anon/authenticated table or RPC grants, private buckets `image-generation-inputs`, `design-master-artworks`, `image-production-assets`; existing `persona-references` remained private.
- New tables start empty (0 rows). No provider calls, no paid generation, no business-row mutation.
- Application tests (1,112 pass), TypeScript, and production build pass. Paid generation runtime remains unverified and default-closed.

