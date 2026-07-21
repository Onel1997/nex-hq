/**
 * Controlled candidate identities for Phase 1.6B discovery casting.
 *
 * Stage A = casting studio for face / presence / identity / streetwear credibility.
 * Campaign locations and social scenes belong in Image Studio — not here.
 *
 * Each slot is a DIFFERENT real adult person (≈23–28) within shared brand DNA.
 * No shared Mediterranean face recipe across the cast.
 * Candidate 4 must never read as Candidate 1 with darker skin.
 */

export interface CandidateVariationProfile {
  id: string;
  label: string;
  style: string;
  /** Unique biological + social identity seed for THIS candidate only. */
  identityDescriptor: string;
  /** Distinct face geometry key — must differ across the cast. */
  faceGeometry: string;
  jawShape: string;
  chinShape: string;
  eyeShape: string;
  eyeSpacing: string;
  noseShape: string;
  lipShape: string;
  skinTone: string;
  hairTexture: string;
  haircut: string;
  facialHair: string;
  bodyBuild: string;
  shoulderProfile: string;
  socialPresence: string;
  stylingDirection: string;
  /** @deprecated Prefer faceGeometry — kept for provider distinguishing_features. */
  faceStructure: string;
  /** @deprecated Prefer jawShape. */
  jawline: string;
  cheekbones: string;
  /** @deprecated Prefer noseShape. */
  nose: string;
  /** Combined hairTexture + haircut for prompts / fingerprints. */
  hair: string;
  /** @deprecated Prefer facialHair. */
  stubble: string;
  /** @deprecated Prefer bodyBuild. */
  body: string;
  posture: string;
  expression: string;
  /** @deprecated Prefer socialPresence. */
  presence: string;
  wardrobe: string;
  lighting: string;
  background: string;
  aesthetic: string;
  /** Short lines injected into the candidate direction block. */
  promptLines: string[];
}

/**
 * Four distinct Phase 1.6B discovery casting identities.
 * Camera consistency applies ONLY within one candidate's Stage-A angles.
 */
