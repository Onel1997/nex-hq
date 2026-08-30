# NexHQ Quality Architecture & Production Roadmap

> **Core principle:**
> **LOCKED PERSON + LOCKED PRODUCT + LOCKED ARTWORK + VARIABLE SCENE**

This document defines the long-term quality architecture for NexHQ across Persona Studio, Product Library, Image Studio, and Video Studio.

---

## 1. Core Production Philosophy

NexHQ is not a simple AI image generator.

It is a controlled Fashion Production System.

The immutable production truths are:

- **Person / Persona** = locked identity
- **Product** = locked physical garment truth
- **Artwork** = locked design truth
- **Scene** = variable creative direction
- **Lighting** = variable
- **Camera** = variable
- **Pose** = variable
- **Mood** = variable

No provider may redefine Person, Product, or Artwork.

---

# 2. Persona Studio — Identity Clone Architecture

## 2.1 Master Identity

Each permanent Brand Model starts with one official **Master Identity**.

The Master Identity is the central visual identity reference.

It must not silently change after approval.

---

## 2.2 Identity Pack

Each Brand Model should have a verified Identity Pack containing, where possible:

- Front
- 3/4 Left
- 3/4 Right
- Profile Left
- Profile Right
- Close-up
- Upper Body
- Full Body
- Neutral Expression
- Light Smile
- Even / natural lighting
- Clear unobstructed face

---

## 2.3 Identity Lock

Once approved:

- Persona ID becomes stable
- Identity Pack receives a version
- Master Identity becomes locked
- Discovery candidates cannot silently replace the official person

Example:

`MIL-MALE-01`
`Identity Pack v1`
`LOCKED`

---

## 2.4 Character Plates

Create verified Character Plates from the locked identity.

Useful plates:

- Front portrait
- 3/4 left
- 3/4 right
- Profile
- Full body
- Seated
- Walking / standing
- Shoulder turn
- Neutral studio
- Different common framing distances

Purpose:

Reduce identity drift when scene, camera angle, pose, or clothing changes.

---

## 2.5 Persona Identity Levels

### Level 1 — Reference Identity
Single Master Reference.

### Level 2 — Multi-Reference Identity
Master Identity + Identity Pack + Character Plates.

### Level 3 — Trained Clone
Optional LoRA / trained identity only if Level 2 still drifts significantly under:

- strong side angles
- extreme lighting
- many outfits
- difficult poses
- video motion

LoRA is not the default first solution.

---

# 3. Product Library — Product Master

## 3.1 Product Family

Owner-facing Product Families should stay simple.

Examples:

- Vacancy T-Shirt
- Heavy Oversized Tee
- Hoodie
- Zip Hoodie
- Jogger

Each Product Family may contain:

- Supplier
- Garment Type
- Material
- GSM
- Fit
- Construction
- Colors
- Sizes
- Shopify mapping
- Front / Back references
- Print area calibration

---

## 3.2 Product Truth

Product truth includes:

- physical garment type
- exact color
- fit
- silhouette
- collar
- sleeves
- seams
- material
- GSM
- front/back orientation
- blank references

Shopify remains commerce truth for:

- listing
- product linkage
- variant linkage
- availability
- sizes
- colors
- publishing

The owner should not need to interact with complicated Shopify IDs.

---

## 3.3 Blank Product References

Preferred Stage-A references:

1. Exact color + side blank reference
2. Other exact-color blank references
3. Other verified family blank references
4. Legacy / design-bearing Shopify images only if unavoidable

Artwork must never come from Product references.

---

# 4. MarketPrint Placement Architecture

## 4.1 Green Print-Area Calibration

For each Product Family:

- one Front overlay image
- one Back overlay image

The visible green MarketPrint print area defines the physical printable zone.

The system should automatically detect the green region.

Owner can visually correct it.

---

## 4.2 One Calibration for All Colors

If the physical blank is the same:

**one Front placement + one Back placement applies to all colors.**

Do not force separate calibration for:

- Black
- White
- Beige
- Baby Blue
- etc.

unless geometry truly differs.

---

## 4.3 Owner Placement

In Image Studio:

- choose Product Family
- choose Color
- choose Front / Back
- Artwork appears inside allowed print zone
- owner can drag
- owner can uniformly scale
- center
- reset

Artwork aspect ratio remains locked.

---

# 5. Artwork Master

Artwork authority is always independent from Product.

Store:

- Original PNG
- Checksum
- Display Name
- Version
- Front / Back intent
- Owner X/Y placement
- Uniform scale
- Print bounds
- Artwork colors

No provider may redraw or replace Artwork authority.

---

# 6. Image Studio — Production Architecture

## 6.1 Main Flow

Owner flow should stay simple:

