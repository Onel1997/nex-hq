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

## Deterministic Mockup Production V1 — Current State

Read-only forensics confirmed the first succeeded paid job executed its exact frozen v1 Artwork, Shopify variant, Brand Model lock, shot, provider/model, and fingerprint. The unacceptable artwork change was caused by the v1 dual-reference generative edit, not stale input selection. See [forensics](./FIRST_LIVE_IMAGE_JOB_FORENSICS_2026-08-17.md).

The foundation now defines `image-generation-input-v2` with two explicit production modes:

- `DETERMINISTIC_COMPOSITE` — production target. Stage A receives Persona + Product/reference inputs and explicitly no Master Artwork; Stage B applies checksummed original Artwork pixels locally.
- `DRAFT_GENERATIVE_ARTWORK` — historical/draft semantics for strategies that ask a provider to interpret Artwork.

V2 freezes Brand Model, Product/variant, checksummed private Product references, Master Artwork, calibrated PrintSurface, one shot, base settings, and compositor settings. The entire contract is fingerprinted. Base success is a persisted retry boundary: composite failure never authorizes an automatic provider recall. The durable review record retains identity, Product, Artwork, placement, perspective and lighting dimensions; the normal owner UI presents one concise acknowledgement plus explicit Freigeben/Ablehnen instead of six repetitive checkboxes.

`nexhq-deterministic-compositor-v2` is the current production contract. It checksum-verifies both inputs, fits the original Artwork inside the resolved PrintSurface with one uniform scale plus translation, preserves its exact aspect ratio, leaves natural empty space, alpha-composites deterministically, and records the effective scale/rectangle in provenance. Historical compositor-v1 snapshots keep their frozen projective-fill meaning and are never reinterpreted. The repository-backed no-provider E2E harness passes.

Migration `20260817170000_deterministic_mockup_foundation_v1.sql` is **APPLIED AND VERIFIED** on the linked project. The existing v1 paid executor remains explicitly labeled Draft Generative Artwork and must not be used where exact Artwork fidelity is required. A real provider-backed V2 Stage A is still unwired and unauthorized. Full architecture: [Deterministic Mockup Pipeline](./DETERMINISTIC_MOCKUP_PIPELINE.md).

## German production UX — 2026-08-17

Deterministic Mockup V2 is visually primary. The owner flow presents Artwork, verified Product/Variant, approved Markenmodel, one shot, semantic Druckseite/Platzierung, review/cost, confirmation, generation stages and result review. Exact PrintSurface corners remain available for visual fine adjustment under Advanced; normalized coordinates are nested as technical detail. Persistent loading explicitly describes reference preparation, base generation/compositing state and warns against duplicate clicks. Technical fingerprints/lineage are collapsed; previous runs are separated. V1 is explicitly labelled a generative preview that can alter Artwork. No execution or authority rule changed.

## Final UX Cleanup — 2026-08-17

The stable page identity is now **Image Studio — Mockups und Kampagnenbilder erstellen**, independent of any Design Research title. Research mission/garment/color hints survive only as collapsed non-authoritative Design context. Deterministic V2 is the first visual workflow; saved V1 draft jobs, the 12-shot legacy queue, gallery, and inspector remain historically recoverable under collapsed secondary sections. Shot names and states render through German owner terminology, while UUIDs, fingerprint, raw provider/model and lineage remain under technical details. Operational headings use the shared Geist Sans scale; no serif Image heading remains.

## Product Intelligence integration — 2026-08-17

Deterministic V2 product selection now distinguishes **Shopify verifiziert** from **Manuelles Produkt**. Shopify selection still verifies the exact live variant and freezes allowed CDN references. Manual selection requires a durable non-draft/non-archived profile, exact manual variant/color context, at least one private checksummed FRONT/FEATURED reference, and an explicit calibrated/HUMAN_DEFINED PrintSurface. It fails closed rather than fabricating availability, construction or geometry.

V2 snapshots now emit `product-visual-input-v2`: Product Profile ID/version, authority, type, exact variant, color/size, material/GSM/fit, construction snapshot, frozen reference package/checksums and PrintSurface. These fields are covered by the job fingerprint. Artwork and Persona remain separate inputs. Legacy V1 remains Shopify-only generative draft behavior.

