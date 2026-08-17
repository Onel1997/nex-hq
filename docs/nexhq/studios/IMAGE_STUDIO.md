# Image Studio

Status: Canonical Current-State Integration Note  
Last verified against code: 2026-08-17  
Implementation status: **PARTIAL — durable production boundary implemented; migrations applied; live provider unverified**

## Purpose and Ownership

Image Studio is the image-production/Campaign Director boundary. Persona exclusively owns WHO and Image eligibility. Design exclusively owns approved Master Artwork. Shopify is authoritative for product/variant truth only after current server-side verification. Image owns production projects, shot plans, paid jobs, generated assets, and human review.

## Current Production Flow

1. Design explicitly approves/uploads exact artwork into durable private Design authority.
2. Image selects a canonically eligible Brand Model and re-resolves its exact lock/package.
3. Image selects a live verified Shopify product/variant or a visibly non-authoritative local/seed/Brain fallback.
4. `/api/image/run` creates an 18-asset deterministic shot plan without a paid call; the owner selects the desired shot.
5. Paid preparation creates/versions `ImageProductionProject`, resolves and freezes exact Persona, artwork, product, shot, provider/model/settings, computes the fingerprint and estimate, and stores a 30-minute confirmation expiry.
6. Owner confirms the exact fingerprint. Execution revalidates current project, shot plan, Persona, Design authority, frozen object, and product context before the atomic claim.
7. A single provider attempt may run only when the environment paid capability is also enabled.
8. Output is stored privately, linked to project/shot/job/fingerprint, and enters `REVIEW_REQUIRED`; only a human may approve/reject.

No paid provider was called during implementation or validation.

## Durable Authorities

### Brand Model

The protected Persona integration publishes `brand-model-v1`. Image stores safe identity trace IDs/fingerprints, resolves exact private Master bytes server-side, and fails closed for stale locks, missing rights, superseded/rejected references, package mismatch, workspace mismatch, or a lock change during resolution. Persona Master is provider input 1 and cannot be replaced by Design artwork.

### Master Artwork

Browser handoff is temporary UX transport only. Paid preparation requires `design_master_artworks` durable ID/workspace/design/version/checksum and independently downloads/validates the private object. Artwork stays canonical and cannot be redesigned by prompt.

### Product

`ProductProductionContext` captures product/variant IDs, product type, color, size, material, fit, collection, availability/active state, authority, source/capture/version provenance. `SHOPIFY_LIVE` is accepted only after live server verification; other sources are `authoritative: false`. Missing exact variants remain `null` rather than invented.

### Campaign / Project

`image_production_projects` preserves workspace, campaign direction, exact Brand Model trace, Master Artwork reference, product context, shot plan, version, status, and timestamps. Critical input changes version the project. Brain remains a planning/report projection, not the sole paid-production truth.

## Paid Job State and Recovery

`image_generation_jobs` binds project/version, input snapshot, estimate, confirmation evidence/expiry, claim/provider state, result/error, and retry safety. The claim RPC is atomic and service-role-only. Concurrent duplicate execution permits at most one claim. Known failures before provider acceptance may be explicitly retried; ambiguous provider results are `unknown_outcome` and block blind retry. Unexecuted awaiting/confirmed/failed jobs can be cancelled; expired/cancelled attempts require an explicit fresh prepare/estimate.

The UI can list unfinished jobs after reload/login, recover awaiting/confirmed/failed/unknown/succeeded state, poll a running job, request fresh signed output access, and review persisted assets without the original browser session. Page refresh cannot redefine the server project/job truth. Running-job cancellation and automated provider reconciliation remain intentionally absent.

## Provider Preparation

The provider-neutral request separates WHO, WHAT THEY WEAR, PRODUCT, and HOW/WHERE. The OpenAI adapter uses ordered Persona Master + exact artwork edit inputs, high fidelity, explicit garment construction/color/material/fit/placement, exact variant only when known, artwork non-redesign rules, and identity preservation with pose/scene freedom. Flux remains text-only and rejects Brand Model-conditioned execution.

## Asset Provenance and Review

`image_production_assets` records project, shot, job, input fingerprint, provider/model/request ID, exact Persona trace, artwork ID/version/checksum, full product context, generation provenance, private storage path/MIME/size, creation time, and review actor/time/note.

New output storage is private `image-production-assets`; API views use short-lived signed access and never persist the signed URL. Initial transitions are `GENERATED` → `REVIEW_REQUIRED`; human actions may set `APPROVED` or `REJECTED`. AI output is never automatically approved.

## Migrations and Rollout

- `20260817013000_image_paid_generation_jobs.sql` — paid job authority, atomic claim, private frozen-input bucket.
- `20260817030000_design_image_production_authority.sql` — Design artwork, Image project/assets, project linkage/confirmation TTL, private artwork/output buckets.

Both are additive and **applied** on 2026-08-17 to linked project `lggogmvpktedkimbpzix`. Controlled preflight and post-apply schema verification passed. See [[docs/nexhq/studios/IMAGE_PAID_MIGRATION_PREFLIGHT_2026-08-17.md]].

## Remaining Limitations

- Database/runtime paths are now live, but controlled provider execution and browser-to-provider E2E remain unverified.
- No controlled live provider attempt or browser-to-provider E2E was run.
- `UNKNOWN_OUTCOME` needs an operator/provider reconciliation command before production-scale rollout.
- Running cancellation is not implemented; atomic claim prevents unsafe replay but cannot abort an accepted provider request.
- Durable user/workspace membership/RBAC remains broader platform work; current access is the private-owner server boundary.
- The workspace UI still contains local/module state and technical/developer-facing complexity for temporary presentation state. Canonical project/job/asset truth is durable after migration; broad UX redesign is deferred per [[docs/nexhq/studios/IMAGE_STUDIO_UX_AUDIT.md]].

## Relevant Paths

- `lib/design/master-artwork-authority/`
- `lib/image/product-production-context.ts`
- `lib/image/production-project/`
- `lib/image/paid-generation/`
- `lib/image/deterministic-production-plan.ts`
- `app/api/image/`
- `components/image/image-studio-workspace.tsx`
- `agents/image/providers/openai-images-provider.ts`
- `agents/image/storage.ts`