export const CANDIDATE_VARIATION_PROFILES: readonly CandidateVariationProfile[] = [
  {
    id: "relaxed_mediterranean",
    label: "Relaxed Mediterranean",
    style: "relaxed mediterranean",
    identityDescriptor:
      "Unique adult male identity A — Relaxed Mediterranean discovery face: warm South-European / Mediterranean-European man ≈24–28, approachable masculine presence — not corporate, not aggressive, not Candidates 2–4.",
    faceGeometry:
      "balanced oval-rectangle face with soft everyday masculine planes and slight natural asymmetry",
    jawShape: "softly defined approachable jawline — never razor-sharp fashion geometry",
    chinShape: "rounded-moderate chin, natural width, no sharp fashion point",
    eyeShape: "relaxed almond eyes with soft lids and calm friendly gaze — never hard or narrowed",
    eyeSpacing: "average natural eye spacing, open and calm",
    noseShape: "medium straight natural bridge with a soft tip — everyday proportions",
    lipShape: "natural medium lips with soft definition, calm closed mouth",
    skinTone:
      "warm light-medium olive, lightly sun-kissed, visible subtle pores and real light under-eye detail",
    hairTexture: "straight-to-wavy dark brown with natural density and texture",
    haircut: "natural textured crop with modern soft taper — lived-in, not overstyled",
    facialHair: "soft 2–3 day natural stubble, uneven real density — not over-groomed",
    bodyBuild: "lean-normal everyday frame, natural proportions, not gym-sculpted",
    shoulderProfile: "natural medium shoulders, relaxed not squared military",
    socialPresence:
      "warm quiet confidence — casually memorable Brand Face people would follow on Instagram and TikTok",
    stylingDirection: "approachable premium basics — high quality without looking overstyled",
    faceStructure:
      "balanced oval-rectangle face with soft everyday masculine planes and slight natural asymmetry",
    jawline: "softly defined approachable jawline — never razor-sharp fashion geometry",
    cheekbones: "natural medium cheekbones with healthy facial volume, never hollowed",
    nose: "medium straight natural bridge with a soft tip — everyday proportions",
    hair: "straight-to-wavy dark brown natural textured crop with modern soft taper",
    stubble: "soft 2–3 day natural stubble, uneven real density — not over-groomed",
    body: "lean-normal everyday frame, natural proportions, not gym-sculpted",
    posture:
      "relaxed shoulders slightly eased, soft natural stance, chin neutral — casting-ready but not stiff",
    expression:
      "soft neutral to lightly friendly expression, relaxed eyes, calm mouth — no forced smile, no scowl, no aggressive brows",
    presence:
      "warm quiet confidence — casually memorable Brand Face people would follow on Instagram and TikTok",
    wardrobe:
      "washed black or charcoal premium oversized tee, relaxed streetwear fit, no logos",
    lighting: "soft natural daylight, diffused and warm, realistic skin tones, mild natural shadows",
    background: "controlled discovery casting set — warm grey plaster wall, neutral and quiet",
    aesthetic: "relaxed mediterranean discovery casting — approachable European Brand Face energy",
    promptLines: [
      "Discovery casting: Relaxed Mediterranean — a DIFFERENT biological person from Candidates 2–4.",
      "Frame: chest-up / waist-up useful for casting judgment — soft daylight, calm mouth, friendly/neutral eyes.",
      "Age feel ≈24–28. Warm light-medium olive. Natural textured crop. Soft stubble. Approachable masculine face.",
      "Wardrobe: washed black or charcoal premium oversized tee.",
      "Avoid: corporate energy, aggressive brows, mugshot, passport photo, CEO look, fashion-model stare.",
    ],
  },
  {
    id: "modern_creator",
    label: "Modern Creator",
    style: "modern creator",
    identityDescriptor:
      "Unique adult male identity B — Modern Creator discovery face: younger creative mixed-Mediterranean / warm medium-olive-to-brown urban man ≈23–27 with a softly elongated creative silhouette — youthful adult NOT teenage, fully distinct from Candidate 1.",
    faceGeometry:
      "softly elongated oval with gentle creative transitions and healthy youthful-adult volume — never harsh, never underweight-looking",
    jawShape: "slimmer gently defined jaw with lighter bone mass than Candidate 1 — soft, not sharp",
    chinShape: "narrower softer chin, slightly tapered, never square or pointed",
    eyeShape: "larger expressive open eyes, curious and approachable, brows fully relaxed",
    eyeSpacing: "slightly wider open eye spacing for expressive social presence",
    noseShape: "narrower soft bridge with a subtly rounded tip — different profile from Candidate 1",
    lipShape: "fuller natural lower lip, soft modern mouth shape, calm closed lips",
    skinTone:
      "medium olive to medium brown with natural undertones, realistic pores, subtle complexion variation",
    hairTexture: "natural soft curls / textured coil-wave top",
    haircut: "natural curls or textured top with clean low taper — intentionally undone creator cut",
    facialHair: "very light uneven stubble or nearly clean-shaven casual creator look",
    bodyBuild: "healthy slim-lean frame with natural proportions — never underweight, never hollow",
    shoulderProfile: "natural soft-casual shoulder line — lighter than Candidate 3, never frail",
    socialPresence:
      "friendly confidence — contemporary social presence, followable creator charisma",
    stylingDirection: "slightly more fashion-aware streetwear, still never high fashion",
    faceStructure:
      "softly elongated oval with gentle creative transitions and healthy youthful-adult volume — never harsh, never underweight-looking",
    jawline: "slimmer gently defined jaw with lighter bone mass than Candidate 1 — soft, not sharp",
    cheekbones: "subtle mid cheekbones with healthy volume — without hollow fashion drama",
    nose: "narrower soft bridge with a subtly rounded tip — different profile from Candidate 1",
    hair: "natural soft curls or textured top with clean low taper",
    stubble: "very light uneven stubble or nearly clean-shaven casual creator look",
    body: "healthy slim-lean frame with natural proportions — never underweight, never hollow",
    posture:
      "weight gently shifted, one arm loosely relaxed, natural creator stance — never rigid",
    expression:
      "relaxed friendly eyes with soft interest in the camera — calm mouth, never harsh or hostile",
    presence:
      "friendly confidence — contemporary social presence, followable creator charisma",
    wardrobe:
      "black zip hoodie worn open over a dark heavyweight tee, or black heavyweight tee alone — relaxed creator fit, no logos",
    lighting: "diffused window daylight, soft shadows, realistic skin, no beauty lighting",
    background: "controlled discovery casting set — muted charcoal studio wall, quiet and neutral",
    aesthetic: "modern creator discovery casting — social-first premium streetwear Brand Face",
    promptLines: [
      "Discovery casting: Modern Creator — a DIFFERENT person from Candidates 1, 3, and 4.",
      "Frame: chest-up / waist-up useful for casting — soft daylight, calm mouth, friendly/neutral eyes.",
      "Age feel ≈23–27 youthful adult NOT teenage. Medium olive/brown. Natural curls or textured top. Friendly confidence.",
      "Wardrobe: black zip hoodie or heavyweight tee.",
      "Avoid: overly narrow/harsh face, underweight look, mugshot, passport, aggressive brows, CEO look.",
    ],
  },
  {
    id: "clean_street_athletic",
    label: "Clean Street Athletic",
    style: "clean street athletic",
    identityDescriptor:
      "Unique adult male identity C — Clean Street Athletic discovery face: broader-featured medium brown / medium olive man ≈25–28 with lean athletic calm presence — distinct from Candidates 1–2 and 4, never gym-model or police energy.",
    faceGeometry:
      "broader more structured face with stronger planes and a wider forehead — still approachable, never harsh or passport-rigid",
    jawShape: "clearly defined natural jawline with controlled width — strong but not exaggerated military",
    chinShape: "broader firm chin with clean masculine shape, not pointed",
    eyeShape: "deeper-set calmer eyes with soft lids and quiet self-assurance — fully relaxed brows",
    eyeSpacing: "average-to-slightly closer focused spacing, steady calm commercial gaze",
    noseShape: "broader bridge with a more defined tip and different profile from Candidates 1–2",
    lipShape: "straighter firmer lip line with natural masculine thickness, calm closed mouth",
    skinTone:
      "medium brown to medium olive with warm undertones, real texture, mild natural shadow under eyes",
    hairTexture: "dense straight-to-low-wave dark hair OR soft short-curl density",
    haircut: "clean crop or short curls with soft taper — precise but never military buzz",
    facialHair: "clean light even short stubble, premium but unfussy — never full security-guard beard",
    bodyBuild: "lean athletic with natural muscle tone — never gym-model bulk, never bodybuilder",
    shoulderProfile: "good natural athletic shoulder line, open and relaxed — not squared for force",
    socialPresence:
      "quiet clean street confidence — premium streetwear credibility without authority energy",
    stylingDirection: "elevated tonal streetwear basics — premium without luxury-realtor energy",
    faceStructure:
      "broader more structured face with stronger planes and a wider forehead — still approachable, never harsh or passport-rigid",
    jawline: "clearly defined natural jawline with controlled width — strong but not exaggerated military",
    cheekbones: "lower wider cheekbones with healthy firmness — never hollowed editorial",
    nose: "broader bridge with a more defined tip and different profile from Candidates 1–2",
    hair: "dense dark clean crop or short curls with soft taper",
    stubble: "clean light even short stubble, premium but unfussy — never full security-guard beard",
    body: "lean athletic with natural muscle tone — never gym-model bulk, never bodybuilder",
    posture:
      "open relaxed chest, loose arms, balanced weight — calm camera presence, no military stance",
    expression:
      "calm expression, soft neutral gaze, relaxed brows — never arrogant, never forceful, never passport-blank",
    presence:
      "quiet clean street confidence — premium streetwear credibility without authority energy",
    wardrobe: "heavyweight washed tee in charcoal or slate, clean tonal streetwear fit, no logos",
    lighting: "subtle studio softbox mixed with soft daylight, realistic tones, no dramatic fashion light",
    background: "controlled discovery casting set — soft concrete wall, neutral premium quiet",
    aesthetic: "clean street athletic discovery casting — lean athletic Brand Face, never gym-model or authority vibe",
    promptLines: [
      "Discovery casting: Clean Street Athletic — a DIFFERENT person from Candidates 1, 2, and 4.",
      "Frame: chest-up / waist-up useful for casting — soft daylight, calm mouth, friendly/neutral eyes.",
      "Age feel ≈25–28. Medium brown/olive. Lean athletic NOT gym-model. Clean crop or short curls. Calm expression.",
      "Wardrobe: heavyweight washed tee.",
      "Avoid: police, military, passport photo, mugshot, aggressive brows, CEO look, bodybuilder.",
    ],
  },
  {
    id: "weekend_community",
    label: "Weekend Community",
    style: "weekend community",
    identityDescriptor:
      "Unique adult male identity D — Weekend Community discovery face: Afro-European / mixed-heritage man ≈24–28 with soft dark-skin warmth and a clearly different ethnic visual direction from Candidates 1–3 — not Candidate 1 with darker skin. Preserve the successful calm community Candidate #4 character.",
    faceGeometry:
      "softer rounded facial planes with gentler transitions and a wider friendly midface — distinct geometry from Candidates 1–3",
    jawShape: "soft rounded jaw with low angularity — completely different from Candidate 3 structure",
    chinShape: "soft rounded chin with gentle width, never sharp",
    eyeShape: "softly rounded warm eyes with open lids and kind calm expression",
    eyeSpacing: "wider friendly eye spacing supporting open community energy",
    noseShape: "broader softer nose with a rounded tip and flatter bridge than Candidates 1–3",
    lipShape: "fuller natural lips with soft volume and warm shape, calm relaxed mouth",
    skinTone:
      "rich deep brown / dark skin with warm undertones, realistic complexion variation, natural pores, subtle under-eye detail",
    hairTexture: "tight natural coils / soft afro-curl texture",
    haircut: "coils, short twists, or clean natural texture with soft shape-up — never the same crop as Candidates 1–3",
    facialHair: "clean-shaven or extremely light soft facial hair only",
    bodyBuild: "lean-normal relaxed frame with easy weekend proportions — softer than Candidate 3 athletic line",
    shoulderProfile: "soft natural shoulders, easy relaxed line",
    socialPresence:
      "strongest community energy — relaxed, approachable, accessible weekend lifestyle Brand Face",
    stylingDirection: "soft minimal streetwear — light tonal heavyweight basics, never overstyled",
    faceStructure:
      "softer rounded facial planes with gentler transitions and a wider friendly midface — distinct geometry from Candidates 1–3",
    jawline: "soft rounded jaw with low angularity — completely different from Candidate 3 structure",
    cheekbones: "softer mid cheek volume with warm facial fullness — never hollow",
    nose: "broader softer nose with a rounded tip and flatter bridge than Candidates 1–3",
    hair: "tight natural coils in short twists or clean natural texture with soft shape-up",
    stubble: "clean-shaven or extremely light soft facial hair only",
    body: "lean-normal relaxed frame with easy weekend proportions — softer than Candidate 3 athletic line",
    posture:
      "very loose easy stance, soft shoulders, natural arms — weekend calm, no model posing",
    expression:
      "easy warmth in the eyes, soft neutral-friendly mouth, understated cool — never blank mugshot, never passport stare",
    presence:
      "strongest community energy — relaxed, approachable, accessible weekend lifestyle Brand Face",
    wardrobe:
      "off-white or muted grey heavyweight streetwear tee or hoodie, relaxed weekend fit, no logos",
    lighting: "soft airy natural daylight, gentle premium clarity, realistic dark-skin rendering",
    background: "controlled discovery casting set — off-white daylight studio wall",
    aesthetic: "weekend community discovery casting — soft community lifestyle Brand Face",
    promptLines: [
      "Discovery casting: Weekend Community — a DIFFERENT ethnic and biological person from Candidates 1–3.",
      "Frame: chest-up / waist-up useful for casting — soft daylight, calm mouth, friendly/neutral eyes.",
      "Age feel ≈24–28. Deep brown skin. Soft natural facial geometry. Coils, short twists, or clean natural texture. Strongest community energy.",
      "Wardrobe: off-white or muted grey heavyweight streetwear.",
      "Avoid: Candidate 1 with darker skin, identical crop/jaw/body, mugshot, passport, aggressive brows, CEO look.",
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
    profile.faceGeometry,
    profile.jawShape,
    profile.chinShape,
    profile.eyeShape,
    profile.eyeSpacing,
    profile.noseShape,
    profile.lipShape,
    profile.skinTone,
    profile.hairTexture,
    profile.haircut,
    profile.facialHair,
    profile.bodyBuild,
    profile.shoulderProfile,
    profile.wardrobe,
    profile.background,
    profile.aesthetic,
  ].join("|");
}