## Approved Image → Video seam — 2026-08-18

A Video production source must be a durable human-`APPROVED` deterministic Image asset. Video resolves it server-side and binds its project/job/fingerprint/checksum, Brand Model, Product Profile/version/variant, Artwork version/checksum and review evidence. Rejected, unreviewed, cross-workspace or lineage-mismatched assets fail closed. Image remains the source authority; Video does not mutate Image review.

## Content Packs V1 (2026-08-19)

The Aufnahme step now offers:

- **Basis-Pack:** Shopify Produktbild; Lifestyle mit Model; Premium Flatlay; Kleiderbügel / Kleiderstange; Social Hero / Story.
- **Winning Design Expansion:** 15 selectable clean, flatlay, retail, lifestyle, campaign, feed, story, carousel, detail, and Product-highlight shots. The owner triggers it manually; NexHQ performs no winner detection.
- **Eigene Auswahl:** preserves the existing shot plan and product-specific options.

Each shot has stable identity, German purpose, Shopify/Feed/Story/Reel/Carousel/Social/Campaign intent, and non-binding aspect intent. Compatibility is derived from Product type; an unknown Product receives generic safe choices only. Progress is counted only against exact durable V2 lineage. Packs never call providers and never create a batch.

## Semantic Print Placement V1 (2026-08-19)

Content Pack cards now show an explicit cyan/blue selected state plus **Ausgewählt**. Selecting another card replaces the current canonical `assetId`; it does not create a selection list or queue. The current **Aufnahme** summary updates from that same production authority.

After the one shot is selected, the owner chooses **Druckseite** and a Product-aware placement. T-Shirt/Hoodie/Jacket support is distinct from Zip Hoodie split-front behavior, Jogger/Pants expose leg placements instead of chest placements, and Headwear requires its own known panels. The resolver considers exact variant binding and accepts only one ready matching Product Profile surface. Missing or ambiguous Product geometry fails closed.

The four-point tool is retained under **Erweiterte Platzierung · Feinjustierung**. Existing geometry is loaded exactly. An owner edit on a Shopify surface is persisted through the existing authenticated calibration path as a new human-defined version; Manual Product geometry remains owned by Product Library. Normal selection never invents a quad.

`Beidseitig` is a plan for two views, not a production mode. The UI states that front and back are individually prepared, confirmed and created. Current deterministic V2 remains one shot + one PrintSurface + one job + one asset.

## One-time Product calibration and both-side planning — 2026-08-19

The normal path no longer treats four corners as per-Artwork input. Semantic side/preset resolves a ready Product-owned surface. When found, Image Studio shows **Druckfläche bereit · Version X** and keeps geometry closed. When absent, **Druckfläche einrichten** performs an explicit one-time versioned Product calibration. Family reuse requires owner attestation of the same physical blank and normalized compatible variants.

**Feinjustierung** is job-local: its quad is frozen as an override bound to the canonical surface ID/version and changes the job fingerprint, but does not mutate Product Library truth. Canonical Product recalibration remains a separate explicit Product action.

**Beidseitig** shows two entries — Vorderseite and Rückseite — with independent side-specific shot, placement, surface readiness, and exact-lineage status. Buttons only select the relevant side for the next Prepare. No job is prepared, confirmed, or executed automatically; completion of the front never completes the back.


## Simplified production flow and strict scale lock — 2026-08-19

The owner path now uses four broad phases — **Auswahl → Platzierung → Erstellen → Ergebnis** — while the same authority checks remain server-side. Social Content Assets are the primary planning view; Shopify Mockups are a smaller, product-first view. Both remain filters/projections over the one canonical shot selection and cannot create a batch.

Current prepares freeze compositor v2 plus `CONTAIN_UNIFORM_ASPECT_LOCKED`. The Master Artwork may move and scale uniformly only. It cannot receive independent X/Y scale, rotation, homography, squash, stretch, or fill-to-region distortion. The private authenticated Artwork preview uses the same resolver and requested output aspect as Stage B. Fingerprints bind the policy and all derivation inputs; output provenance records the effective uniform scale and applied rectangle.

