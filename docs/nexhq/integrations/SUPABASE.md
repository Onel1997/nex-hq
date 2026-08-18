# NexHQ Supabase Integration

Status: Canonical Integration Specification  
Applies to: Entire NexHQ repository  
Current primary workspace: Milaene  
Last verified against code and linked migration history: 2026-08-17

This document records verified repository architecture and the target security posture. A migration file alone is not proof of deployed state. For the Persona Foundation rollout, the linked `milaene-hq` project was reverified, exactly two authorized migrations were applied, and migration history plus the resulting Persona schema/security posture were inspected read-only. No reset, historical business-data rewrite, provider operation, or deployment occurred.

## 1. Role in NexHQ

Supabase is the primary durable database and object-storage platform in the current repository. It persists Brain records, Persona lifecycle state, generated image metadata, and other business data. Supabase is infrastructure: it does not determine which user is authorized to perform a business operation.

Target request flow:

```text
request
  -> authenticated actor
  -> workspace authorization
  -> validated domain operation
  -> workspace-scoped repository
  -> Supabase database/storage
```

## 2. Current Client Boundaries

| Client/boundary | Current use | Security meaning |
|---|---|---|
| `lib/supabase/client.ts` | Browser client using the public URL and anon key. | May act only within meaningful RLS/storage policies. It must never receive service-role credentials. |
| `lib/supabase/server.ts` | Cookie-aware server client used to resolve the Supabase actor/session. | Authentication evidence only; membership/authorization still requires an application decision. |
| `lib/supabase/middleware.ts` and `middleware.ts` | Refresh/validate the cookie session and enforce the private-owner page/API boundary. | Anonymous pages redirect to `/login`; anonymous APIs receive JSON `401`. This is authentication, not workspace membership. |
| `lib/supabase/admin.ts` | Server-only singleton service-role client used by repositories and infrastructure. | Bypasses RLS. It is infrastructure capability, not user authorization. |

No inspected client-side Persona code receives the service-role key. Secrets must remain server-only and must never be copied into documentation, logs, browser bundles, or public environment variables.

## 3. General Private-Owner Authentication

**IMPLEMENTED IN APPLICATION CODE; OWNER ACCOUNT AND RUNTIME SESSION NOT VERIFIED.**

NexHQ currently targets one private owner. The implemented request boundary is:

```text
Supabase email/password login
  -> SSR cookie session
  -> validated Supabase actor
  -> authenticated dashboard/application API
  -> domain-specific authorization where required
```

`/login` is public and uses a server action with `signInWithPassword()`. There is no signup link, public signup flow, password recovery, OAuth, MFA, user-management UI, or automatic Auth-user creation. Middleware refreshes the Supabase session, redirects anonymous page requests to `/login`, returns JSON `401` for anonymous API requests, and prevents an authenticated user from returning to `/login`. The dashboard layout validates the session again server-side, and logout uses the cookie-aware server client before redirecting to `/login`.

This boundary prevents provider-backed and privileged application APIs from being called anonymously. It does not create workspace membership, roles, or multi-user authority. No production auth bypass exists.

## 4. Persona Authentication and Workspace Boundary

**IMPLEMENTED IN APPLICATION CODE; DEPLOYMENT CONFIGURATION NOT VERIFIED.**

Protected Persona routes use one shared boundary in `lib/persona/security/authorization.ts` through `requirePersonaScope()`:

1. resolve the Supabase authenticated user;
2. authorize that user for Persona access;
3. resolve the server-selected active workspace;
4. pass a typed actor/workspace context into the domain service;
5. reach service-role repositories only after authorization.

Production Persona access currently requires:

- a valid Supabase authenticated user; and
- that user's ID in the server-only comma-separated `NEXHQ_PERSONA_AUTHORIZED_USER_IDS` allowlist.

The workspace comes from the server environment/Brain workspace seed selected by `NEXHQ_WORKSPACE_SLUG`, not from a Persona request body, query string, route parameter, or arbitrary header. Persona services and repositories preserve and check `workspace_id`; a record owned by workspace A is rejected under workspace B scope.

This is a safe bridge for the current single-active-workspace deployment. It is **not** a durable workspace-membership or RBAC model. Multiple production workspaces require a persistent user-to-workspace membership authority and membership-aware authorization before request-selected workspace switching is introduced.

### Local development

Local development may explicitly set `NEXHQ_PERSONA_DEV_AUTH_BYPASS=true`. The bypass:

- is disabled by default;
- is ignored when `NODE_ENV=production`;
- is labeled `local_development_bypass` in the typed authorization context; and
- is not valid production authentication or membership evidence.

The former silent `workspace-user` actor fallback is no longer used by protected Persona operations.

