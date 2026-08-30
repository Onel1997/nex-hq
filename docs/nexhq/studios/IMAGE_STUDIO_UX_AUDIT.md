# Image Studio UX Audit

Status: Read-only UX audit; broad redesign intentionally not implemented  
Audited: 2026-08-17  
Primary surface: `components/image/image-studio-workspace.tsx`

## Executive assessment

Image Studio currently exposes a capable engineering workspace rather than a clear owner production flow. Its strongest concepts—approved Design, eligible Brand Model, product truth, exact shot, estimate, confirmation, durable job, and human asset review—are present or now have technical seams, but the interface distributes them across the handoff bootstrap, six-slot queue, center canvas, right inspector, top toolbar, debug surfaces, and a separate paid-generation card.

The future UX should treat a campaign/project as the primary object and make one ordered path obvious:

> Select Design → Select Brand Model → Select Product → Choose Asset Type / Campaign Direction → Review Inputs + Cost → Confirm → Generate → Review Assets

## Current information architecture

1. **Top toolbar:** prepare/generate plus many secondary or disabled actions (Variations, Hero, Campaign, Upscale, Export, ZIP, Commercial, Marketing, Shopify).
2. **Left production queue:** six fixed mission slots, status dots, individual generation affordances, and selection.
3. **Center canvas:** empty handoff state, Creative Blueprint checklist, staging, generation overlay, or selected asset preview.
4. **Right inspector:** Live Queue, Current Model, Product Context, Prompt, Progress, Review, and History.
5. **Paid generation review:** an additional full-width technical card above the main three-column body.
6. **Debug/diagnostics:** handoff storage diagnostics, schema validation details, identifiers, fingerprint, provider/model, seed, and raw transport state.

## Current user journey problems

### 1. The required sequence is implicit

The screen does not present Design, Brand Model, Product, campaign direction, and confirmation as numbered prerequisites. A Design handoff may populate the canvas, while Brand Model and Product live in the inspector and cost confirmation appears elsewhere. The owner must infer the order.

### 2. Campaign and individual-asset mental models compete

The planner can produce a large production plan, the UI maps it into six fixed mission slots, the toolbar offers Hero/Campaign concepts, and generation prepares one selected pending asset. It is unclear whether the owner is creating a campaign, a package, a queue, or one image.

### 3. Selection is duplicated

Assets appear in the left queue, Live Queue inspector, canvas/gallery, review controls, and fixed mission-slot abstractions. Status is repeated with slightly different labels.

### 4. Technical detail overwhelms the production decision

The main owner flow exposes or foregrounds:

- input fingerprints;
- raw lock snapshot IDs;
- provider/model and generation mode;
- seed-like identifiers;
- schema validation paths/received values;
- localStorage/sessionStorage/window.name handoff diagnostics;
- provider-oriented prompt variants and execution terminology.

These are useful for support and audit, but they should not compete with “Is this the exact approved person, artwork, product, shot, and maximum cost?”

### 5. Product authority is not visually primary

The existing Design handoff supplies garment/color context while the live Shopify selector is a later inspector control. Non-authoritative fallback is labeled, but the owner needs a clearer choice between exact live product/variant and provisional Design context before cost review.

### 6. Empty states are incomplete

The primary empty state points to Design Studio but does not summarize all required inputs or show which of Design, Brand Model, Product, and Campaign Direction are missing. Migration-unavailable, live-Shopify-unavailable, no eligible Brand Model, no approved artwork, and “project recovered after reload” should be distinct states.

### 7. Confirmation is technically correct but visually detached

The paid review card contains the right facts and a maximum estimate, but it is not the natural final step of an input review wizard. The fingerprint and provider/model compete with product/artwork/identity facts.

### 8. Review authority is split

Legacy React sets track favorite/approved/revision state while durable production assets use `REVIEW_REQUIRED`, `APPROVED`, and `REJECTED`. The durable review should be the only production approval; favorites and comparison may remain local preferences.

