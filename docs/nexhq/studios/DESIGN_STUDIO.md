# Design Studio

Status: Canonical Current-State Integration Note  
Last verified against code: 2026-08-17  
Implementation status: **PARTIAL — durable authority implemented; migration applied**

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
- `app/api/design/master-artworks/route.ts`
- `components/design/creative-workspace.tsx`
- `lib/image/image-handoff-store.ts`
- `supabase/migrations/20260817030000_design_image_production_authority.sql`
