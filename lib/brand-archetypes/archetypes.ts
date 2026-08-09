import { finalizeIdentityDna } from "./identity-dna";
import type {
  BrandArchetype,
  BrandArchetypeCatalog,
  BrandFaceMemory,
  IdentityDna,
} from "./types";

const SEED_AT = "2026-07-21T00:00:00.000Z";
const WORKSPACE_ID = "ws-milaene";

const DNA_MEDITERRANEAN = finalizeIdentityDna({
  id: "dna-mediterranean-premium-hero",
  archetypeId: "arch-mediterranean-premium-hero",
  version: "1.0.0",
  appearance: {
    faceGeometryFamily:
      "youthful soft masculine Mediterranean harmony — slot-specific geometry families (A soft oval/slight rectangle · B narrower elongated · C wider-upper softer-lower · D balanced narrow-to-medium subtle angular) — mild natural asymmetry — naturally handsome not striking",
    proportions: "natural adult male proportions, lean athletic frame — never bodybuilder",
    eyeFeeling: "relaxed open eyes, soft lids, calm friendly gaze — approachable neutral warmth — eye shape varies by slot",
    noseFamily: "slot-specific natural nose families — medium Iberian / broader Maghrebi / character Greek / aquiline-leaning Levantine — never one shared nose template",
    lips: "natural medium lips, soft definition, approachable neutral mouth — lip proportions vary by slot",
    jawFamily: "natural medium soft jaw — reduced width and sharpness, softer lower face, reduced chin projection — jaw width differs across A/B/C/D — never oversized, never razor-sharp",
    beardFamily: "clean shave or very light natural stubble only — never dense beard shadow, never full beard",
    skinToneFamily:
      "warm light-medium olive, youthful healthy sun-kissed skin (apparent age ~22–25), visible subtle pores, slight individuality / imperfection — reduce model perfection ~10%",
    hairFamily:
      "cleaner contemporary textured dark streetwear hair with MANDATORY slot diversity — A short textured crop/taper · B very short crop / tight fade · C medium-length relaxed waves (ONLY longer/wavier lane) · D short messy curls / soft taper — never four identical wavy medium lengths",
  },
  presence: {
    confidence: "quiet youthful confidence — effortless, never overbearing",
    approachability: "very high — customers think he looks good in the outfit and naturally belongs in Milaene",
    calmness: "calm friendly commercial streetwear presence — youthful and effortless",
    communityFeeling: "premium modern streetwear community credible — easy to identify with",
    luxuryFeeling: "understated premium — never CEO, perfume-campaign, rugged hero, or Dolce & Gabbana luxury",
    authenticity: "high authentic Mediterranean warmth — clean, young, modern, soft masculine",
    socialEnergy: "“He looks good in that outfit” / “I want to dress like him” — not extremely masculine/model face",
  },
  movement: {
    posture: "relaxed upright with soft natural stance",
    shoulderPosition: "natural medium shoulders, relaxed not squared",
    naturalAsymmetry: "allow mild natural facial and posture asymmetry",
    bodyEnergy: "effortless calm — casting-ready, wearable in oversized clothing",
  },
  photography: {
    framingPreference: "head-and-shoulders to half-body casting frames",
    cameraEnergy: "soft eye contact, warmer commercial camera presence",
    expressionFamily: "warmer calm — quiet confidence with effortless smile potential, no forced smile, no scowl, no intimidation",
    editorialRestraint: "soft natural daylight commercial polish — no fashion-week severity, no dramatic facial shadows, no cinematic grade",
  },
  lifestyle: {
    fashionDirection:
      "premium oversized streetwear basics — washed black / charcoal / off-white — Zara Studio / ESSENTIALS / ALD / COS / Our Legacy / ARKET vibe",
    socialBehavior: "effortlessly stylish, approachable, memorable European lifestyle presence",
    communityRole: "primary premium streetwear Brand Face for homepage and campaign drops",
    campaignRole: "Homepage / Shopify / Premium Streetwear Drop Hero",
  },
});

