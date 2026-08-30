# Design Studio

Status: Canonical Current-State Integration Note  
Last verified against code: 2026-08-19
Implementation status: **PARTIAL — durable authority implemented; display-name migration applied**

## Current State

Design Studio still uses `MasterArtworkState` and a browser handoff for temporary editing/navigation UX. That browser payload is no longer sufficient production authority.

The explicit **Send to Image Studio** action now requires an approved raster artwork and an authenticated owner. Design uploads the exact bytes through the protected Master Artwork API. The server computes SHA-256, writes a workspace-scoped private object, and creates an immutable `design_master_artworks` row containing durable identity, design ID, explicit version, checksum, MIME/size, source/report provenance, placement/print metadata, approval actor, and approval time. Idempotent replay returns the same immutable record.

The handoff carries only a safe durable reference plus optional preview transport. Image paid preparation resolves that reference from Design authority, downloads and rechecks the exact object/checksum, and rejects stale versions, wrong workspaces, missing objects, or browser-supplied storage paths. User-uploaded final artwork remains canonical; AI never silently replaces it.

## Canonical Workflow

Approved Master Artwork + approved Persona Brand Model + typed product context + campaign direction → Image Studio production. Persona identity and artwork remain distinct inputs. Image may place the artwork on a garment but may not redesign, rewrite, restyle, add, remove, or substitute it.

## Persistence and Rollout

`20260817030000_design_image_production_authority.sql` creates the additive Design authority table and private `design-master-artworks` bucket. It was **applied** on 2026-08-17 to linked project `lggogmvpktedkimbpzix`. The protected approval path can now persist immutable artwork authority server-side; live browser-to-approval E2E remains unverified.

Autonomous design-generation code remains in the repository but is not the canonical final-artwork authority.

## Relevant Paths

- `lib/design/master-artwork-authority/`
- `lib/design/artwork-display-name.ts`
- `app/api/design/master-artworks/route.ts`
- `app/api/design/master-artworks/[artworkId]/route.ts`
- `components/design/creative-workspace.tsx`
- `lib/image/image-handoff-store.ts`
- `supabase/migrations/20260817030000_design_image_production_authority.sql`
- `supabase/migrations/20260818220000_artwork_display_name_v1.sql`

## Artwork Library Direction — Implemented Foundation

Design Studio owns **Artwork**, not Product selection. `lib/design/artwork-library/types.ts` adapts approved `design_master_artworks` into a reusable `artwork-library-entry-v1` with immutable identity/version/checksum, approval, original/production representation roles, dimensions/transparency metadata, placement/print-method defaults, provenance, and actors/timestamps. The contract deliberately has no Product or Shopify field, and one Artwork can be selected by multiple Image production projects.

The existing Design mission/handoff still carries garment/color hints as temporary creative context. Those hints are not Product authority and should be removed from the future Artwork Library upload flow. Applied migration `20260817170000_deterministic_mockup_foundation_v1.sql` adds nullable pixel/transparency/production-representation metadata to the existing table. Historical Artwork rows were not rewritten. No duplicate Artwork table was introduced.

## V2 Runtime Use

V2 preparation re-resolves the exact approved durable Artwork reference, rechecks its SHA-256, freezes the same bytes into the private generation-input boundary, and records ID/design/version/checksum in the job fingerprint. Stage A receives no Artwork bytes. Stage B downloads only that frozen checksummed representation and refuses any mismatch.

## Artwork Library UX — 2026-08-17

Design Studio now opens as an Artwork Library without requiring a mission or Product. Upload is the primary action. Preview defaults to fit-to-screen and exposes zoom, 100%, reset and fullscreen controls in German. File/production readiness and approval are primary; creative/commercial analysis is collapsed as advanced. The tiny bottom workflow rail was removed; approval and the optional Image Studio handoff remain contextual actions. Authority/version/checksum behavior is unchanged.

## Final UX Cleanup — 2026-08-17

Research mission/report titles no longer appear in the dominant breadcrumb and are not used as fallback Artwork names. Research data may still initialize an Artwork workspace and remains provenance, but the owner-facing identity is always **Artwork-Bibliothek**. Advanced analysis labels were normalized to German and share the same sans-serif typography and blue/cyan tokens as the other Studios. No approval, version, checksum, or handoff authority changed.

## Product independence reaffirmed — 2026-08-17

Product Intelligence V1 introduces no Product field or binding into Artwork authority. An approved Artwork remains independently versioned and reusable across any eligible Product Profile selected later in Image Studio.

## Owner-facing Artwork display name — APPLIED 2026-08-19

`display_name` is owner-editable metadata. `original_file_name` preserves the uploaded filename. Rename must never change Artwork ID, design ID, version, checksum, approval status, storage path, or original file identity.

`20260818220000_artwork_display_name_v1.sql` is additive and **APPLIED** on 2026-08-19 to linked project `lggogmvpktedkimbpzix`. Live columns are nullable `text` with trim/length checks (`display_name` 1–120, `original_file_name` 1–255). The one existing Artwork row was not rewritten; both name fields remain `NULL` until the owner saves a name through the authenticated PATCH route (`app/api/design/master-artworks/[artworkId]/route.ts`), which requires `requirePersonaScope()` and updates only `display_name` inside the server-resolved workspace. Image and Video selectors show the owner name separately from the original filename. Manual rename/reload verification is still required.

## Cross-Studio boundary check — 2026-08-19

Artwork upload, display name, original filename, approval, version/checksum and Image/Video labels remain Design-owned. Content Packs and Product supplier context add no Product requirement to Artwork creation and create no permanent Artwork→Product binding.

## Image Studio library selection — 2026-08-20

The explicit **Im Image Studio verwenden** handoff remains the fastest path and preselects the exact durable Artwork. Image Studio may now also list the same authenticated, workspace-scoped approved Artwork Library and switch authority directly. This selection changes no Artwork row, checksum, version, name, or approval; it only changes the current Image input and invalidates stale preparation.
