/**
 * Milaene Brand Profile — central immutable brand intelligence contract.
 * Encoded locally — does not import Brain or workspace modules.
 *
 * Used by confidence scoring, brand intelligence engine, and recommendation filtering.
 */
export const MILAENE_BRAND_PROFILE = {
  workspaceId: "milaene",
  name: "Milaene",
  category: "Premium Streetwear",
  positioning: "Quiet Luxury Streetwear",

  coreProducts: ["Oversized T-Shirts", "Heavyweight Hoodies"] as const,
  fabricPreferences: ["280 GSM", "480 GSM", "280gsm", "480gsm", "heavyweight"] as const,

  highMatch: [
    "oversized",
    "minimal",
    "premium",
    "luxury",
    "archive",
    "monochrome",
    "clean graphics",
    "embroidery",
    "washed",
    "heavyweight",
    "vintage premium",
    "neutral colors",
    "black",
    "white",
    "grey",
    "gray",
    "cream",
    "earth tones",
    "quiet",
    "restraint",
    "streetwear",
    "emblem",
    "understated",
    "refined",
    "tailored",
    "neutral",
    "heritage",
    "craft",
    "elevated",
    "essential",
    "timeless",
    "subtle",
    "confidence",
    "280 gsm",
    "480 gsm",
    "hoodie",
    "t-shirt",
    "tee",
  ] as const,

  mediumMatch: [
    "boxy fit",
    "boxy",
    "texture",
    "minimal back print",
    "small front print",
    "utility",
    "muted graphics",
    "crewneck",
    "sweatshirt",
  ] as const,

  lowMatch: [
    "anime",
    "cartoon",
    "neon",
    "graffiti",
    "skulls",
    "skull",
    "extreme y2k",
    "y2k",
    "maximalism",
    "maximalist",
    "festival",
    "color explosion",
    "cute graphics",
    "loud",
    "novelty",
    "flashy",
    "overbranded",
    "logomania",
  ] as const,

  notRecommended: [
    "kids",
    "children",
    "fast fashion",
    "women's dresses",
    "dress",
    "cargo focus",
    "cargo pants",
    "wide leg cargo",
    "sports jerseys",
    "football kits",
    "jersey",
    "cosplay",
    "kawaii",
    "toys",
    "home decor",
    "phone cases",
    "costume",
    "cheap",
    "mass market",
    "disposable",
    "trend-chasing",
  ] as const,

  /** @deprecated Use highMatch — retained for confidence engine backward compatibility */
  positiveTerms: [
    "minimal",
    "luxury",
    "restraint",
    "archive",
    "streetwear",
    "quiet",
    "emblem",
    "understated",
    "premium",
    "refined",
    "tailored",
    "monochrome",
    "neutral",
    "heritage",
    "craft",
    "elevated",
    "essential",
    "timeless",
    "subtle",
    "confidence",
    "oversized",
    "heavyweight",
    "embroidery",
    "washed",
    "black",
    "white",
    "grey",
    "cream",
  ] as const,

  /** @deprecated Use lowMatch + notRecommended */
  negativeTerms: [
    "maximalist",
    "fast fashion",
    "loud",
    "neon",
    "novelty",
    "costume",
    "trend-chasing",
    "disposable",
    "flashy",
    "overbranded",
    "logomania",
    "cheap",
    "mass market",
    "anime",
    "cartoon",
    "graffiti",
    "skulls",
    "kawaii",
    "cargo",
    "jersey",
    "kids",
    "dress",
    "phone cases",
    "home decor",
  ] as const,

  preferredAesthetics: [
    "streetwear",
    "archive",
    "luxury restraint",
    "minimal confidence",
    "quiet luxury",
    "quiet luxury streetwear",
  ] as const,

  colorPalette: ["black", "white", "grey", "gray", "cream", "earth tones", "neutral", "charcoal", "stone", "sand", "olive", "taupe"] as const,

  silhouetteTerms: ["oversized", "boxy", "relaxed", "drop shoulder", "heavyweight", "structured"] as const,

  graphicTerms: ["embroidery", "minimal print", "small front print", "minimal back print", "emblem", "monochrome graphic", "clean graphics", "muted graphics", "subtle logo"] as const,

  typographyTerms: ["sans-serif", "condensed", "editorial", "minimal type", "oversized type", "tracking", "uppercase restraint"] as const,

  luxuryTerms: ["premium", "luxury", "quiet", "restraint", "archive", "heritage", "craft", "elevated", "refined", "understated"] as const,

  audienceTerms: ["streetwear", "premium", "luxury", "archive", "minimal", "adult", "unisex"] as const,
} as const;

export type MilaeneBrandProfile = typeof MILAENE_BRAND_PROFILE;

export type BrandFitTierLabel =
  | "Perfect Match"
  | "Excellent"
  | "Good"
  | "Weak"
  | "Reject";

export function brandFitTierFromScore(score: number): BrandFitTierLabel {
  if (score >= 95) return "Perfect Match";
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Weak";
  return "Reject";
}

export function termMatchesHighMatch(term: string): boolean {
  const normalized = term.toLowerCase();
  return MILAENE_BRAND_PROFILE.highMatch.some(
    (match) => normalized.includes(match) || match.includes(normalized),
  );
}

export function termMatchesMediumMatch(term: string): boolean {
  const normalized = term.toLowerCase();
  return MILAENE_BRAND_PROFILE.mediumMatch.some(
    (match) => normalized.includes(match) || match.includes(normalized),
  );
}

export function termMatchesLowMatch(term: string): boolean {
  const normalized = term.toLowerCase();
  return MILAENE_BRAND_PROFILE.lowMatch.some(
    (match) => normalized.includes(match) || match.includes(normalized),
  );
}

export function termIsNotRecommended(term: string): boolean {
  const normalized = term.toLowerCase();
  return MILAENE_BRAND_PROFILE.notRecommended.some(
    (match) => normalized.includes(match) || match.includes(normalized),
  );
}

export function termMatchesBrandFit(term: string): boolean {
  return termMatchesHighMatch(term) || termMatchesMediumMatch(term);
}

export function termConflictsBrandFit(term: string): boolean {
  return termMatchesLowMatch(term) || termIsNotRecommended(term);
}