const DNA_URBAN = finalizeIdentityDna({
  id: "dna-urban-community-hero",
  archetypeId: "arch-urban-community-hero",
  version: "1.0.0",
  appearance: {
    faceGeometryFamily:
      "softer rounded facial planes with wider friendly midface — distinct from Mediterranean hero",
    proportions: "lean-normal relaxed weekend proportions",
    eyeFeeling: "softly rounded warm eyes, open lids, kind calm expression",
    noseFamily: "broader softer nose with rounded tip",
    lips: "fuller natural lips with soft volume, calm relaxed mouth",
    jawFamily: "soft rounded jaw with low angularity",
    beardFamily: "clean-shaven or extremely light soft facial hair only",
    skinToneFamily:
      "rich deep brown / dark skin with warm undertones, realistic complexion variation",
    hairFamily:
      "tight natural coils / soft afro-curl — coils, short twists, or clean natural texture",
  },
  presence: {
    confidence: "relaxed community confidence",
    approachability: "very high — accessible weekend Brand Face",
    calmness: "easy calm streetwear energy",
    communityFeeling: "strongest community-driven presence",
    luxuryFeeling: "everyday premium — never luxury rapper glamour",
    authenticity: "natural authentic streetwear authenticity",
    socialEnergy: "TikTok / Instagram community hero energy",
  },
  movement: {
    posture: "very loose easy stance",
    shoulderPosition: "soft natural shoulders, easy relaxed line",
    naturalAsymmetry: "natural friendly asymmetry welcome",
    bodyEnergy: "weekend calm — no model posing, never aggressive",
  },
  photography: {
    framingPreference: "chest-up / waist-up community casting frames",
    cameraEnergy: "warm approachable camera presence",
    expressionFamily: "easy warmth in the eyes, soft neutral-friendly mouth",
    editorialRestraint: "natural documentary-soft — never overstyled glam casting",
  },
  lifestyle: {
    fashionDirection: "relaxed heavyweight hoodie / zip hoodie / tee streetwear",
    socialBehavior: "community-driven, friendly, approachable",
    communityRole: "Urban Community Hero for social and lifestyle",
    campaignRole: "Instagram / TikTok / Community Lifestyle Hero",
  },
});

const DNA_FEMALE = finalizeIdentityDna({
  id: "dna-female-lifestyle-hero",
  archetypeId: "arch-female-lifestyle-hero",
  version: "1.0.0",
  appearance: {
    faceGeometryFamily:
      "soft natural feminine facial planes with healthy volume and gentle symmetry",
    proportions: "natural feminine adult proportions, lean-soft lifestyle frame",
    eyeFeeling: "warm open eyes with soft approachable gaze",
    noseFamily: "natural soft feminine nose family — everyday proportions",
    lips: "natural soft lips, light definition, minimal makeup reading",
    jawFamily: "soft feminine jawline — never sharp high-fashion contour",
    beardFamily: "none",
    skinToneFamily:
      "natural healthy skin with realistic texture — not porcelain beauty retouch",
    hairFamily:
      "natural hair with soft lived-in texture — not heavy glam styling",
  },
  presence: {
    confidence: "warm quiet confidence",
    approachability: "high — friendly commercial lifestyle presence",
    calmness: "calm warm presence",
    communityFeeling: "lifestyle community and couple-campaign friendly",
    luxuryFeeling: "premium oversized fashion — never heavy glamour luxury beauty",
    authenticity: "natural beauty authenticity",
    socialEnergy: "Pinterest / email / lifestyle social energy",
  },
  movement: {
    posture: "relaxed natural upright with soft ease",
    shoulderPosition: "soft natural shoulders",
    naturalAsymmetry: "natural mild asymmetry — authentic not perfected",
    bodyEnergy: "warm commercial lifestyle energy",
  },
  photography: {
    framingPreference: "portrait to half-body lifestyle casting frames",
    cameraEnergy: "warm friendly commercial camera presence",
    expressionFamily: "soft friendly to calm warm — never catwalk severity",
    editorialRestraint: "commercial lifestyle polish — not beauty-campaign glamour",
  },
  lifestyle: {
    fashionDirection: "premium oversized hoodie / lifestyle tee — minimal glam",
    socialBehavior: "warm friendly authentic lifestyle behavior",
    communityRole: "Female Lifestyle Hero for couple / social / email",
    campaignRole: "Lifestyle / Couple / Pinterest / Email Hero",
  },
});