Synthetic output remains available only inside collapsed technical controls in development/test. It is not the normal owner result surface. Real results use a single concise human acknowledgement followed by explicit **Freigeben** or **Ablehnen**; durable review evidence stays complete. New exact-variant Product calibration requires no reuse checklist. Cross-variant/family reuse remains explicit under **Erweiterte Produktzuordnung** and keeps its attestations.

## Social Content Engine V1 — 2026-08-20

After choosing one canonical Content Pack shot, the owner now selects a compact creative preset. Social presets cover clean/editorial studio, urban street, parking garage, stadium, minimal/premium interior, rack/showroom, sports props, soft/editorial flatlay and sunset lifestyle where compatible with the shot's model requirement. Advanced adjustment exposes structured scene, location, lighting, framing, angle, composition and mood—not raw provider prompt controls.

Shopify mode exposes only **Shopify Standard**, a consistent alternate studio treatment and Product detail where compatible. Switching content purpose selects a compatible canonical single shot if the previous shot belongs only to the other purpose. The current production summary shows content intent, scene, location, light, camera, mood and channel before Prepare.

`social-creative-direction-v1` is required by the owner Prepare flow and included in the durable V2 snapshot. It cannot override exact Product intelligence, Brand Model authority, semantic placement or `CONTAIN_UNIFORM_ASPECT_LOCKED`. A locally planned Social variety list is explicitly zero-job state; each entry must later be selected, prepared, confirmed and reviewed independently.

## Automatic placement and stable shot flow — 2026-08-20

The normal owner journey is **Artwork → Produkt → Farbe/Größe → Markenmodel → Output-Ziel/Content-Stil → Druckseite → Platzierung → Vorbereiten & Kosten prüfen → Ergebnis**. There is no separate numbered Aufnahme phase: the selected Content Pack card owns the one visible selection and immediately updates the canonical shot used by V2. Creative direction is derived synchronously for that shot, so it does not flash a temporary “Aufnahme wählen” state while defaults settle.

After the owner chooses side and semantic placement, Image Studio automatically resolves an exact Product region. Resolution prefers existing owner/Product geometry, then an explicitly verified reusable physical-family surface, then a versioned NexHQ standard template for a supported garment family. Normal UI shows **Platzierung automatisch bereit** and **Artwork-Proportionen gesperrt**, never four-corner coordinates or reuse attestations. Unknown/custom Products fail closed with a route to Product Library technical data. `Beidseitig` remains a two-entry plan that creates zero automatic jobs.

## Final daily owner flow — 2026-08-20

The primary path is now: **approved Artwork handoff → Produkt → Farbe/Größe → Markenmodel → Output-Ziel → Content-Stil → Stil-Preset → Druckseite → Platzierung → Vorbereiten & Kosten prüfen → Bild erstellen → Ergebnis → Freigeben/Ablehnen**. The visual navigation has only four phases: **Auswahl, Stil & Platzierung, Erstellen, Ergebnis**. There is no duplicate Aufnahme phase, calibration wizard, provider-stage wizard, or second simultaneous summary.

Social Content exposes Basis-Pack, Winning Design Expansion, and Eigene Auswahl. Winning shots are grouped into owner categories such as Model & Lifestyle, Produkt, Flatlay, Story & Feed, Kampagne, and Detail. Shopify Mockups hide pack mechanics and stay on three consistent Shopify Standard choices. Presets are the primary creative control; scene/location/light/camera/composition/mood are closed under **Stil anpassen**.

Normal placement never says PrintSurface. Supported Products proceed automatically; unsupported placement shows one concise Product-details action. The result page asks **Passt das Ergebnis?** and accepts a direct human Freigeben/Ablehnen decision. Synthetic results and tools never appear as normal production output. All technical authority and recovery semantics remain unchanged.

## Final QA fixes and production executor — 2026-08-20

