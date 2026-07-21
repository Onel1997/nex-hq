import type { BrandMemory } from "./types";

function joinList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function formatPalette(memory: BrandMemory): string {
  return memory.colorPalette
    .map((c) => {
      const hex = c.hex ? ` (${c.hex})` : "";
      return `${c.name}${hex} [${c.role}] — ${c.usage}`;
    })
    .join("; ");
}

/**
 * Full Brand Memory block for any AI Studio system / user prompt.
 * Prefer studio-specific formatters when available.
 */
export function formatBrandMemoryPrompt(memory: BrandMemory): string {
  return [
    "## BRAND MEMORY",
    "",
    `Brand:\n${memory.brandName}`,
    "",
    `Mission:\n${memory.mission}`,
    "",
    `Positioning:\n${memory.positioning}`,
    "",
    `Target Audience:\n${memory.targetAudience}`,
    "",
    `Product Categories:\n${joinList(memory.productCategories)}`,
    "",
    `Allowed Product Types:\n${joinList(memory.allowedProductTypes)}`,
    "",
    `Forbidden Product Types:\n${joinList(memory.forbiddenProductTypes)}`,
    "",
    `Color Palette:\n${formatPalette(memory)}`,
    "",
    `Materials:\n${joinList(memory.materials)}`,
    "",
    `Fit:\n${joinList(memory.fit.labels)} — ${joinList(memory.fit.silhouettes)}`,
    "",
    `Forbidden Fits:\n${joinList(memory.fit.forbidden)}`,
    "",
    `Visual Identity:\n${memory.visualIdentity.summary}`,
    "",
    `Philosophy:\n${joinList(memory.visualIdentity.philosophy)}`,
    "",
    `Signature Elements:\n${joinList(memory.visualIdentity.signatureElements)}`,
    "",
    `Forbidden Aesthetics:\n${joinList(memory.visualIdentity.forbiddenAesthetics)}`,
    "",
    `Tone of Voice:\n${memory.toneOfVoice.summary}`,
    "",
    `Voice Traits:\n${joinList(memory.toneOfVoice.traits)}`,
    "",
    `Lifestyle Keywords:\n${joinList(memory.lifestyleKeywords)}`,
    "",
    `Community Keywords:\n${joinList(memory.communityKeywords)}`,
    "",
    `Photography Style:\n${memory.photographyStyle}`,
    "",
    `Campaign Style:\n${memory.campaignStyle}`,
    "",
    `Editorial Style:\n${memory.editorialStyle}`,
    "",
    `Social Style:\n${memory.socialStyle}`,
    "",
    `Wardrobe Basics:\n${joinList(memory.wardrobeBasics)}`,
    "",
    `Representation Channels:\n${joinList(memory.representationChannels)}`,
  ].join("\n");
}

export type PersonaBrandPromptContext = {
  /** Optional project brief overlays (lifestyle direction, role, keywords). */
  lifestyleDirection?: string | null;
  brandRole?: string | null;
  visualKeywords?: string | null;
  preferredBrandLooks?: string | null;
  creativeNotes?: string | null;
};

/**
 * Persona Stage A Brand DNA block — reads entirely from Brand Memory.
 * Project fields only overlay casting brief direction, never replace brand identity.
 */