## 5. Persona RLS Audit

The following classification is based on migration files, not live database introspection.

| Persona table/category | Historical repository policy | Applied Milestone 2 policy | Current classification |
|---|---|---|---|
| Base Persona, libraries, reference assets, and Persona/library junctions | RLS enabled with `USING (true)` and/or `WITH CHECK (true)`. | Remove permissive policies; enable RLS; revoke `PUBLIC`, `anon`, and `authenticated` table privileges. | Server-only service-role authority; direct clients denied. |
| Creation projects, candidates, candidate assets, identity reviews, and Brand Cast requirements | RLS enabled with permissive all-access policies. | Same deny-direct-client posture. | Server-only service-role authority. |
| Generation jobs, confirmation ledger, and discovery attempts | Policies named `service_all` were not restricted to the `service_role` role and used unconditional predicates. | Remove policies and direct-client privileges. | Server-only service-role authority. |
| Face novelty history and embedding backfill | RLS existed, but the workspace-read predicates only proved a workspace row existed; they did not prove actor membership. | Remove ineffective policies and direct-client privileges. | Server-only service-role authority. |
| Reference Package sessions/attempts | Tables were created without RLS/policies. | Enable RLS and revoke direct-client privileges. | Server-only service-role authority. |
| Identity Lock snapshots | Table was created without RLS/policies. | Enable RLS and revoke direct-client privileges; add scoped review provenance constraints for new writes. | Server-only service-role authority. |
| Image/video/Brand Cast approvals | Governed columns on `persona_personas`; therefore inherited the permissive base-table exposure. | Protected by the base-table deny-direct-client posture and dedicated server operations. | Server-only, domain-governed writes. |
| Private `persona-references` storage | Private bucket with service-role-only object policy in repository migrations. | Unchanged. Signed access remains server-issued and workspace/path scoped. | Live bucket configuration verified private; manual signed-delivery behavior remains to be checked. |

Because the repository has no durable membership relation from `auth.users` to workspaces, the security migration deliberately does **not** invent brittle authenticated-user policies. Direct `anon`/`authenticated` Persona table access is denied; protected server routes are mandatory. This preserves service-role repository operation while making application authorization explicit.

## 6. Persona Foundation Migrations

### Milestone 1 — review-bound identity authority

`supabase/migrations/20260816210000_persona_foundation_milestone_1.sql` was applied to `milaene-hq` on 2026-08-16 after an exact migration-history and dry-run recheck. It:

- adds three nullable review-provenance columns to immutable lock snapshots;
- does not drop/reset/truncate tables or overwrite records;
- leaves legacy snapshots representable through nullable fields; and
- does not fabricate review evidence or silently alter approvals.

The runtime now fails closed for locked Brand Model resolution when an old snapshot lacks exact linked review provenance. Read-only diagnostics may identify a qualifying pre-lock review as a reconciliation candidate, but do not attach it automatically.

### Milestone 2 — authorization defense in depth

`supabase/migrations/20260816220000_persona_foundation_milestone_2_security.sql` was applied immediately after Milestone 1. It:

- verifies that the Milestone 1 column is present;
- adds a scoped review index and `NOT VALID` foreign-key/check constraints, which enforce new writes without rejecting migration because of unreviewed legacy rows;
- removes known permissive/ineffective Persona policies;
- enables RLS on all inspected Persona tables; and
- revokes direct table privileges from `PUBLIC`, `anon`, and `authenticated` without revoking `service_role`.

Remote migration history is synchronized through both files. Read-only post-apply catalog checks verified the three nullable provenance columns, both `NOT VALID` constraints, both indexes, RLS on all 26 governed Persona tables, zero remaining policies/direct-client grants on those tables, and service-role privileges. The private `persona-references` bucket remains non-public.

## 7. Applied State and Future Procedure

On 2026-08-16, the authorized operator sequence was executed against project ref `lggogmvpktedkimbpzix`: migration list, exact dry run, push of only the two Foundation migrations, then migration-list and read-only catalog verification. For future migrations, preserve the same stop-on-difference discipline:

```bash
# Inspect local/remote migration history without changing data.
npx supabase migration list

# Preview the migration plan. Verify the linked project identity first.
npx supabase db push --dry-run

# Only after separate explicit approval and confirmation of the exact files:
npx supabase db push
```

For a separately confirmed local Supabase instance only:

```bash
npx supabase migration up --local
```

Never use `db reset`, rewrite applied migration history, or push to a linked project merely to test a migration. The linked Milaene project contains real Persona business data. Before any future application, confirm:

