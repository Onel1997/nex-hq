/**
 * Brand Memory — creative identity SSOT for all AI Studios
 * (Persona, Image, Video, Shopify, Marketing).
 *
 * Operational/POD context stays in `lib/business`.
 * Long-term Brain persistence can sync from this object later.
 */

export type BrandColorRole = "primary" | "secondary" | "accent" | "neutral";

export type BrandColorSwatch = {
  name: string;
  /** Optional hex for design / Shopify tools. */
  hex?: string;
  role: BrandColorRole;
  /** How the color is used in product and campaign work. */
  usage: string;
};

export type BrandFitLanguage = {
  /** Primary fit labels — e.g. Oversized, Heavyweight, Boxy. */
  labels: string[];
  /** Longer silhouette / construction cues for prompts. */
  silhouettes: string[];
  /** Explicitly forbidden fits. */
  forbidden: string[];
};

export type BrandVisualIdentity = {
  summary: string;
  philosophy: string[];
  signatureElements: string[];
  forbiddenAesthetics: string[];
};

export type BrandToneOfVoice = {
  summary: string;
  traits: string[];
  do: string[];
  dont: string[];
};

/**
 * Complete brand identity for one workspace brand.
 * Every studio must consume this object — never hardcode brand DNA in prompt builders.
 */
export type BrandMemory = {
  /** Workspace slug this memory belongs to (e.g. `milaene`). */
  slug: string;
  brandName: string;
  mission: string;
  positioning: string;
  targetAudience: string;
  productCategories: string[];
  allowedProductTypes: string[];
  forbiddenProductTypes: string[];
  colorPalette: BrandColorSwatch[];
  materials: string[];
  fit: BrandFitLanguage;
  visualIdentity: BrandVisualIdentity;
  toneOfVoice: BrandToneOfVoice;
  lifestyleKeywords: string[];
  communityKeywords: string[];
  photographyStyle: string;
  campaignStyle: string;
  editorialStyle: string;
  socialStyle: string;
  /**
   * Casting / lookbook wardrobe family language.
   * Persona Stage A and Image Studio garment cues read from here.
   */
  wardrobeBasics: string[];
  /** Channels where Brand Faces / campaigns must feel credible. */
  representationChannels: string[];
};
