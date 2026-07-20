/**
 * Controlled candidate identities for Milaene Premium Streetwear Lifestyle casting.
 * Each slot is a DIFFERENT real adult person within the same brand DNA —
 * not fashion-week clones or style filters on one face.
 */

export interface CandidateVariationProfile {
  id: string;
  label: string;
  style: string;
  /** Unique biological identity seed for THIS candidate only. */
  identityDescriptor: string;
  faceStructure: string;
  jawline: string;
  cheekbones: string;
  eyeShape: string;
  nose: string;
  hair: string;
  stubble: string;
  skinTone: string;
  body: string;
  posture: string;
  expression: string;
  presence: string;
  wardrobe: string;
  lighting: string;
  background: string;
  aesthetic: string;
  /** Short lines injected into the Variation / casting prompt block. */
  promptLines: string[];
}

/**
 * Four distinct Milaene lifestyle identities.
 * Camera consistency applies ONLY within one candidate's three angles.
 */
export const CANDIDATE_VARIATION_PROFILES: readonly CandidateVariationProfile[] = [
  {
    id: "everyday_premium",
    label: "Everyday Premium",
    style: "everyday premium",
    identityDescriptor:
      "Unique adult male identity A — Everyday Premium: a friendly South-European face you would follow on Instagram, not a runway model.",
    faceStructure: "balanced oval face with natural masculine planes, soft everyday proportions",
    jawline: "defined but approachable jawline, not razor-sharp fashion geometry",
    cheekbones: "natural medium cheekbones, healthy facial volume",
    eyeShape: "warm friendly almond eyes, open and relaxed, never angry",
    nose: "straight natural Mediterranean bridge with a soft tip",
    hair: "dark brown textured crop with modern taper, slightly messy, relaxed streetwear styling",
    stubble: "light natural stubble, lived-in not groomed-to-perfection",
    skinTone: "warm light-medium olive, lightly sun-kissed Mediterranean skin, real texture",
    body: "lean everyday athletic build, natural shoulders, not bodybuilder",
    posture: "relaxed shoulders, loose arms, authentic standing, chin neutral",
    expression: "calm friendly confidence, soft eye contact, subtle ease — no smile forced, no scowl",
    presence: "someone who genuinely wears Milaene on a weekday in the city — approachable premium",
    wardrobe: "heavyweight oversized washed black tee with relaxed fit, no logos",
    lighting: "soft warm daylight, clean premium lighting, gentle contrast",
    background: "neutral studio with soft grey concrete wall",
    aesthetic: "everyday premium streetwear lifestyle — Milan / Barcelona street energy",
    promptLines: [
      "Casting role: Everyday Premium — a DIFFERENT person from Candidates 2–4.",
      "Feel: modern, sympathisch, authentic — not a polished fashion model.",
      "Wardrobe: heavyweight oversized tee only, premium streetwear basic.",
      "Vibe: guy you just saw on a street in Milan or Copenhagen.",
    ],
  },
  {
    id: "urban_creator",
    label: "Urban Creator",
    style: "urban creator",
    identityDescriptor:
      "Unique adult male identity B — Urban Creator: a creative community face with softer charm, distinct from Candidate 1.",
    faceStructure: "slightly narrower face with softer transitions, youthful urban creator look",
    jawline: "slimmer defined jaw with a gentler chin",
    cheekbones: "subtle higher cheekbones without hollow fashion drama",
    eyeShape: "larger warmer eyes, curious and approachable, brows relaxed",
    nose: "narrower soft bridge, natural tip",
    hair: "near-black messy crop / natural fade, intentionally undone, not combed flat",
    stubble: "very light uneven stubble, casual creator look",
    skinTone: "warm medium olive with natural undertones, realistic pores",
    body: "slim lean frame, casual posture-friendly proportions",
    posture: "one hand loosely resting, weight shifted, natural creator stance",
    expression: "relaxed half-interest in the camera, friendly cool, never intimidating",
    presence: "Instagram creator energy — community, lifestyle, someone people want to follow",
    wardrobe: "heavyweight charcoal oversized hoodie, minimal streetwear, no logos",
    lighting: "warm daylight near a window, soft shadows, lifestyle campaign feel",
    background: "minimalist urban interior / muted architecture",
    aesthetic: "urban creator lifestyle — premium streetwear community",
    promptLines: [
      "Casting role: Urban Creator — a DIFFERENT person from Candidates 1, 3, and 4.",
      "Feel: cool, approachable, authentic social presence.",
      "Wardrobe: heavyweight hoodie, everyday premium streetwear.",
      "Not fashion week. Not Vogue. Real lifestyle brand face.",
    ],
  },
  {
    id: "modern_street_luxury",
    label: "Modern Street Luxury",
    style: "modern street luxury",
    identityDescriptor:
      "Unique adult male identity C — Modern Street Luxury: stronger Mediterranean features and broader ease, distinct from Candidates 1–2.",
    faceStructure: "broader masculine face with warm Mediterranean volume, still friendly",
    jawline: "strong natural jawline, squared but soft enough to stay approachable",
    cheekbones: "lower wider cheekbones with healthy firmness, not hollowed editorial",
    eyeShape: "steady warm eyes, calm confidence, brows soft — never furrowed",
    nose: "broader Mediterranean bridge, natural profile",
    hair: "short dark textured crop with natural fade, modern streetwear cut",
    stubble: "even light 2-day stubble, premium but unfussy",
    skinTone: "warm medium olive, lightly tanned Mediterranean, never orange",
    body: "lean athletic with slightly broader shoulders, natural not gym-influencer",
    posture: "open relaxed chest, loose arms, authentic confident standing",
    expression: "quiet self-assurance, soft gaze, premium calm — not arrogant",
    presence: "modern premium streetwear lifestyle — luxurious without looking fashion-elite",
    wardrobe: "heavyweight oversized off-black tee or tonal zip hoodie, sweatpants-friendly silhouette cues",
    lighting: "clean warm daylight, premium campaign softness, no dramatic noir",
    background: "brushed concrete / clean urban wall",
    aesthetic: "modern street luxury lifestyle campaign — not luxury runway",
    promptLines: [
      "Casting role: Modern Street Luxury — a DIFFERENT person from Candidates 1, 2, and 4.",
      "Feel: premium, urban, relaxed confidence you believe wears the brand.",
      "Wardrobe: heavyweight tee or zip hoodie, streetwear basics only.",
      "Avoid CEO / business / fashion-week energy completely.",
    ],
  },
  {
    id: "weekend_minimal",
    label: "Weekend Minimal",
    style: "weekend minimal",
    identityDescriptor:
      "Unique adult male identity D — Weekend Minimal: softer South-European warmth and easy weekend ease, distinct from Candidates 1–3.",
    faceStructure: "softer oval face with gentle Mediterranean planes and friendly warmth",
    jawline: "softly defined jawline, rounded chin tip, never harsh",
    cheekbones: "medium cheekbones with warmer facial volume",
    eyeShape: "soft dark eyes, kind and calm, open lids, relaxed brows",
    nose: "softer rounded Mediterranean tip",
    hair: "dark soft messy crop, lightly tousled weekend styling",
    stubble: "soft sparse light stubble, natural weekend look",
    skinTone: "warm light-medium olive, natural weekend tan, real skin texture",
    body: "lean relaxed proportions, easy weekend posture",
    posture: "very loose stance, soft shoulders, natural arms, no model posing",
    expression: "easy calm, slight warmth in the eyes, understated cool",
    presence: "weekend minimal lifestyle — soft premium community energy",
    wardrobe: "heavyweight off-white or light grey oversized tee / sweat set vibe, no logos",
    lighting: "soft daylight, airy and warm, gentle premium clarity",
    background: "soft off-white minimal studio or bright concrete",
    aesthetic: "weekend minimal premium streetwear — Copenhagen calm",
    promptLines: [
      "Casting role: Weekend Minimal — a DIFFERENT person from Candidates 1–3.",
      "Feel: soft, authentic, followable Instagram lifestyle energy.",
      "Wardrobe: heavyweight light oversized tee / sweatwear basic.",
      "Look like a real person on a weekend — never magazine cover energy.",
    ],
  },
] as const;

export function resolveCandidateVariation(
  candidateNumber: number,
): CandidateVariationProfile {
  const index = Math.max(0, candidateNumber - 1) % CANDIDATE_VARIATION_PROFILES.length;
  return CANDIDATE_VARIATION_PROFILES[index]!;
}

/** Fingerprint used for diversity scoring — must differ strongly across candidates. */
export function variationFingerprint(profile: CandidateVariationProfile): string {
  return [
    profile.id,
    profile.identityDescriptor,
    profile.faceStructure,
    profile.jawline,
    profile.cheekbones,
    profile.eyeShape,
    profile.nose,
    profile.hair,
    profile.stubble,
    profile.skinTone,
    profile.body,
    profile.wardrobe,
    profile.aesthetic,
  ].join("|");
}