export function formatBrandMemoryForPersona(
  memory: BrandMemory,
  context: PersonaBrandPromptContext = {},
): string {
  const lifestyle =
    context.lifestyleDirection?.trim() ||
    memory.lifestyleKeywords[0] ||
    memory.positioning;

  return [
    `4. ${memory.brandName.toUpperCase()} PREMIUM STREETWEAR BRAND DNA`,
    `${memory.brandName} — ${memory.positioning}`,
    `Mission: ${memory.mission}`,
    "Stage A judges face, presence, identity strength, streetwear credibility, and multi-angle consistency.",
    "Not a campaign shoot. No streets, cafés, cars, product sets, or social-media scene builds here.",
    `Lifestyle direction: ${lifestyle}.`,
    context.brandRole ? `Brand role: ${context.brandRole}.` : null,
    context.visualKeywords
      ? `Visual keywords: ${context.visualKeywords}.`
      : `Lifestyle keywords: ${joinList(memory.lifestyleKeywords)}.`,
    context.preferredBrandLooks
      ? `Brand look: ${context.preferredBrandLooks}.`
      : null,
    context.creativeNotes ? `Creative notes: ${context.creativeNotes}.` : null,
    `Fit language: ${joinList(memory.fit.labels)}.`,
    `Visual identity: ${memory.visualIdentity.summary}`,
    `Tone: ${memory.toneOfVoice.summary}`,
    `Community: ${joinList(memory.communityKeywords.slice(0, 4))}.`,
    `Shared cast DNA only: age band aligned to ${memory.targetAudience}, ${memory.brandName} premium streetwear context, calm commercial casting language.`,
    "NOT shared across candidates: face geometry, jaw, nose, eyes, lips, skin tone, hair texture, haircut, body build.",
    `Goal: a person who could credibly represent ${memory.brandName} on ${joinList(memory.representationChannels)}.`,
    `Social style: ${memory.socialStyle}`,
    "Not: a perfect AI model against a wall. Not a magazine cover. Not a classic luxury-fashion cast.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Wardrobe + fit block for Persona Stage A — Brand Memory fit / material language only.
 * Exact sellable products, colors, and forbidden catalog categories come from
 * Product Intelligence (`formatProductWardrobeConstraintsForPersona`) — do not
 * duplicate catalog truth here.
 */
export function formatBrandMemoryWardrobeForPersona(
  memory: BrandMemory,
  options: {
    candidateWardrobe: string;
    briefOutfitCue?: string | null;
    /** Authoritative product wardrobe constraints from Product Intelligence. */
    productWardrobeConstraints?: string | null;
  },
): string {
  const fitMustRead = memory.fit.labels.includes("Oversized")
    ? "Oversized premium streetwear fit must read clearly in Half Body."
    : `${memory.fit.labels[0] ?? "Brand"} fit must read clearly in Half Body.`;

  return [
    "5. WARDROBE AND FIT",
    `Candidate wardrobe: ${options.candidateWardrobe}.`,
    options.briefOutfitCue
      ? `Brief outfit cue: ${options.briefOutfitCue}.`
      : null,
    options.productWardrobeConstraints?.trim() || null,
    `Materials language (Brand Memory): ${joinList(memory.materials)}.`,
    `Fit (Brand Memory): ${joinList(memory.fit.labels)} (${joinList(memory.fit.silhouettes)}).`,
    fitMustRead,
    "No visible logos or fantasy brands.",
    `Forbidden fits: ${joinList(memory.fit.forbidden)}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Editorial support block — photography + editorial style from Brand Memory. */
export function formatBrandMemoryEditorialForPersona(
  memory: BrandMemory,
): string {
  return [
    "9. EDITORIAL SUPPORT (secondary only)",
    `Photorealistic adult casting photograph for ${memory.brandName} — ${memory.positioning.split("—")[0]?.trim() ?? memory.positioning}.`,
    memory.editorialStyle,
    memory.photographyStyle,
    "Commercial usable, clean, natural. Clearly an adult human.",
    "Natural facial asymmetry. Realistic hair strands. Correct anatomy.",
    "No over-retouching, no glossy beauty skin, no uncanny perfect symmetry.",
    "No brand logos, no copyrighted characters, no text, no watermark.",
    `Single adult person only. Suitable as an official ${memory.brandName} Brand Face reference.`,
  ].join("\n");
}

/** Compact color + fit summary for Image / Design studios. */
export function formatBrandMemoryVisualSummary(memory: BrandMemory): string {
  return [
    `${memory.brandName} visual system`,
    `Palette: ${memory.colorPalette.map((c) => c.name).join(", ")}`,
    `Fit: ${joinList(memory.fit.labels)}`,
    `Materials: ${joinList(memory.materials)}`,
    memory.visualIdentity.summary,
  ].join("\n");
}
