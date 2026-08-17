# AI Providers

Status: Canonical Current-State Integration Note  
Last verified against code: 2026-08-17

## General Rule

Provider adapters execute capabilities; they do not own Persona identity, Design approval, product truth, campaign approval, or asset review. A configured key/adapter does not authorize a paid call. Fake providers are used for safety tests.

## Image Planning

`POST /api/image/run` now creates a deterministic owner-reviewable shot plan and Brain report without calling OpenAI, FAL, Replicate, or any other paid provider. Exact Persona, artwork, product, shot, provider, and model inputs are frozen later at paid-job preparation. This prevents an unconfirmed planning click from incurring paid LLM cost.

The older agentic Image planner remains available as internal code but is no longer invoked by the production route.

## OpenAI Image Preparation

The provider-neutral request contains four separate domains:

1. **WHO:** the exact Persona Master Identity Reference and immutable Brand Model lock/package trace;
2. **WHAT THEY WEAR:** exact bytes from the approved Design-owned Master Artwork version/checksum;
3. **PRODUCT:** typed product/variant authority, garment type, color, size, material, fit, collection, and availability where known; and
4. **HOW / WHERE:** the selected durable shot title, scene, lighting, pose, placement, and campaign direction.

The OpenAI adapter converts that domain request to `openai.images.edit`, `gpt-image-1`, high input fidelity, Persona Master first and Master Artwork second. Its deterministic prompt says to preserve identity while allowing pose/scene change, makes garment construction/fit/material explicit where known, states placement, and forbids redesigning, restyling, rewriting, adding, removing, or replacing artwork. When no exact Shopify variant exists, it explicitly forbids pretending one is known.

The five canonical Persona support references remain governed evidence and provenance; they are not randomly substituted as WHO. The text-only Flux/Replicate path rejects Brand Model-conditioned execution rather than dropping identity.

## Private Inputs and Provenance

Server services authorize workspace/owner, resolve durable authority, validate storage scope/MIME/size/checksum, and transiently download Persona Master and Design artwork bytes. Browser-supplied private paths, signed URLs, or alternative Persona bytes are rejected.

Generated provenance records project/shot/job/fingerprint, provider/model/request ID, exact Persona lock/package, artwork ID/version/checksum, typed product context, timestamps, and storage path. It does not persist private input bytes, service credentials, or temporary signed URLs.

## Paid Execution Safety

**IMPLEMENTED IN CODE / REQUIRES TWO UNAPPLIED MIGRATIONS AND CONTROLLED RUNTIME VERIFICATION.**

The durable job flow provides exact-input SHA-256 fingerprinting, conservative cost estimate, 30-minute owner confirmation, atomic database claim, duplicate suppression, known-safe pre-provider retry, `UNKNOWN_OUTCOME` quarantine, provider request IDs, cancellation of unexecuted jobs, and reload listing/polling. Execution also requires `NEXHQ_IMAGE_PAID_GENERATION_ENABLED=true`; that flag alone grants nothing.

No paid provider was called and the paid flag was not enabled during this mission.