- **Artwork:** the compact `Artwork wechseln` control lists approved durable Artworks with private authenticated thumbnails and owner names. Design handoff still preselects exactly.
- **Markenmodel:** a sole eligible Model defaults once. Parent re-renders and eligibility fetch completion no longer restart selection; a manual choice remains until it is actually ineligible.
- **Pack progress:** optional history fetches use a stable exact-lineage key. Empty/unavailable history is silent and never owns shot state.
- **Placement:** standard templates preview a clean axis-aligned rectangle; Artwork uses `contain`, one uniform scale and translation, with no rotation/skew/perspective.
- **Production:** **Bild erstellen** first persists the exact confirmation and then explicitly invokes the real deterministic v2 executor. A confirmed interrupted job exposes **Produktion fortsetzen**; page load never executes it automatically.

The provider-ready path remains defense-in-depth gated. At this checkpoint `OPENAI_API_KEY` is configured, while `NEXHQ_IMAGE_PAID_GENERATION_ENABLED=false`; no live request was made.

## First real V2 print-purity correction — 2026-08-20

The first owner-authorized real run completed the paid Stage A → local Stage B path and exposed a Product-reference contamination defect: the Base shirt already contained a legacy Milaene print. The approved Artwork was correctly excluded from Stage A, but deterministic alpha compositing cannot erase unrelated Base pixels by itself.

New jobs now carry a stronger blank-garment prompt contract and a local fail-closed Base-region purity assessment before Stage B. If a foreign print is suspected, Image Studio shows **Fremder Aufdruck im Basisbild erkannt**, refuses to apply the approved Artwork, creates no reviewable result, and asks the owner to choose a different style or shot and prepare a new image. No automatic paid retry occurs.

Large front placement for standard T-shirts is moderately larger and higher for new prepares. The adjustment is a rectangular, fingerprinted job override; Artwork proportions remain locked, Product calibration is not mutated, and historical jobs retain their frozen geometry.

## Real-image quality hardening — 2026-08-20

Stage A now treats the locked Persona Master as the highest-priority human-subject constraint. The Master remains provider input image 1, the five locked supporting views reinforce that exact person, and Product references are explicitly limited to garment truth. Scene, location, mood, cultural cues, and Product imagery may never recast or reinterpret the Markenmodel.

The blank-garment contract also asks for a frontally readable, gently tensioned, unobstructed print zone. This does not weaken the local contamination gate; it improves the Base conditions under which exact flat deterministic compositing can look coherent. The approved Artwork remains absent from Stage A and is still the only Stage B print source.

New standard T-shirt `FRONT_LARGE` prepares use tuning v2: a rectangular region 20% larger than the resolved canonical bounds and shifted 2.5% of output height upward. Uniform `contain` scaling and the approved pixel content remain unchanged. Review now calls out four practical checks without adding required checkboxes: identity, absence of foreign prints, natural Artwork placement, and premium environment quality.
## Real Production Quality Pass — 2026-08-20

The real owner flow now has a stable visible production state instead of one silent disabled interval. The current job is read during execution and maps to German phases: confirmation, Persona/Product preparation, Base creation, deterministic Artwork application, persistence, and review. The status area reserves its layout, explains that the current attempt is active, and prevents duplicate clicks. **Produktion fortsetzen** appears only for a safely recovered confirmed job; ambiguous provider outcomes remain fail-closed and cannot be retried blindly. Main errors are concise German guidance, while raw details stay collapsed.

New jobs use Fabric-Aware Artwork Integration V1. The exact approved Artwork checksum and global aspect ratio remain authoritative. Stage B fits it with uniform scale, then applies only bounded Base-derived cloth displacement, local light/shadow response, fine texture blending, and fixed print opacity. The policy is fingerprinted and provenance-bounded; historical flat compositor jobs are unchanged. This is a conservative improvement for gently tensioned fabric, not a claim of full garment UV, fold segmentation, or occlusion-aware simulation.

Stage A now treats exact Brand Model identity as higher priority than pose, props, location, or scene novelty. It requests a premium commercially publishable composition and a blank, frontally readable, gently tensioned print zone. Social shot direction adds product-led quality rules for model lifestyle, premium flatlay, hanger/rack, vertical social hero, campaign hero, and product-highlight assets. No Artwork pixels enter Stage A, and the existing contamination gate still refuses Stage B when the Base is not demonstrably blank enough.

