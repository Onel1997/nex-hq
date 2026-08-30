# Social Content Engine

Status: **CURRENT V1 implemented; real provider execution not authorized or verified**
Last verified: 2026-08-20

## Purpose

Social Content is NexHQ's main still-image creative expansion layer. It creates controlled visual variety from the same approved authorities:

```text
Approved Artwork
+ exact Product / variant / references / PrintSurface
+ approved Markenmodel where the shot requires one
+ one canonical shot
+ one structured creative direction
→ one V2 Prepare
→ one confirmation
→ one Stage A base
→ one deterministic Stage B composite
→ one reviewed asset
```

It does not create a competing Product, Artwork, Persona, shot, job or review authority.

## Shopify Mockups versus Social Content

### Shopify Mockups

- few outputs, normally one to three;
- Shopify Standard consistency across scene philosophy, light and framing;
- clean Product readability and predictable presentation;
- presets limited to Standard, alternate studio and detail where compatible.

### Social Content

- many possible owner-selected executions;
- studio, urban, parking, stadium, interior, rack, prop, flatlay, detail, outdoor and hero directions;
- compatible model-based or Product-only presentation;
- Feed, Story, Reel Cover, Carousel, Social and Campaign intent;
- never random and never automatically generated as a pack.

## Contract

`social-creative-direction-v1` freezes:

- content mode and exact shot ID;
- preset;
- scene and location;
- lighting;
- camera framing and angle;
- composition;
- subject direction;
- Product presentation;
- mood;
- channel and aspect intent;
- optional bounded owner direction;
- whether the value came from a smart default, selection or adjustment.

The contract is provider-neutral and Zod-validated. Owner labels are German; internal enums remain stable English tokens.

## Presets and compatibility

V1 presets include Shopify Standard/alternate/detail, Clean Studio, Editorial Studio, Urban Street, Parking Garage, Stadium, Minimal Interior, Premium Interior, Rack/Showroom, Sports Props, Soft Flatlay, Editorial Flatlay and Sunset Lifestyle.

Canonical shot metadata decides whether a Markenmodel is required. Model-only presets are not offered to Product-only shots. Product-only direction is normalized to Product-only subject and a compatible presentation such as flatlay, hanger, rack, folded, detail, tabletop or props. Defaults are suggestions and owner adjustments remain explicit.

## Controlled variety and anti-repetition

`social-variation-plan-v1` stores only an in-memory owner planning list in V1. It declares:

- `MANUAL_SINGLE_ASSET_ONLY`;
- `automaticJobCount: 0`;
- one shot identity for all entries.

The suggestion helper prefers scenes and locations absent from supplied recent planning directions. There is no durable analytics, performance inference, random selection or automatic execution in V1.

## Stage A and Artwork safety

Stage A consumes Persona authority, exact Product intelligence/frozen references and the structured direction. Its prompt adapter explicitly says that creative style cannot override verified Product truth and that no Artwork, logo or typography may be drawn or inferred.

Stage B remains the sole Artwork application stage. Compositor V2 verifies the approved checksum and permits translation plus one uniform scale only. Creative direction cannot alter the Artwork aspect ratio, internal layout, typography or colors.

## Snapshot and history

New owner prepares include creative direction in `image-generation-input-v2`; whole-snapshot hashing makes every axis confirmation-critical. The active UI also invalidates a prepared run when direction changes. Historical V2 snapshots without the optional field continue to parse and retain their old interpretation.

## Current limitations

- The real Stage A adapter is connected and has completed one owner-authorized controlled run; identity, environment, and exact composition still require controlled QA because generative image models cannot guarantee perfect consistency.
- Variation plans are intentionally local; they do not survive reload.
- Anti-repetition is a lightweight planning seam, not performance analytics.
- Provider fidelity for complex scene/Product combinations remains unverified until a separately authorized controlled test.

## Stable creative-direction rendering (2026-08-20)

The selected canonical shot and its effective creative direction now resolve in the same render. A compatible existing direction is retained; otherwise the deterministic shot/mode default is produced synchronously. The selector no longer depends on a post-paint effect that briefly rendered a missing-shot guidance card, and pack-progress requests cannot clear selection state. The contract, fingerprint behavior, and zero-job variation planning remain unchanged.

## Preset-first daily UX (2026-08-20)

