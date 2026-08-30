# First Live Image Job — Read-Only Forensics (2026-08-17)

## Result

**FROZEN V1 INPUT EXECUTED AS AUTHORIZED; PROVIDER STRATEGY WAS NOT ARTWORK-EXACT.**

Read-only Supabase inspection found one succeeded paid Image job. No provider, row, or Storage mutation was performed during this inspection.

| Field | Frozen/executed truth |
|---|---|
| Job | `f18800af-f392-498e-945c-f938e9700fa6` (attempt 1, succeeded) |
| Project | `166460b9-b700-4501-a10c-3d894acea0f5`, version 1 |
| Input fingerprint | `2e9e21712ce7ba49fec23ab5b78e0ebba8f626b261ad1c33b118d372ebd13016` |
| Artwork | `b19042f7-40f9-4f27-b53a-30329fbbe0ad`, design `design-research-report-premium-emotional-streetw-from-report`, `V1`, checksum `598e…2c41`, approved uploaded PNG |
| Placement / method | Center-chest oversized; screen print / DTG |
| Product | `SHOPIFY_LIVE` Grace Oversized Tee, exact product `gid://shopify/Product/8456219656541`, exact variant `gid://shopify/ProductVariant/47228565487965`, Schwarz / L, available |
| Brand Model | North African Street Premium; exact Persona lock v3, reference-package fingerprint, and Master Identity asset were frozen |
| Shot | `shot-1-primary`; studio-front primary; neutral controlled studio; soft key/fill; 2048×2048; low quality |
| Provider | OpenAI `gpt-image-1` |
| V1 strategy | Persona Master + Master Artwork in `images.edit`, high input fidelity |
| Output | One private asset linked to job/project/shot/fingerprint; initial review `REVIEW_REQUIRED` |

The durable Master Artwork row matched the job's artwork ID, version, checksum, approval state, and private object. The generated-asset row matched job, project, shot, input fingerprint, Product, Brand Model, Artwork, provider, and request lineage. This confirms that the server executed the intended frozen job; it did not select stale Design, Product, Persona, or shot state.

## Root Cause

The v1 provider strategy treated the exact Artwork as a generative conditioning reference. Prompt instructions cannot turn a generative edit into deterministic pixel reproduction. Typography and composition changes were therefore an architectural limitation, not a frozen-input or duplicate-execution failure.

## Production Consequence

Historical v1 stays readable as `DRAFT_GENERATIVE_ARTWORK`. Exact production must use v2 `DETERMINISTIC_COMPOSITE`: Stage A generates a clean Persona/Product base without Master Artwork input; Stage B applies checksummed original Artwork pixels locally to a calibrated `PrintSurface`.

No signed URLs, credentials, or private object bytes are recorded in this document.