function emptyBrandFaceMemory(archetypeId: string): BrandFaceMemory {
  return {
    archetypeId,
    currentActiveFaceId: null,
    approvedBrandFaceIds: [],
    brandFaceHistoryIds: [],
    retiredFaceIds: [],
    identityLockVersion: null,
    /** Phase 1.8 — registry starts empty; filled on Official Brand Face approval. */
    brandFaceVersion: "1.8.0",
  };
}

const ARCH_MEDITERRANEAN: BrandArchetype = {
  id: "arch-mediterranean-premium-hero",
  slug: "mediterranean-premium-hero",
  name: "Mediterranean Premium Hero",
  workspaceId: WORKSPACE_ID,
  status: "active",
  genderPresentation: "Male",
  ageRange: "22-25",
  ethnicityDirection: "European / Mediterranean",
  bodyDirection:
    "lean athletic — not muscular, not bodybuilder — normal healthy proportions wearable in oversized clothing",
  faceDirection:
    "youthful soft masculine Mediterranean harmony (apparent age ~22–25) — soft-masculine commercial streetwear with STRONG A/B/C/D face-geometry diversity (A soft oval/slight rectangle · B narrower elongated · C wider-upper softer-lower · D balanced subtle angular) — natural medium jaw, softer lower face, youthful cheeks, relaxed open eyes, balanced brows — clean, approachable, naturally handsome — Brand Face who looks good in oversized tees, not rugged / not catwalk casting — never four brothers / never Candidate D anatomy template for all slots",
  hairDirection:
    "cleaner contemporary textured dark streetwear hair with MANDATORY silhouette diversity — A short textured crop/short curls/clean taper · B very short crop or tight short curls with fade · C medium-length relaxed waves (ONLY longer/wavier lane) · D short messy curls or soft taper with texture — minimum 3 distinct silhouettes — never all wavy medium-length",
  groomingDirection: "clean shave or very light natural stubble — never full beard, never dense beard shadow",
  personality:
    "Calm, friendly, quietly confident, youthful, effortless, trustworthy — easy to identify with; customers think he looks good in the outfit",
  socialEnergy:
    "“He looks good in that outfit” / “I want to dress like him” — soft masculine commercial streetwear, not extremely masculine/model face",
  commercialRole: "Homepage / Shopify / Campaign / Premium Streetwear Drop Hero",
  wardrobeDirection:
    "Oversized heavyweight tee, premium hoodie, zip hoodie, relaxed trousers — washed black / charcoal / off-white — ESSENTIALS / ALD / Our Legacy / COS / ARKET / Zara Studio vibe",
  photographyDirection:
    "Soft natural daylight commercial streetwear — soft even shadows, real skin — no dramatic facial shadows, no cinematic hero lighting, no perfume lighting",
  cameraDirection: "Soft eye contact, head-and-shoulders to half-body",
  lightingDirection: "Natural daylight, soft even shadows, warm realistic skin",
  communityRole: "Primary premium streetwear Brand Face customers trust and relate to — recurring face of Milaene",
  campaignRole: "Homepage Hero / Campaign Hero / Product Hero",
  productAffinity: [
    {
      productId: "milaene-oversized-heavyweight-tee",
      productType: "oversized heavyweight tee",
      rating: 5,
      reason: "Core homepage and campaign tee silhouette",
    },
    {
      productId: "milaene-heavyweight-hoodie",
      productType: "heavyweight hoodie",
      rating: 5,
      reason: "Flagship premium drop hoodie",
    },
    {
      productId: "milaene-zip-hoodie",
      productType: "zip hoodie",
      rating: 4,
      reason: "Strong campaign layering option",
    },
  ],
  strengths: [
    "Homepage hero credibility",
    "Premium European authenticity",
    "Friendly not intimidating",
    "Shopify / luxury drop readiness",
  ],
  avoid: [
    "CEO portrait",
    "Runway fashion week",
    "Corporate headshot",
    "Intimidating stare",
    "Hyper masculine / square oversized jaw / extremely sharp jawline",
    "Perfume campaign / movie hero / Dolce & Gabbana drama",
    "High-fashion editorial intensity / unreal fashion model / luxury catwalk casting",
    "Heavy beard / dense beard shadow / rugged Mediterranean hero / alpha-male",
    "Bodybuilder / visually 27+ / mature 30+ appearance",
    "Looking older than 26",
  ],
  roles: [
    "homepage_hero",
    "campaign_hero",
    "product_hero",
    "newsletter_hero",
    "ads_hero",
  ],
  platformScores: {
    homepage: 98,
    shopify: 96,
    campaign: 95,
    newsletter: 95,
    email: 93,
    instagram: 91,
    tiktok: 88,
    ads: 94,
    lifestyle: 90,
  },
  purpose: ["Homepage", "Shopify", "Campaigns", "Luxury Drops"],
  bestPlatforms: ["homepage", "shopify", "campaign", "newsletter", "instagram"],
  identityDnaId: DNA_MEDITERRANEAN.id,
  version: "1.0.0",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
};