1. target project/environment identity;
2. current migration history and prerequisite tables/columns;
3. backup/recovery plan;
4. expected counts of legacy lock snapshots without exact review provenance;
5. application environment allowlist configuration; and
6. a post-apply verification and constraint-validation plan.

## 8. Legacy Reconciliation

Legacy Identity Lock snapshots were preserved. The application does not unlock/relock them, destroy approvals, or infer that a review occurred. `diagnoseLegacyIdentityLockReconciliation()` classifies records read-only:

- unlocked;
- valid exact linked review;
- invalid/mismatched linked review;
- qualifying pre-lock review candidate requiring human reconciliation; or
- no usable review evidence, requiring human reconciliation.

The post-apply diagnostic found one locked record requiring reconciliation: `North African Street Premium` (lock version 2). Its snapshot has no exact linked review and there is no qualifying persisted review candidate, so canonical Image/Video Brand Model eligibility fails closed. No row or approval was changed. Any eventual repair must be an explicit, audited human reconciliation with immutable provenance. `NOT VALID` constraints tolerate this historical row while protecting new writes; constraint validation must wait until legacy records have been deliberately reviewed.

## 9. Image Production Migrations — Preflight and Apply

On 2026-08-17, the linked project ref was reverified as `lggogmvpktedkimbpzix` with Supabase CLI `2.101.0`. Pre-apply migration history showed exactly `20260817013000_image_paid_generation_jobs.sql` and `20260817030000_design_image_production_authority.sql` pending; `db push --dry-run` proposed exactly those two files in order. Both are additive: no table/object drop, truncate, business-row update/delete, reset, or destructive storage operation. RLS/grants deny direct clients; the service-role-only atomic claim has an explicit safe transition predicate plus 30-minute confirmation expiry; input/output buckets are private.

Both migrations were applied successfully on 2026-08-17. Post-apply verification confirmed synchronized migration history, live tables (`image_generation_jobs`, `design_master_artworks`, `image_production_projects`, `image_production_assets`), indexes/constraints/FKs, RLS enabled with no policies (deny-by-default for direct clients), service-role-only grants, `claim_image_generation_job` with expiry enforcement, and private buckets `image-generation-inputs`, `design-master-artworks`, `image-production-assets` (existing `persona-references` unchanged). New tables are empty. See [[docs/nexhq/studios/IMAGE_PAID_MIGRATION_PREFLIGHT_2026-08-17.md]].

### Deterministic V2 migration (applied and verified 2026-08-17)

`20260817170000_deterministic_mockup_foundation_v1.sql` is additive and **APPLIED**. On 2026-08-17 a fresh `db push --dry-run` against linked project `lggogmvpktedkimbpzix` proposed exactly this migration; it was then applied alone and local/remote history synchronized. Live service-role reads, anon denial, table/column/constraint/trigger presence, and the private `product-profile-references` bucket were verified. Counts and status/update snapshots for the 4 historical jobs, 1 asset, 1 Artwork, and 4 projects were unchanged; old v1 rows retain null v2 markers. No fixture/business row or Storage object was created during verification.

Later migration-history retries encountered a transient remote Postgres timeout; this did not apply or mutate anything. A separately authorized application task must repeat linked-project/history/dry-run/recovery/RLS/grant/bucket/function/trigger verification before applying.

## 10. Remaining Gaps

- No durable user/workspace membership or RBAC table exists; the production allowlist is an interim single-workspace control.
- The owner reports the private login/session/dashboard/Persona path manually verified. Remote email/password/public-signup settings were not changed by the migration task and were not independently audited here.
- Both Persona Foundation migrations and both Image/Design production authority migrations are applied. Migration history, Persona columns/constraints/indexes, Image production tables, live RLS/policies/grants, private storage buckets, and legacy lock state were queried read-only after apply.
- Full authenticated Persona CRUD/approval behavior, signed private-reference delivery, Image Studio listing, and logout still need the post-migration manual runtime checklist.
- General authenticated-session protection now covers non-Persona APIs, but those domains still lack Persona-equivalent workspace membership/role authorization.
- Some secondary Persona repository factories may use memory implementations outside protected production routes; they must not become persistent identity authority.
- Audit events are best-effort rather than transactionally coupled to every governed write.

## 11. Invariants

1. Service-role capability never equals user authorization.
2. Protected Persona operations authorize before privileged workspace or repository work.
3. Workspace scope is explicit in domain/repository calls and is not accepted blindly from clients.
4. Browser/anon clients must not receive direct authority over Persona identity, locks, approvals, jobs, or confirmation records.
5. RLS is defense in depth; it does not replace application authorization.
6. Migration files never prove deployed schema state.
7. Legacy review evidence must not be fabricated.
8. No key, token, credential, or private signed asset URL belongs in documentation.