1. Artwork
2. Product Family
3. Color
4. Brand Model
5. Social Content / Shopify Mockups
6. Shot / Content Pack
7. Creative Style
8. Front / Back
9. Artwork placement
10. Prepare / Estimate
11. Generate
12. Review

Technical complexity remains hidden.

---

## 6.2 Content Systems to Preserve

Always preserve:

- Basis-Pack
- Winning Design Expansion
- Eigene Auswahl
- Social Content
- Shopify Mockups
- Creative Presets
- Artwork Library
- Brand Model selection
- Review / history
- one job = one asset

---

# 7. Scene Families — Minimum Creative Standard

Riverflow-style variety is the minimum benchmark.

Required Scene Families include at least:

- Chair / Furniture Styling
- Leather Couch / Premium Interior
- Tennis / Sports Props
- Hanger
- Rack
- Draped Rack
- Folded Product
- Premium Flatlay
- Editorial Product Shot
- Stadium / Model
- Car / Lifestyle
- Clean Studio
- Editorial Studio
- Urban Premium
- Parking Garage
- Minimal Interior
- Premium Interior
- Campaign Hero
- Social Hero / Story
- Detail / Fabric Close-up

The same Product + Artwork must remain recognizable across every scene.

---

# 8. Stage-A Generation

Stage A creates:

- Person
- Product
- Scene
- Lighting
- Camera
- Pose

Stage A must **NOT contain Artwork**.

The garment print area must be:

- blank
- unobstructed
- no foreign print
- no logo
- no text
- no placeholder graphics

Stage A should prioritize:

1. Persona Identity
2. Product Accuracy
3. Scene / Creative Direction

---

# 9. SAM 3 Garment Segmentation

SAM 3 is the garment-mask precision layer.

Purpose:

- detect exact T-shirt pixels
- Hoodie
- Zip Hoodie
- Jogger
- later other garments

SAM does **not** decide:

- Artwork
- placement
- size
- scene
- Product Family

SAM only answers:

> Which pixels belong to the selected garment?

Use the mask for:

- clipping
- print safety
- garment boundaries
- collar/neck exclusion
- registration
- future depth/fold analysis

---

# 10. Garment Registration

MarketPrint placement describes **where the print belongs on the physical garment**.

Generated images have different:

- pose
- crop
- scale
- body curvature
- perspective

Therefore:

**Never map MarketPrint screenshot coordinates directly to generated-image pixels.**

Correct flow:

MarketPrint placement intent
→ Stage-A garment
→ SAM garment mask
→ Garment Registration
→ registered print region

---

# 11. Large Front Print Policy

`FRONT_LARGE` must remain a real large front print.

It must be:

- large
- centered
- below collar
- in the central shirt body
- not downgraded to chest print
- faithful to owner scale and X/Y

Distinct placements:

- LEFT_CHEST_PRINT
- CENTER_CHEST_PRINT
- LARGE_FRONT_PRINT

Never silently convert `LARGE_FRONT_PRINT` into a smaller safe chest print.

If unsafe:

**fail closed.**

---

# 12. Fabric / Surface Rendering

The exact approved Artwork must visually behave like real print.

Goals:

- shirt luminance affects print
- shadows remain visible through print
- subtle folds affect print
- fabric texture remains visible
- body curvature affects print subtly
- print stays inside garment mask
- Artwork content remains exact

No AI repainting of Artwork.

---

# 13. Product Validation

Long-term NexHQ should validate generated assets automatically.

Possible checks:

- Artwork Similarity
- Product Color Accuracy
- Silhouette Accuracy
- Placement Accuracy
- Product Consistency
- Foreign Print Detection
- Garment Mask Safety

Example:

- Artwork similarity: 98%
- Product color: 97%
- Silhouette: 95%
- Placement: 99%

Below threshold:

`REJECT → regenerate`

Do not automatically accept the first output.

---

# 14. Identity Validation

For Brand Model assets, add an Identity Validator.

Possible checks:

- Face similarity
- Hair consistency
- Face proportions
- Skin features
- Eye / nose / lip / jaw relationships
- Overall identity

Example:

- Face Identity: 98%
- Hair Consistency: 97%
- Face Proportions: 99%
- Overall Identity: PASS

If identity drift is too high:

`REJECT → regenerate`

---

# 15. Provider Router

NexHQ should remain provider-agnostic.

Provider choice should depend on the task.

## OpenAI Images

Use for:

- premium scene generation
- strong composition
- Image Studio Stage A
- complex visual generation

## FLUX Kontext / equivalent reference editor

Use for:

- product-preserving editing
- multi-reference editing
- difficult garment/product transformations
- scenes where Product identity must stay strong

## Runway Gen-4 References / equivalent

Use for:

- Character consistency
- object consistency
- multi-reference composition
- creative reference-driven scenes

## SAM 3

Use for:

- garment segmentation
- clothing masks
- exact visible garment boundaries

