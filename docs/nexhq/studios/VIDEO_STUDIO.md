# Video Studio

Status: Canonical current state
Last verified against code: 2026-08-18
Runtime status: **Foundation implemented; migration APPLIED and live-verified; no real provider wired**

## Purpose

Video Studio combines separate approved authorities:

- **WHO:** Persona-owned, independently Video-eligible Brand Model.
- **GARMENT:** exact versioned Product Profile, variant, construction, and frozen references.
- **PRINT:** approved Design-owned Artwork identity/version/checksum.
- **SOURCE VISUAL:** exact durable, human-`APPROVED` deterministic Image Studio asset.
- **DIRECTION:** structured Video type, movement, camera, scene, lighting, format, and duration.
- **OUTPUT:** exactly one private Video asset requiring human review.

## Previous state audit

| Area | Previous state |
|---|---|
| Route/UI | PLACEHOLDER — coming-later page only |
| Persona handoff | COMPLETE contract seam, runtime UI absent |
| Product/Artwork/source handoff | MISSING |
| Video input/direction contracts | MISSING |
| Provider | MISSING |
| Projects/jobs/assets/review | MISSING |
| Reload/history | MISSING |
| Paid safety | MISSING |

No unsafe legacy Video executor or queue was found.

## Current foundation

`video-generation-input-v1` freezes Persona Video eligibility and lock trace; Product Profile/version/variant/reference package/construction; Artwork identity/version/checksum; approved Image source and complete lineage; structured direction; exactly one source strategy; and provider adapter settings. SHA-256 canonical fingerprinting covers all fields.

Three standalone Video aggregates are modeled: `video_production_projects`, `video_generation_jobs`, and `video_production_assets`. The additive migration `20260818003000_video_studio_foundation_v1.sql` is **APPLIED** (2026-08-18). It added server-only/RLS-protected tables, a 30-minute atomic claim RPC, and private `video-production-assets` storage. Live schema, constraints, indexes, FKs, RLS (deny-by-default), service-role-only grants, claim RPC (`SECURITY DEFINER`, service_role EXECUTE only), and the private `video-production-assets` bucket were verified post-apply.

Prepare → Estimate → Confirm → Execute is durable. One confirmed job permits one atomic claim and one output row. An ambiguous claimed attempt becomes `unknown_outcome`; blind retry is forbidden. Output starts `REVIEW_REQUIRED` and uses a nine-item human checklist.

## Persona Video eligibility

Video Studio reuses `buildVideoStudioPersonaHandoff()` and Persona's canonical eligibility. Image/Brand Cast approval never grants Video approval. The locked identity, Video Identity Ready, Video Use approval, reference rights, exact lock version and fingerprints are persisted. The UI states: **„Dieses Markenmodel ist noch nicht für Video freigegeben.“** and fails closed.

Persona now defines Video Identity Ready from a dedicated immutable owner review tied to the exact current lock and reference package; the raw boolean alone is not authority. Video Use approval is a separate explicit action tied to that review. The Video blocker links back to **„Im Persona Studio prüfen“**. Migration `20260818160000_persona_video_readiness_v1.sql` is applied and verified. Live eligibility remains blocked only until the owner completes the real Video identity review and explicit Video Use approval.

## Source-image strategy

Production V1 intentionally uses only an `APPROVED` deterministic Image Studio asset. The server validates workspace, source checksum, Image project/job/fingerprint, Brand Model trace, Product Profile/version/variant, Artwork version/checksum, review actor/time, and private object identity. Browser uploads cannot impersonate production sources.

This provides stronger starting continuity than text-to-video, but it does **not** prove frame-by-frame Artwork fidelity after motion synthesis.

## Artwork fidelity truth

Exact Video Artwork fidelity is not solved. Image-to-video may distort text/print between frames. Future production exactness requires provider verification and likely tracking/homography, garment deformation, occlusion masks, and deterministic frame recompositing. The current snapshot labels its strategy `SOURCE_IMAGE_ONLY_NO_REDRAW_GUARANTEE`; no UI or docs claim otherwise.

## Provider foundation

`VideoProvider` defines `capabilities`, `estimate`, `generate`, `getStatus`, and `reconcile`. Repository-verified capability matrix contains only `nexhq-synthetic-video-v1`. It emits a deterministic metadata fixture with zero network calls; it is not a cinematic renderer and is refused by the API in production builds. Real provider capabilities remain unverified until a separate provider-selection/documentation milestone.

## German owner UX

The shared Geist/blue-cyan system now exposes Ausgangsbild, lineage, Video type, motion presets, camera presets, scene/light, 9:16/4:5/1:1/16:9, 3/5/8/10 seconds, cost review, confirmation, synthetic development execution, reload/history, and human review. Provider identifiers and fingerprints remain under **Technische Details**.

The owner first selects Artwork, Product, exact variant, and Markenmodel. NexHQ then filters the approved Image sources to exact matching lineage. Normal status and shot labels are German; raw job/provider data remains secondary. Synthetic execution is visible only in development/test builds and is rejected by the API in production.

## Migration apply and live verification (2026-08-18)

Linked project `lggogmvpktedkimbpzix` confirmed. Migration history showed all 30 prior migrations synchronized and exactly `20260818003000_video_studio_foundation_v1.sql` pending. Fresh `supabase db push --dry-run` proposed only that file. The SQL is entirely additive (no DROP/TRUNCATE/DELETE/destructive ALTER). Migration was applied; post-apply history shows `20260818003000` on both local and remote with no pending migrations. Live schema queries verified all three Video tables, all columns, all constraints/indexes/FKs, RLS enabled with zero policies (deny-by-default), service_role-only table grants, `claim_video_generation_job` (SECURITY DEFINER, service_role EXECUTE only, confirms `status='confirmed'` + `confirmed_at IS NOT NULL` + `confirmation_expires_at > p_now`), workspace-source enforcement trigger active, and private `video-production-assets` bucket (public=false, 500 MB, video/mp4+webm+fake-video). All five existing private buckets unaffected. Persona Video state: 1 persona, 0 video_identity_ready, 0 video_use_approved — unchanged. 1237 tests pass, TypeScript clean, production build clean. No provider calls; no `.env.local` modification.

## Current blockers

1. ~~Apply and verify the additive Video migration~~ — **DONE** (2026-08-18).
2. ~~Apply Persona Video readiness migration~~ — **DONE** (2026-08-18). Durable review/approval authority columns and service-role RPCs are live.
3. **ACTIVE:** Zero Video-eligible Brand Models in the Milaene workspace. The owner must manually complete the Persona Video-readiness/approval process (Video Identity Ready + Video Use Approved) for `North African Street Premium`. No Persona row was changed by either migration task.
4. Authenticated owner QA with approved Image source and a canonically Video-approved Brand Model.
5. Select and verify a real image-to-video provider; none is wired or claimed.
6. Exact frame-by-frame Artwork fidelity requires a later tracking/compositing milestone.

## Fake-flow hardening (2026-08-19)

Reload selection now treats awaiting/confirmed/running/unknown and `REVIEW_REQUIRED` runs as current, while approved/rejected/failed/cancelled runs remain under Vorherige Durchläufe. Changing source or direction cancels only an unexecuted awaiting/confirmed job, preserves it as history, and resets confirmation. The server still revalidates exact approved Image, Product, Artwork, and Persona Video lineage before every prepare. No real provider was connected or called.