The Artwork picker keeps its loaded approved list stable for the session, places the selected Artwork first, and uses a single-column row layout with a reserved loading frame. Missing shot assets now explain whether the project plan is still loading or the option is not present, instead of looking silently broken.

## Stage-A Base diagnostics and purity v2 — 2026-08-20

The latest persisted contaminated run was inspected read-only. Its checksummed 1024×1024 Stage-A Base showed a visually blank beige T-shirt. The v1 detector nevertheless classified beard/skin/collar edges inside an overly broad frozen placement box as a connected graphic. This was a detector false positive, not a copied Product-reference print.

New runs use `base-print-purity-v2`. The exact effective placement remains frozen and visible, but detector signal analysis occurs inside a conservative inner print core so face, collar, boundary seams, smooth shadows, folds, and fabric grain cannot dominate the metrics. The guard still fails closed for coherent high-contrast text/logo/graphic patterns. The failed paid job remains historical and must not be retried.

**Technische Details → Stage-A Basisbild** now requests an authenticated preview of the exact persisted Base for that job and overlays its frozen print-region quad. The endpoint verifies workspace/job authority, checksum-verifies the stored bytes, and streams them with private no-store headers; it never returns a storage URL or private storage path.

## Product Family + MarketPrint-style placement (2026-08-20)

Manual Product production now starts with **Produktfamilie → Farbe → optional Größe**. Image Studio resolves the exact Product Profile and variant internally and shows the selected color's private blank Product thumbnail when available. It then overlays the saved family-wide green printable rectangle and places the approved Artwork with ratio-locked contain, centre-safe margin, pointer translation, reset, and uniform scale only.

This editor changes production intent, not Artwork or Product authority. Prepare freezes family/color/side, template ID/version, printable rectangle, owner scale/translation, and the locked aspect policy. Changing placement invalidates an existing estimate. Stage A excludes the green overlay and prefers exact blank Product references. Stage B remains the existing fabric-aware deterministic compositor, and all existing Social/Shopify Content Packs and review/recovery behavior continue unchanged.

## Startup fast path and Garment Registration V2 — 2026-08-21

The normal Product Family path no longer waits for the independent live Shopify catalog or for signed previews of every Product reference. Image Studio reads a lean canonical Product Family production view, settles Product Family and Shopify sources independently, coalesces stable owner-data requests briefly, and invalidates Product Family cache entries after actual Product Library writes. Static canonical Content Pack cards render immediately; optional history is deferred and can never own or block shot selection. The durable report remains mandatory before Prepare.

Historical Product Family jobs keep `GENERATED_GARMENT_RELATIVE_V2`. New jobs freeze `GENERATED_GARMENT_RELATIVE_V3`. After Stage A, a local deterministic registration pass finds the visible T-shirt/hoodie component using declared garment colour, central torso evidence, connected boundaries, torso-row boundaries, and face/neck exclusion when local landmarks are available. MarketPrint calibration is interpreted in garment coordinates, then owner uniform scale/translation and the exact semantic placement preset are transferred to the detected garment. Low confidence fails closed before purity or Stage B.

For T-shirts, `Brust links`, `Brust mittig`, and `Großer Frontprint` are distinct execution intents. A large front print must retain a large central body region below the collar. It is never silently reduced or moved into a chest-print template. If the selected size cannot be registered safely, production stops with `Druckfläche konnte in dieser Größe auf dem Shirt nicht sicher angewendet werden.`

The registered rectangle—not template screenshot coordinates—is used by Base purity and Fabric-Aware V1. Historical V1 placement and compositor snapshots retain their original meaning. **Technische Details → Stage-A Basisbild** overlays the detected garment outline and final registered print region with confidence/coverage evidence.

## SAM 3 garment precision evidence — 2026-08-21

SAM 3 is invisible during normal planning and runs only after the one real Stage-A Base exists. During that execution Image Studio may describe the active work as garment recognition; it never introduces a new owner decision. The selected Product Family, color, Content Pack shot, semantic placement, and MarketPrint placement remain unchanged.