## Upscaler / Polish

Optional final stage for approved assets.

Use pay-per-image where practical.

Examples may include:

- Magnific
- Topaz
- other high-quality upscale providers

Provider prices must always be re-checked before production decisions.

---

# 16. Cost Philosophy

Prefer:

**Pay-per-image / usage**

Avoid unnecessary monthly subscriptions.

For every provider decision, NexHQ planning should identify:

- Provider
- Model
- Purpose
- Estimated cost per request
- Expected number of attempts
- Maximum estimated cost

---

# 17. Video Studio Architecture

## 17.1 Core Rule

Video must not start from zero.

Preferred pipeline:

Locked Persona
→ approved Image Studio Keyframe
→ Identity Check
→ Image-to-Video
→ short clip
→ Final Cut

---

## 17.2 Keyframes First

Create strong still images first.

Examples:

- Hotel
- Bathroom mirror
- Car
- Café
- Street
- Premium apartment
- Luxury hotel
- Stadium
- Studio

Always use the same locked Persona.

---

## 17.3 Short Video Shots

Generate short clips:

- about 5–8 seconds
- up to around 10 seconds where appropriate

Prefer identity-friendly movement:

- slow head turn
- natural camera movement
- blinking
- subtle facial expression
- slight hair movement
- slow walking
- light body movement

Avoid unnecessary extreme movement when identity consistency matters.

---

## 17.4 Multi-Shot Final Video

Do not generate one long 40-second scene from scratch.

Preferred:

Shot 1
Shot 2
Shot 3
Shot 4
Shot 5

→ edit together

Possible edit tools:

- CapCut
- Premiere
- internal future NexHQ editor

Add:

- music
- sound design
- captions
- voice if needed

---

# 18. Video Provider Strategy

OpenAI should not be assumed to be the only video provider.

For high-consistency Fashion/Lifestyle video, use specialized Image-to-Video providers where stronger.

Provider examples should always be re-evaluated at implementation time.

Potential category:

- Runway
- Kling
- Veo
- other current best provider

NexHQ should route according to:

- identity consistency
- motion quality
- product preservation
- price
- commercial suitability

---

# 19. Video Identity Quality Benchmark

The user-provided reference video is the benchmark for desired identity stability:

- photorealistic person
- multiple angles
- multiple environments
- face stays nearly identical
- no obvious identity replacement between shots

The target pipeline is:

Identity Reference
→ multiple approved still images
→ Image-to-Video
→ shot editing

not:

Text Prompt
→ entire final video

---

# 20. Quality Benchmark

NexHQ Social Content minimum quality is Riverflow-like professional fashion content.

Minimum expectations:

- premium
- modern
- commercially usable
- believable
- consistent Product
- exact Artwork
- stable Brand Model
- diverse scenes
- strong art direction
- no cheap/random environments
- no stereotyped scenes
- no obvious AI artifact look

The benchmark is the minimum, not the final ceiling.

---

# 21. Recommended Build Order

## CURRENT

- Product Family
- MarketPrint calibration
- Artwork placement
- Stage-A provider
- SAM segmentation
- Garment Registration
- Fabric-aware compositing

## NEXT

1. Finish print realism
2. Improve Brand Model identity consistency
3. Build Identity Validator
4. Build Product/Artwork Validator
5. Test multiple Scene Families
6. Build provider routing
7. Produce real Milaene Social Assets
8. Shopify Mockup production
9. Video Studio provider integration
10. Keyframe → Image-to-Video workflow
11. Multi-shot Reel/TikTok assembly

---

# 22. Definition of Success

NexHQ succeeds when the owner can:

1. Upload/select Artwork
2. Select Product Family
3. Select Color
4. Select locked Brand Model
5. Select Social / Shopify asset type
6. Select a Scene Family
7. Position Artwork
8. Generate
9. Receive a result where:
   - Brand Model is correct
   - Product is correct
   - Artwork is correct
   - Placement is correct
   - fabric integration is believable
   - scene is premium
10. Approve or reject
11. Repeat across many scenes without identity/product drift

Final product principle:

## LOCKED PERSON
+
## LOCKED PRODUCT
+
## LOCKED ARTWORK
+
## VARIABLE SCENE
=
## NEXHQ FASHION PRODUCTION SYSTEM

## 2026-08-23 — Print-ready Stage A + real depth evidence

For model-based Product Family `FRONT_LARGE`, Stage A is now governed by `nexhq-print-ready-stage-a-v1`: premium art direction remains, but complete collar-to-lower-torso garment visibility and an unobstructed central print zone are production requirements. `fal-ai/image-preprocessors/depth-anything/v2` is the preferred real relative-depth source. `LOCAL_STAGE_A_RELATIVE_DEPTH_V1` remains explicitly labelled cross-check/fallback evidence and is not represented as equivalent to external depth.