Normal creative direction is now **Stil wählen**. One preset fills scene, location, lighting, camera, composition, presentation, and mood. Detailed axes remain closed under **Stil anpassen**, so most owners can continue after one preset selection. The synchronous effective-direction resolver remains in place, preventing null-state flashes and layout jumps.

The structured contract, Stage A Artwork exclusion, Stage B aspect lock, snapshot fingerprint, and zero-job Social variety planning are unchanged.

## Production handoff readiness — 2026-08-20

The selected Social shot and structured direction now reach the real deterministic Stage A request alongside exact Persona and Product references. Content Pack progress remains optional history: empty or unavailable progress is silent and cannot clear the shot or creative preset. No Artwork bytes, Artwork description, ID, or filename are sent to Stage A; Stage B alone consumes the approved Artwork.

## Premium preset quality contract — 2026-08-20

Every frozen preset now projects a provider-facing quality direction in addition to its structured axes. The global contract requires premium commercial fashion photography, an intentional coherent background, refined lighting, clean composition, and commercially usable styling while rejecting random text, logos, clutter, low-grade scenery, and cultural stereotypes.

Urban Street is explicitly a clean, well-maintained contemporary city environment with elegant architecture; Parkhaus is a clean modern architectural structure; Stadion is modern, orderly and sponsor-free; studio and interior presets specify refined backdrops, materials and controlled set design. The environment must come from the selected preset and never from the Markenmodel's identity or ethnicity. These rules affect new Stage A prompts only; they do not alter Persona, Product, Artwork, or historical snapshots.

## Commercial quality projection — 2026-08-20

The structured Social direction now projects shot-specific commercial guidance for model lifestyle, premium flatlay, hanger/rack, vertical Social Hero, campaign hero, and Product-highlight shots. The benchmark is a clean, modern, product-led fashion campaign or premium mockup asset with coherent props, controlled materials, intentional negative space, and no accidental signage or third-party branding. Reference platforms inform the quality bar only; NexHQ does not copy their brand identity or asset content.

Identity wins over scene novelty. The selected preset may change location, lighting, framing, and mood, but it cannot recast the approved Markenmodel or derive cultural scenery from appearance. Stage A also keeps the target print area blank, readable, gently tensioned, and minimally obstructed so deterministic Stage B can apply the approved Artwork cleanly.

## Product Family continuity (2026-08-20)

Social Content keeps every existing pack, shot, and creative preset. The simpler Product Family/color selection only strengthens the garment input: exact color blanks are preferred, the green calibration image is excluded, and the owner placement intent is frozen before one selected Social execution becomes one job and one asset. Scene variety may move the garment in the composition, but it cannot change the selected family, color, side, or Artwork authority.

## Responsive planning and registered garment output — 2026-08-21

Canonical Social and Shopify shot definitions render before optional history or durable report staging completes. The owner may choose a shot immediately; one Prepare still waits for the durable report and exact Product/Persona/Artwork authority. Progress/history remains a non-blocking convenience.

For generated Product Family scenes, Social variation may move the garment in the frame but cannot move print authority into screen coordinates. Garment Registration V2 maps MarketPrint-relative size/position intent to the visible Stage-A garment before purity and Fabric-Aware compositing. Scene variety therefore cannot silently place Artwork on face, neck, background, or outside the detected garment.

## Social scenes with SAM-confirmed garment boundaries — 2026-08-21

Scene, pose, camera, and composition may vary, but new Product Family V3 jobs validate the one resulting Stage-A garment through the shared SAM 3 segmentation contract before registration. SAM remains post-Stage-A execution evidence and never participates in Content Pack availability, creative-preset selection, or page load.

The mask reduces bleed risk in varied Social scenes; Product rules and the frozen placement still choose the printable torso/leg subregion. If pose, occlusion, or candidate ambiguity prevents safe preservation—especially for `FRONT_LARGE`—the execution fails closed instead of shrinking or moving the Artwork into a different semantic placement.

## Placement-aware framing constraint

For Social Content shots that use a Brand Model plus Product Family `FRONT_LARGE`, creative framing is subordinate to print readiness. Medium/medium-full editorial framing, mild lean, and natural folds remain allowed; chest-only crops and central occlusions are not. Other placements and product-only shots keep their existing shot-specific freedom.