For new Product Family V3 prepares, a fully configured server-side segmentation adapter is mandatory and its configured maximum cost is included in the single combined maximum estimate. Missing configuration blocks Prepare before provider spend. A rejected mask stops before Artwork application with `Kleidungsstück konnte auf diesem Bild nicht sicher erkannt werden.` A safe large-front region remains large; unsafe geometry fails rather than becoming a chest print.

**Technische Details → Stage-A Basisbild → Garment Segmentation** exposes the authenticated Base, private mask overlay, candidate count, provider/model/version, bounds/coverage evidence, V3 registered region, placement preservation, and rejection reason. Neither storage paths nor provider secrets are returned to the browser.

### Hosted fal execution

The normal SAM provider is now fal's hosted `fal-ai/sam-3/image`; Image Studio no longer depends on a custom inference endpoint. Prepare freezes provider `fal`, the exact model, adapter version and configured USD 0.005 maximum. During execution the owner sees that garment recognition follows Base creation; after the mask is ready the status continues into local Artwork application. No new selection or confirmation step was added.

## Surface-conforming print quality — 2026-08-23

New Product Family jobs add a bounded deterministic surface mesh after Garment Registration V3 and before final Fabric-Aware rendering. MarketPrint and owner scale/X/Y still define placement; `FRONT_LARGE` remains large and central or fails. The mesh only adapts approved pixels mildly to garment silhouette, curvature, folds, light, shadows, and texture. SAM clipping remains absolute, and unsafe mask coverage, surface evidence, warp, or typography distortion produces a concise fail-closed message with no reviewable result.

Normal production gains no new step. **Technische Details → Stage-A Basisbild** may show the surface version, mesh, applied warp, clamp reasons, curvature/fold/light/texture evidence, mask coverage, realism confidence, flat-overlay risk, and refusal reason. Historical jobs display no surface evidence and retain their existing output.
# Exact Artwork contain fit

New Product Family preparations freeze `CONTAIN` as the Artwork fit contract.
The full approved raster bounds—including transparent padding—are scaled with
one uniform factor, centered by default, and then moved/scaled only as one
locked unit by the owner controls. Preview and Stage B share the same contain
resolver. Unused space stays empty; crop, independent axis scaling, ratio
normalization, and content-aware trimming are forbidden. Historical jobs keep
their frozen interpretation.

## Previous Runs owner library — 2026-08-23

**Vorherige Durchläufe** is a lazy owner-facing view over the existing durable
V2 jobs, stages and assets. It loads only when opened, sorts by the persisted
job creation time (newest first), formats that exact timestamp in the owner's
local time, and shows Artwork, Product/color, Brand Model, output goal, shot,
placement, status and an authenticated private thumbnail when available.
Opening a card performs a read-only recovery of that exact job; it neither
creates a job nor invokes a provider.

**Artwork erneut anwenden** is shown only after a server-side read-only
authority check verifies the stored Base bytes/checksum, passed identity gate,
validated SAM mask, V3 registration, clean Base, exact Artwork bytes and the
absence of an existing final asset or unknown provider outcome. The action
reuses the persisted paid Base and mask and runs deterministic Stage B only.
UUIDs, fingerprints and lineage remain collapsed under Technical Details.

## T-shirt Front-Torso Envelope — 2026-08-23

For new Product Family `FRONT_LARGE` work, the technical Stage-A preview
separates the full SAM garment, the true central shirt-torso envelope and the
final Artwork region. Sleeve width and dropped shoulders cannot define the
print width. MarketPrint/owner intent maps into the torso envelope once; unsafe
or cropped torso evidence stops with a concise owner error before compositing.

## Depth-Aware Surface Integration V1 — 2026-08-23

New T-shirt Product Family jobs freeze
`nexhq-depth-aware-surface-integration-v1` as an additive local-surface policy.
The already registered torso envelope and owner print footprint remain the only
global placement authority. Stage B derives a relative, non-metric surface field
from the exact frozen Stage-A pixels plus the validated SAM mask: garment
centreline drift provides bounded shirt-plane orientation, mask-width change
provides mild perspective evidence, and low-pass garment luminance provides
local relative depth variation. This evidence augments the existing
Surface-Conforming mesh before Fabric-Aware sampling.