## Product Intelligence V1 persistence — 2026-08-17

The already-applied `product_profiles` table and private `product-profile-references` bucket are reused. Product versions are insert-only at the repository boundary; JSONB fields hold structured variants, construction, references and PrintSurfaces, while provenance carries lifecycle and explicit-link metadata. Product Library routes require authenticated workspace scope and use server repositories/storage helpers. No schema migration was created or applied in this milestone.

## Video Studio Foundation migration — APPLIED 2026-08-18

`20260818003000_video_studio_foundation_v1.sql` is additive and **APPLIED** on 2026-08-18 to project `lggogmvpktedkimbpzix`. Pre-apply verification confirmed linked ref, 30 prior migrations synchronized, exactly one file pending, and a clean dry-run. The SQL is entirely additive: no DROP/TRUNCATE/DELETE/destructive ALTER/business-row rewrite. Post-apply verification confirmed:

- `20260818003000` recorded in remote history; no pending migrations; local/remote synchronized.
- Live tables: `video_production_projects`, `video_generation_jobs`, `video_production_assets` — all columns, check constraints, unique constraints, foreign keys, and indexes present as defined.
- RLS enabled on all three tables; zero policies (deny-by-default for direct clients).
- Grants: `service_role` and `postgres` only; no `anon`, `authenticated`, or `public` grants.
- `claim_video_generation_job(uuid,uuid,text,timestamptz)`: `SECURITY DEFINER`, enforces `status='confirmed'`, `confirmed_at IS NOT NULL`, `confirmation_expires_at > p_now`; EXECUTE granted to `service_role` only.
- `trg_video_source_workspace` trigger active on `video_production_assets`; enforces APPROVED source image within same workspace.
- `video-production-assets` bucket: `public=false`, 500 MB limit, `video/mp4`, `video/webm`, `application/vnd.nexhq.fake-video+json`.
- All five existing private buckets (`persona-references`, `image-generation-inputs`, `design-master-artworks`, `image-production-assets`, `product-profile-references`) unaffected.
- Persona Video state: 1 persona, 0 `video_identity_ready`, 0 `video_use_approved` — unchanged.
- 1237 tests pass; TypeScript clean; production build clean. No provider calls; `.env.local` untouched.

## Persona Video readiness migration — APPLIED 2026-08-18

`20260818160000_persona_video_readiness_v1.sql` is additive and **APPLIED** on 2026-08-18 to project `lggogmvpktedkimbpzix`. Pre-apply verification confirmed linked ref, 31 prior migrations synchronized, exactly one file pending, and a clean dry-run. The SQL is entirely additive: no DROP/TRUNCATE/DELETE/destructive ALTER/business-row rewrite. Post-apply verification confirmed:

- `20260818160000` recorded in remote history; no pending migrations; local/remote synchronized.
- New columns on `persona_personas`: `video_identity_review_id`, `video_identity_ready_at/by`, `video_identity_ready_lock_snapshot_id/version`, `video_identity_ready_identity_fingerprint`, `video_identity_ready_reference_package_fingerprint`, `video_use_approval_review_id`, `video_use_approval_lock_snapshot_id/version`, `video_use_approval_identity_fingerprint`, `video_use_approval_reference_package_fingerprint`.
- Evidence-completeness checks (`persona_video_ready_evidence_complete`, `persona_video_approval_evidence_complete`) and lock-version positive checks — all `NOT VALID` (protect future writes without rejecting existing rows).
- Workspace-safe FKs to `persona_identity_lock_snapshots(id, workspace_id)` and `brain_events(id, workspace_id)` — all `NOT VALID`.
- Supporting unique indexes: `persona_identity_lock_snapshots_id_workspace_uidx`, `brain_events_id_workspace_uidx`; eligibility index `persona_personas_video_eligibility_idx`.
- `record_persona_video_identity_review(uuid,uuid,uuid,uuid,jsonb)`: `SECURITY DEFINER`, exact-lock/fingerprint/rights/checklist enforcement, immutable audit via `brain_events`, stale approval clearing on new review.
- `approve_persona_video_use(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,timestamptz)`: `SECURITY DEFINER`, requires current Video Identity Ready + exact review/lock/fingerprint match, idempotent on identical approval.
- Both RPCs: EXECUTE granted to `service_role` and `postgres` only; no `anon`, `authenticated`, or `public`.
- `persona_personas` RLS remains enabled; no new permissive policies; existing table grants unchanged.
- North African Street Premium: `video_identity_ready=false`, `video_use_approved=false`, lock v3, Image/Brand Cast approvals unchanged — no auto-approval.
- 1244 tests pass; TypeScript clean; production build clean. No provider calls; no human Video review performed; `.env.local` untouched.