const ARCH_URBAN: BrandArchetype = {
  id: "arch-urban-community-hero",
  slug: "urban-community-hero",
  name: "Urban Community Hero",
  workspaceId: WORKSPACE_ID,
  status: "active",
  genderPresentation: "Male",
  ageRange: "24-28",
  ethnicityDirection: "Afro-European / dark skin community direction",
  bodyDirection: "lean-normal relaxed weekend frame",
  faceDirection: "soft friendly community face — never gangster stereotype",
  hairDirection: "natural coils / twists / clean natural texture",
  groomingDirection: "clean-shaven or extremely light facial hair",
  personality: "Natural, relaxed, friendly, approachable, community-driven",
  socialEnergy: "Strongest TikTok / Instagram community energy",
  commercialRole: "Community / Social / Lifestyle Hero",
  wardrobeDirection: "Heavyweight hoodie, zip hoodie, relaxed tee",
  photographyDirection: "Natural soft daylight community casting",
  cameraDirection: "Warm approachable chest-up frames",
  lightingDirection: "Soft airy daylight, realistic dark-skin rendering",
  communityRole: "Primary community hero",
  campaignRole: "Community Hero / Social Hero / Lifestyle Hero",
  productAffinity: [
    {
      productId: "milaene-heavyweight-hoodie",
      productType: "heavyweight hoodie",
      rating: 5,
      reason: "Community lifestyle hero garment",
    },
    {
      productId: "milaene-zip-hoodie",
      productType: "zip hoodie",
      rating: 5,
      reason: "Streetwear social campaign staple",
    },
    {
      productId: "milaene-oversized-heavyweight-tee",
      productType: "oversized heavyweight tee",
      rating: 4,
      reason: "Relaxed community tee option",
    },
  ],
  strengths: [
    "TikTok and community credibility",
    "Approachable dark-skin Brand Face",
    "Natural streetwear authenticity",
  ],
  avoid: [
    "Aggressive energy",
    "Gangster styling",
    "Luxury rapper glamour",
    "Fashion week intensity",
  ],
  roles: ["community_hero", "social_hero", "lifestyle_hero", "video_hero"],
  platformScores: {
    tiktok: 98,
    community: 99,
    instagram: 96,
    lifestyle: 95,
    youtube: 90,
    homepage: 82,
    shopify: 84,
    campaign: 88,
  },
  purpose: ["Instagram", "TikTok", "Community", "Lifestyle"],
  bestPlatforms: ["tiktok", "community", "instagram", "lifestyle"],
  identityDnaId: DNA_URBAN.id,
  version: "1.0.0",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
};