Every outer mesh node remains pinned. The depth layer performs no second
CONTAIN, scale, or translation pass and cannot change the print rectangle.
Combined local deformation is checked against the existing total displacement
ceiling, the real Jacobian typography gate, and strict SAM coverage. Missing or
unsafe evidence fails closed with an owner-safe message and creates no review
asset. Historical snapshots have no optional depth contract and retain their
frozen behavior.

Technical details report the contract/status, relative plane tilt, perspective,
depth/surface confidence, applied local warp, typography risk, mask coverage,
clamps, and explicit confirmation that global footprint, scale and translation
were not changed. These are deterministic relative-surface diagnostics, not a
claim of metric monocular depth or full cloth UV reconstruction.

## Print-ready FRONT_LARGE and Depth (2026-08-23)

The owner flow does not gain a Depth control. New eligible model-based T-shirt `FRONT_LARGE` jobs freeze `nexhq-print-ready-stage-a-v1`; tight portraits, crossed/occluded torsos, and missing lower shirt visibility fail before later paid geometry tools where the local evidence is decisive. During real processing, the truthful status may show `Stofftiefe wird analysiert …`. The normal estimate is combined; provider/model/cap and evidence remain under Technical Details.

## Owner Vertical Placement V1 — 2026-08-24

Supported front placements expose one simple height control in the MarketPrint
placement editor. `Höher`, `Tiefer`, the slider, and `Höhe zurücksetzen` update
the same preview state immediately; they do not create a second placement
system. Prepare freezes `nexhq-owner-vertical-placement-v1` with the selected
scale/X/Y, canonical one-CONTAIN rectangle, torso-envelope reference, expected
registered centre and explicit clamp policy.

Registration maps that Y intent into the real front-torso envelope once. A
small collar/hem safety correction is recorded; a correction beyond the frozen
tolerance fails closed instead of silently recentring. Previous Runs restores
the exact scale/X/Y. Technical Details shows requested, preview, registered and
final Y plus clamp evidence and confirms that no second contain, scale, or
translation occurred. New jobs carrying this contract use a modestly stronger
but still bounded local depth/surface response; the outer footprint and
Jacobian typography limit remain unchanged.

## Surface Realism Refinement V1 — 2026-08-25

New eligible T-shirt Product Family `FRONT_LARGE` jobs freeze
`nexhq-surface-realism-refinement-v1` after the existing depth-aware mesh. It
uses the validated torso/mask, current depth evidence, low-frequency real-depth
plane slopes, detrended local depth gradients, and Base luminance only as a
bounded cross-check. The refinement strengthens coherent shirt-plane,
perspective, curvature, and surface-direction response inside the print while
keeping every boundary node pinned.

The owner flow and height controls are unchanged. MarketPrint, the frozen
owner footprint, owner X/Y, the front-torso envelope, and registered Y remain
global authority; refinement performs no contain, global scale, translation,
or recentering. New scalar shading/texture transfer preserves hue while making
shirt shadows, highlights, and grain more visible through the print within the
existing ±20% shading bound. Unsafe evidence, excessive clamping, or Jacobian
typography risk fails closed with no review asset.

Technical Details reports real-depth/fallback use, plane and perspective
guidance, surface direction, curvature, bounded warp, shading/texture strength,
mask coverage, typography risk, pinned footprint, registered-Y preservation,
and the exact refusal reason. Historical snapshots without the optional
contract retain their frozen rendering.

## Corrected Depth-Aware perspective diagnostics — 2026-08-26

New T-shirt production prepares use
`nexhq-depth-aware-surface-integration-v1.1-garment-plane`. Technical Details
now distinguishes the warp requested by the sampled garment transform, the
safely bounded candidate, the actually applied warp, and any rejected excess.
The plane fit is restricted to the validated SAM/torso/print neighbourhood, so
parking-garage walls, pillars, floor, sleeves, and shoulder flare cannot define
shirt perspective.

If Surface Realism was frozen but an earlier Depth-Aware gate refused the job,
the UI says that the refinement was configured but not reached; it no longer
labels such a job as historical. Historical V1 jobs retain their frozen policy
and are not silently reinterpreted by `Artwork erneut anwenden`.

## Near-planar garment depth — 2026-08-26

