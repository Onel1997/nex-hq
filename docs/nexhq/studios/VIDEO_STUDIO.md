# Video Studio

Status: Canonical Current-State Integration Note  
Last verified against code: 2026-08-16  
Studio implementation status: **PLACEHOLDER**  
Persona contract foundation status: **IMPLEMENTED IN CODE / RUNTIME NOT VERIFIED**

## Purpose

Video Studio will reuse approved Brand Models, products, designs, and campaign context for video production. Persona Studio remains the sole authority for identity, Identity Lock, Video Use approval, Brand Cast membership, and Video eligibility.

## Current Studio State

The dashboard route remains a coming-later placeholder. No Video project aggregate, shot/timeline state, durable job, provider execution, generated asset, review UI, or paid generation exists. Milestone 3 deliberately did not create fake Video functionality.

## Persona → Video Contract Boundary

The protected Persona integration API supports `consumer=video` for both eligible summaries and a full `brand-model-v1` handoff. The server:

1. resolves the authorized actor and server-selected workspace;
2. loads the workspace-scoped durable Persona;
3. resolves the immutable Identity Lock snapshot;
4. derives centralized Persona eligibility;
5. rejects anything not canonically Video-eligible with typed safe reasons;
6. binds the exact snapshot ID/version/fingerprint and Reference Package fingerprint;
7. rejects stale expected identity versions; and
8. keeps private asset signing transient and separate from canonical identity truth.

`lib/video/brand-model-production-context.ts` is the typed consumer seam. It validates the shared contract, requires a Video handoff, accepts Persona's eligibility result without redefining its formula, and produces the audit trace a future Video job must persist.

## Independent Video Eligibility

Video eligibility is independent from Image eligibility. It uses the same locked Persona authority but additionally requires canonical video readiness and explicit Video Use approval. Brand Cast approval plus Image Use approval can produce an Image-eligible model while Video remains ineligible; this is valid and tested.

Image approval never implies Video approval. Legacy `Approved`, browser state, seed data, and the process-local Brand Face registry cannot grant Video handoff eligibility.

## Private Assets and Security

The canonical contract never exposes private storage paths, secrets, or persistent signed URLs. When requested, the Persona server issues short-lived workspace-scoped signed accesses in the transient handoff envelope. Client input cannot override workspace authority, and cross-workspace Persona IDs fail closed.

## Remaining Work

- Design and implement the actual Video Studio UX and operational domain.
- Persist exact Brand Model traces on future Video projects/jobs/assets.
- Resolve controlled reference assets server-side at execution time without persisting expiring URLs.
- Add provider governance, explicit paid intent, durable jobs, retries/idempotency, review, approval, and observability.
- Runtime-verify the protected API, Supabase/storage boundary, and a non-paid or explicitly authorized end-to-end flow.

No video provider was called and no video was generated in Milestone 3.

## Relevant Paths

- `app/(dashboard)/agents/video/page.tsx`
- `lib/video/brand-model-production-context.ts`
- `lib/persona/future/video-studio-hooks.ts`
- `lib/persona/integrations/brand-model-handoff.ts`
- `app/api/persona/integrations/route.ts`
- `lib/persona/domain/brand-model-contract.ts`