const ARCH_FEMALE: BrandArchetype = {
  id: "arch-female-lifestyle-hero",
  slug: "female-lifestyle-hero",
  name: "Female Lifestyle Hero",
  workspaceId: WORKSPACE_ID,
  status: "active",
  genderPresentation: "Female",
  ageRange: "23-28",
  ethnicityDirection: "Natural commercial beauty — inclusive lifestyle casting",
  bodyDirection: "natural feminine lean-soft lifestyle frame",
  faceDirection: "natural beauty — minimal makeup reading",
  hairDirection: "natural lived-in hair — not heavy glam",
  groomingDirection: "minimal makeup, authentic commercial grooming",
  personality: "Warm, friendly, authentic, commercial lifestyle",
  socialEnergy: "Pinterest / email / couple / lifestyle social energy",
  commercialRole: "Lifestyle / Couple / Social / Email Hero",
  wardrobeDirection: "Premium oversized hoodie and lifestyle tee",
  photographyDirection: "Warm commercial lifestyle casting",
  cameraDirection: "Portrait to half-body warm friendly frames",
  lightingDirection: "Soft natural daylight — not beauty ring light",
  communityRole: "Lifestyle and couple community presence",
  campaignRole: "Lifestyle Hero / Couple Hero / Newsletter Hero",
  productAffinity: [
    {
      productId: "milaene-heavyweight-hoodie",
      productType: "heavyweight hoodie",
      rating: 5,
      reason: "Premium oversized lifestyle hoodie",
    },
    {
      productId: "milaene-oversized-heavyweight-tee",
      productType: "oversized heavyweight tee",
      rating: 5,
      reason: "Lifestyle tee for social and email",
    },
    {
      productId: null,
      productType: "couple campaign",
      rating: 5,
      reason: "Couple / lifestyle campaign affinity (role-based, not a SKU)",
    },
  ],
  strengths: [
    "Pinterest and email lifestyle strength",
    "Natural beauty commercial readiness",
    "Couple campaign flexibility",
  ],
  avoid: [
    "Fashion runway",
    "Heavy glamour",
    "Luxury beauty campaign intensity",
  ],
  roles: [
    "lifestyle_hero",
    "couple_hero",
    "social_hero",
    "newsletter_hero",
    "campaign_hero",
  ],
  platformScores: {
    pinterest: 99,
    email: 95,
    lifestyle: 98,
    newsletter: 96,
    instagram: 92,
    community: 90,
    homepage: 85,
    campaign: 91,
  },
  purpose: ["Lifestyle", "Couple", "Social", "Campaign", "Pinterest", "Email"],
  bestPlatforms: ["pinterest", "email", "lifestyle", "newsletter", "instagram"],
  identityDnaId: DNA_FEMALE.id,
  version: "1.0.0",
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
};

export const MILAENE_IDENTITY_DNA: IdentityDna[] = [
  DNA_MEDITERRANEAN,
  DNA_URBAN,
  DNA_FEMALE,
];

export const MILAENE_BRAND_ARCHETYPES: BrandArchetype[] = [
  ARCH_MEDITERRANEAN,
  ARCH_URBAN,
  ARCH_FEMALE,
];

export const MILAENE_ARCHETYPE_CATALOG_VERSION = "milaene-archetypes-1.7D.1";

export const MILAENE_BRAND_ARCHETYPE_CATALOG: BrandArchetypeCatalog = {
  brandSlug: "milaene",
  workspaceId: WORKSPACE_ID,
  version: MILAENE_ARCHETYPE_CATALOG_VERSION,
  archetypes: MILAENE_BRAND_ARCHETYPES,
  identityDnaById: Object.fromEntries(
    MILAENE_IDENTITY_DNA.map((d) => [d.id, d]),
  ),
  brandFaceMemoryByArchetypeId: Object.fromEntries(
    MILAENE_BRAND_ARCHETYPES.map((a) => [a.id, emptyBrandFaceMemory(a.id)]),
  ),
  updatedAt: SEED_AT,
};