### 9. Responsiveness risk

The three-column layout, fixed queue, center canvas, right inspector, and top toolbar produce high horizontal pressure. On narrower viewports, controls and technical cards are likely to stack without preserving the primary sequence.

## Proposed simplified journey

### Step 1 — Campaign setup

Create/open one Image Production Project. Show its name, direction, status, last update, and whether it was recovered from durable state.

### Step 2 — Inputs

Use four required, ordered selectors:

1. Approved Master Artwork (Design-owned ID/version/checksum).
2. Image-eligible Brand Model (Persona-owned lock version).
3. Product/variant (prefer verified Shopify live; label fallback clearly).
4. Asset type and campaign direction.

Each selector should show a compact authority badge and a “Change” action. A change after estimate must clearly invalidate the prior estimate/confirmation.

### Step 3 — Shot plan

Show a concise list of requested outputs with channel, aspect ratio, scene, pose, and priority. Do not generate a hidden 18–48-item plan when the owner believes they selected six outputs.

### Step 4 — Review and cost

One review screen should display WHO / WHAT / PRODUCT / HOW, output count, provider, maximum cost, expiry, and the consequence of confirmation. Put checksum/fingerprint/raw IDs under Technical Details.

### Step 5 — Generate and recover

One primary CTA changes by durable state:

- `Prepare estimate`
- `Confirm up to $X`
- `Generate confirmed shot`
- `View running job`
- `Retry known-safe failure`
- `Reconcile unknown provider outcome`
- `Review generated asset`

Refresh/login must reopen the same state rather than restaging it from browser storage.

### Step 6 — Review assets

Display private previews with `Approve`, `Reject`, and optional note. Never auto-approve. Show expired/missing preview recovery separately from asset review status.

## Elements to remove from the primary surface

- localStorage/sessionStorage/window.name diagnostics;
- raw schema validation received values;
- seed field and raw snapshot IDs;
- duplicate Live Queue when the left queue remains;
- disabled toolbar actions without a working production consequence;
- separate Commercial/Marketing/Shopify buttons before approved assets exist;
- legacy local “approved/revision” controls as production authority.

## Elements to merge

- Creative Blueprint checklist + required input selectors → **Campaign Inputs**.
- left Production Queue + inspector Live Queue → **Shot Plan / Assets**.
- Prompt + campaign direction + scene/lighting controls → **Creative Direction**.
- Progress + job status + history → **Activity & Recovery**.
- paid-generation card + final input review → **Review & Confirm**.
- local asset review + durable asset review → **Owner Review** backed only by durable state.

## Hide under Advanced / Technical

- input fingerprint;
- provider/model/request ID;
- lock snapshot UUID and package fingerprint;
- Master Artwork checksum;
- project/job/attempt IDs;
- raw OpenAI prompt;
- provenance JSON;
- storage/access diagnostics;
- schema validation path details;
- debug transport source.

The default surface may still show human-readable `Lock v3`, `Artwork V1`, `SHOPIFY_LIVE`, maximum cost, and job status.

## Proposed screen hierarchy

1. **Project header** — campaign name, durable status, last updated, reopen indicator.
2. **Progress stepper** — Inputs / Shot Plan / Review & Cost / Generation / Asset Review.
3. **Primary content** — one current step, not all controls simultaneously.
4. **Sticky summary rail** — Design, Brand Model, Product, output count, estimate.
5. **Advanced drawer** — technical trace and support diagnostics.
6. **Activity drawer** — prior attempts, failures, reconciliation, actor/timestamps.

## Proposed primary CTA flow

| Durable state | Primary CTA |
|---|---|
| Missing required input | `Complete campaign inputs` |
| Inputs complete, no estimate | `Review inputs & estimate` |
| Awaiting confirmation | `Confirm up to $X before [time]` |
| Confirmed | `Generate 1 confirmed asset` |
| Running | `View running job` (disabled duplicate execution) |
| Known-safe failure | `Review failure & retry` |
| Unknown outcome | `Reconcile with provider` (never blind retry) |
| Review required | `Review generated asset` |
| Approved/rejected | `Return to campaign` |

