# Video Production Pipeline V1

Migration status: `20260818003000_video_studio_foundation_v1.sql` and `20260818160000_persona_video_readiness_v1.sql` **APPLIED** 2026-08-18 to `lggogmvpktedkimbpzix`. Live Video schema and Persona Video authority columns/RPCs verified. Manual Video identity review and Video Use approval remain pending.

## Production boundary

Approved Video Brand Model + exact Product Profile/variant/references + approved Artwork + approved deterministic Image asset + structured direction → one confirmed Video job → one provider attempt → one private output → human review.

## Strategy comparison

| Strategy | Continuity | Artwork fidelity | V1 decision |
|---|---|---|---|
| Text-to-video | Weak; recreates all domains | Uncontrolled | Draft only/future |
| Approved Image → video | Strongest available starting truth | Not guaranteed after motion | Production foundation |
| Product/reference-conditioned video | May improve garment | Provider-dependent, unverified | Adapter capability later |
| Base video + deterministic frame Artwork | Potentially exact | Requires tracking, deformation and occlusion | Future production milestone |

## Safety states

`awaiting_confirmation → confirmed → running → succeeded` is the only happy path. Atomic claim requires matching fingerprint, confirmed actor/time, and unexpired 30-minute authorization. Ambiguous accepted execution becomes `unknown_outcome`; it cannot be claimed again. One job has one unique output.

## Fake proof

The deterministic fake adapter writes a private JSON metadata fixture through the same job/asset orchestration seam. It validates confirmation, atomic claim, one-attempt behavior, persistence, reload, previous-run separation and review. It does not generate pixels, frames, audio or provider evidence.

## Persona Video authority

Video execution consumes only current-lock-bound Persona authority:

`Identity Lock + exact reference package + rights + approved human Video identity review + explicit Video Use approval`.

Image approval and Brand Cast never substitute. The handoff carries the exact lock snapshot/version/fingerprint and is re-evaluated when selected; a stale review or approval cannot pass. The owner must complete both Persona actions manually before any Video workflow can proceed.

## Recovery rule update — 2026-08-19

Terminal reviewed jobs must never redefine the next active run after reload. Owner changes to motion/camera/scene/lighting/format/duration invalidate and cancel only unexecuted confirmation state. Running or unknown-outcome jobs remain fail-closed; no blind retry or automatic next Video exists.
