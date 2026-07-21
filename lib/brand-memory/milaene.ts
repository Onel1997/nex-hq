import type { BrandMemory } from "./types";

/**
 * Canonical Milaene Brand Memory — single source of truth for creative identity.
 * Consolidated from business profile, research DNA, design DNA, and Brain seed.
 */
export const MILAENE_BRAND_MEMORY: BrandMemory = {
  slug: "milaene",
  brandName: "Milaene",
  mission:
    "Milaene is a premium streetwear lifestyle brand for urban creatives who move between culture, art, and the city — built on calm luxury, story, and visual coherence.",
  positioning:
    "Modern premium streetwear lifestyle brand — editorial capsule drops, quiet confidence, supplier-fulfilled POD. Premium-accessible, never fast fashion.",
  targetAudience:
    "Urban creatives aged 18–35 — photographers, musicians, designers, and culture-forward buyers who value authenticity over hype and follow underground before mainstream.",
  productCategories: [
    "Hoodies",
    "T-shirts",
    "Sweatpants",
    "Caps",
    "Capsule drops",
  ],
  allowedProductTypes: [
    "oversized heavyweight tee",
    "boxy tee",
    "oversized hoodie",
    "zip hoodie",
    "relaxed sweatpants",
    "wide-leg cargos",
    "structured cap",
    "premium fleece",
  ],
  forbiddenProductTypes: [
    "skinny fit garments",
    "suits and blazers",
    "dress shirts",
    "turtlenecks",
    "fast-fashion trend graphics",
    "loud logo merch",
    "hypebeast collab drops",
    "anime / cartoon graphic tees",
    "neon maximalist prints",
  ],
  colorPalette: [
    {
      name: "washed black",
      hex: "#1A1A1A",
      role: "primary",
      usage: "Core garment and campaign base",
    },
    {
      name: "charcoal",
      hex: "#2F2F2F",
      role: "primary",
      usage: "Heavyweight tees and hoodies",
    },
    {
      name: "off-white",
      hex: "#F5F2EB",
      role: "secondary",
      usage: "Contrast garments and tonal ink",
    },
    {
      name: "concrete grey",
      hex: "#8A8680",
      role: "neutral",
      usage: "Faded hoodies, backgrounds, material language",
    },
    {
      name: "muted taupe",
      hex: "#9C8F82",
      role: "neutral",
      usage: "Soft lifestyle wardrobe accents",
    },
    {
      name: "signal green",
      hex: "#3D7A5C",
      role: "accent",
      usage: "Drop accent only — never neon overload",
    },
  ],
  materials: [
    "heavyweight cotton",
    "premium fleece",
    "combed cotton",
    "vintage washed hand feel",
    "dense jersey",
  ],
  fit: {
    labels: ["Oversized", "Heavyweight", "Relaxed", "Boxy"],
    silhouettes: [
      "oversized",
      "relaxed",
      "boxy",
      "heavy-weight",
      "dropped shoulders",
    ],
    forbidden: ["skinny", "slim-fit", "bodycon", "tailored suit silhouette"],
  },
  visualIdentity: {
    summary:
      "Calm luxury streetwear with editorial restraint — obsidian / stone / off-white palette, negative space as a luxury signal, garment-scale artwork over logo marks.",
    philosophy: [
      "calm luxury",
      "emotional minimalism",
      "quiet confidence",
      "meaning over hype",
      "timeless over trendy",
      "editorial restraint over loud branding",
    ],
    signatureElements: [
      "organic curves",
      "subtle symbols",
      "abstract geometry",
      "editorial spacing",
      "layered meaning",
      "negative space",
      "micro editorial metadata",
    ],
    forbiddenAesthetics: [
      "Supreme / BAPE style",
      "anime graphics",
      "graffiti chaos",
      "hyper color palettes",
      "loud Y2K graphics",
      "cartoon artwork",
      "heavy skull graphics",
      "oversized logos",
      "saturated neon colors",
      "hypebeast aesthetics",
      "maximalism",
    ],
  },
  toneOfVoice: {
    summary:
      "Confident, minimal, culturally fluent. Speak like an insider, not a marketer. Never try-hard.",
    traits: [
      "confident",
      "minimal",
      "culturally fluent",
      "insider",
      "calm",
      "premium",
    ],
    do: [
      "Short sentences. Let product and story breathe.",
      "Authenticity over hype.",
      "Culture-first — connect to city culture, art, or community.",
      "Scarcity and story drive every drop.",
    ],
    dont: [
      "Exclamation spam",
      "Marketer-speak or corporate tone",
      "Fake scarcity or warehouse messaging",
      "Discount-market energy",
      "Trend-chasing that conflicts with brand identity",
    ],
  },
  lifestyleKeywords: [
    "premium streetwear lifestyle",
    "urban creative",
    "calm confidence",
    "city culture",
    "capsule drops",
    "quiet luxury",
    "weekend community",
    "effortless presence",
  ],
  communityKeywords: [
    "urban creatives",
    "photographers",
    "musicians",
    "designers",
    "culture-forward students",
    "VIP repeat buyers",
    "insider community",
    "drop loyalty",
  ],
  photographyStyle:
    "Photoreal commercial casting and editorial fashion photography — soft natural daylight, realistic skin, mild shadows. Premium streetwear, never beauty-retouched stock or dramatic high-fashion lighting.",
  campaignStyle:
    "Storytelling capsule campaigns with cultural grounding — locations and social scenes live in Image Studio later. Premium positioning without fake scarcity or warehouse messaging.",
  editorialStyle:
    "Clean editorial polish that supports image quality without turning faces or garments into classic luxury-fashion magazine covers. Natural asymmetry, correct anatomy, commercial usability.",
  socialStyle:
    "Approachable Brand Face energy for Instagram, TikTok, website, lookbook, and paid social — casually memorable, camera-ready, community-credible. Not CEO portraits, runway models, or gangster stereotypes.",
  wardrobeBasics: [
    "washed black / charcoal / off-white heavyweight tee",
    "faded grey or muted taupe hoodie",
    "black zip hoodie",
    "relaxed sweatpants as silhouette hint only",
  ],
  representationChannels: [
    "Instagram",
    "TikTok",
    "website",
    "lookbook",
    "paid social",
  ],
};