## Textual wireframe

```text
┌ Image Production / Autumn Zipper Campaign ── READY ─ saved 2m ago ┐
│ Inputs ── Shot Plan ── Review & Cost ── Generate ── Review Assets │
└─────────────────────────────────────────────────────────────────────┘

CAMPAIGN INPUTS
1 Design       [Approved Master Artwork · V2 · DESIGN_STUDIO] [Change]
2 Brand Model  [North African Street Premium · Lock v3]       [Change]
3 Product      [Milaene Oversized Zipper / M / Black]          [SHOPIFY_LIVE]
4 Direction    [Berlin street hero · full body · soft daylight] [Edit]

SHOT PLAN
[x] Hero portrait     1024×1536   Instagram / Shopify
[ ] Detail artwork    1536×1024   Shopify PDP

                                      [Review inputs & estimate →]

--- Review & Cost ---
WHO     North African Street Premium · Lock v3
WHAT   Approved Artwork V2 · center chest
PRODUCT Milaene Oversized Zipper · variant M/Black · available
HOW    Berlin street / full-body / soft daylight
MAX    $0.24 · expires 02:30

[Technical details ▸]              [Confirm up to $0.24]
```

## Implementation phases

1. **Authority cutover:** apply and verify the pending migrations; load durable project/job/asset state; make legacy handoff preview-only.
2. **Flow consolidation:** introduce the stepper and one Campaign Inputs summary; remove duplicate queues and legacy production approvals.
3. **Confirmation/recovery:** state-driven primary CTA, explicit expiry, running polling, unknown-outcome reconciliation, and login/reload recovery.
4. **Asset review:** durable private previews, approve/reject/note, refresh expired access, and project-level completion summary.
5. **Responsive/accessibility pass:** mobile step layout, sticky CTA, keyboard/focus behavior, semantic labels, contrast, and reduced technical noise.

## Audit conclusion

Do not broadly reskin the current studio. First cut the production workflow over to durable authority, then simplify around the state machine above. The visual redesign should follow—not precede—the removal of competing browser/local production truth.

## Deterministic V2 UX Architecture Addendum

The earlier order is superseded where it implied Artwork carries Product context. The target owner flow is:

```text
1 Artwork   [Approved reusable Artwork V1]
2 Product   [Shopify Products | Manual Products]
3 Variant   [Black · L · available] (when applicable)
4 Model     [Approved Brand Model · Lock v3]
5 Placement [Front center · calibration required/ready]
6 Shot      [Studio front · one asset]

REVIEW EXACT INPUTS
Artwork  checksum/version
Product  authority/product/variant/reference-package version
Model    identity lock/package
Surface  region + calibration status
Shot     scene/pose/lighting
Mode     Deterministic Composite
Cost     Stage A maximum; Stage B local/no provider cost

[Prepare & estimate] -> [Confirm one base generation]
-> Generate base -> Composite original Artwork -> Review asset
```

Artwork upload/approval must not ask for a Product. Product management must not ask for Artwork. Placement is its own explicit step and cannot be hidden in prompt text. If Product/shot geometry is unknown, the primary CTA becomes **Calibrate print area**, not Generate. Advanced details contain checksums, transform matrix, provider request ID, stage attempts, and reconciliation state.

Implementation remains specification-only: no broad visual redesign was applied in this milestone.

## Implementation checkpoint — 2026-08-17

Implemented from this audit: German production labels, production-vs-draft distinction, progressive V2 stepper, top-level Artwork/Product/Model/shot selection summary, visual four-corner placement, owner review/cost card, persistent stage loading, hidden fingerprints/diagnostics, separate previous runs, and laptop reflow/page scrolling. Broad legacy queue and inspector simplification is partial; the remaining older V1/technical panels are secondary and need a later dedicated cleanup.