Technical Details now distinguishes depth amplitude from depth reliability for
new `nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth` jobs. It shows
the depth classification, surface mode, real-depth confidence, SAM coverage,
torso stability, local fabric evidence, discontinuity stability, usable masked
samples, blended confidence, and requested/safe/applied warp.

A validated smooth front-facing shirt may be classified `LOW_STABLE` and use
`NEAR_PLANAR_HYBRID`: real depth remains directional evidence while local
fabric, light, folds, and texture keep the print physically integrated. Global
owner scale/X/Y, FRONT_LARGE, torso envelope, one-CONTAIN, mask clipping, and
typography safety remain unchanged. Historical V1/V1.1 refusals are not
silently upgraded by `Artwork erneut anwenden`.

## Oriented Front Print Plane V2 — 2026-08-26

Fresh Product Family T-shirt front jobs freeze
`nexhq-oriented-front-print-plane-v2`. After SAM and the front-torso envelope,
registration robustly fits the stable torso centerline and left/right torso
edges. It excludes sleeve-expanded rows and all background geometry, then maps
the already-frozen owner footprint into one mildly rotated/perspective quad.
Owner scale, X, Y, strict CONTAIN and the quad centre remain unchanged.

The oriented quad is the global receiving plane. Depth-Aware V1.2 and Surface
Realism may deform only its interior locally. Every quad corner must remain in
the printable torso and the SAM mask with collar/hem clearance; otherwise the
job fails closed instead of reverting to an upright rectangle. Technical
Details renders the existing blue SAM and amber torso layers plus the cyan
oriented quad, and reports confidence, edge tilts, perspective, containment,
owner authority, and the final combined typography risk. Historical jobs
without the optional contract keep their frozen axis-aligned interpretation.

## Oriented Torso Coordinate Frame V2.1 — 2026-08-26

Fresh eligible T-shirt front jobs now freeze
`nexhq-oriented-front-print-plane-v2.1-torso-frame`. The owner footprint is
expressed once in local torso U/V coordinates and projected through a
SAM-derived, sleeve-suppressed torso-safe polygon. Registration no longer
rotates an already axis-aligned image rectangle or tests it against the old
upright torso box. A 90% FRONT_LARGE footprint therefore retains its requested
local physical size while following mild torso lean.

Containment is evaluated against both the torso polygon and SAM pixels. Collar,
hem, left, and right clearances are measured in local torso space. Technical
Details distinguishes `PASS`, `FAIL`, and `NOT_EVALUATED`; an early orientation
refusal can no longer appear as a fabricated 0% SAM measurement. The amber
preview is the actual torso-safe polygon and cyan is the projected owner quad.
Historical V2 snapshots retain their post-hoc rectangle interpretation.
## MiDaS normal-assisted shirt orientation (2026-08-27)

Fresh eligible front T-shirt jobs freeze `nexhq-fal-midas-normal-v1` and
`nexhq-normal-assisted-oriented-torso-v1` behind the provider-neutral normal
estimation seam. The exact private Stage-A Base is the only fal MiDaS input;
Artwork and Artwork metadata are never sent. The normalized normal map is
checksum-bound to the Base and reused for deterministic recovery.

The current global registration contract is
`nexhq-oriented-front-print-plane-v2.2-normal-assisted`. It analyses normals
only inside `SAM ∩ torso-safe polygon ∩ print neighbourhood`, removes collar
transition/sleeve influence, and combines normal and silhouette evidence with
confidence-squared weights. Strong agreement raises confidence, either strong
source may rescue the weaker source, and strong contradiction fails closed.
Owner scale/X/Y, one-CONTAIN-only placement, torso containment, and typography
safety remain unchanged. Depth Anything V2 remains the downstream relative
depth authority; MiDaS depth output is not persisted or substituted for it.

Server configuration reuses `FAL_KEY`. Because the endpoint is compute-priced,
production Prepare also requires an owner-defined `NEXHQ_MIDAS_COST_MAX_USD`
instead of inventing a price. `NEXHQ_MIDAS_PROVIDER` and
`NEXHQ_MIDAS_MODEL` are optional overrides; the default provider/model are
`fal` and `fal-ai/image-preprocessors/midas`.
