/**
 * Persona Creator Phase 1.3 — presentation-only helpers.
 * Deterministic UX indicators; no AI, no API calls, no generation.
 */

import type {
  BrandRole,
  IntendedUsage,
  ProviderMode,
  QualityMode,
} from "@/lib/persona/domain/creation-types";
import {
  MAX_DAILY_GENERATION_EUR,
  STAGE_A_ASSET_TYPES,
} from "@/lib/persona/domain/creation-types";

/** Display-only mirrors of provider/cost.ts — UX preview, not billing authority. */
const DISPLAY_COST_EUR_MIN = 0.04;
const DISPLAY_COST_EUR_MAX = 0.12;

export type CreatorFormState = {
  name: string;
  brand_role: BrandRole;
  gender_presentation: string;
  age_range: string;
  height_range: string;
  body_type: string;
  skin_tone_direction: string;
  face_shape_direction: string;
  hair_direction: string;
  facial_hair_direction: string;
  eye_direction: string;
  expression_direction: string;
  personality: string;
  fashion_style: string;
  preferred_brand_looks: string;
  preferred_outfits: string;
  excluded_features: string;
  visual_keywords: string;
  intended_usage: IntendedUsage;
  candidate_count: number;
  provider_mode: ProviderMode;
  quality_mode: QualityMode;
  additional_description: string;
  description: string;
};

export const CREATOR_STEPS = [
  { id: "role", label: "Brand Role", short: "Role" },
  { id: "physique", label: "Physique", short: "Body" },
  { id: "face", label: "Face & Hair", short: "Face" },
  { id: "presence", label: "Presence", short: "Presence" },
  { id: "fashion", label: "Fashion", short: "Fashion" },
  { id: "looks", label: "Looks", short: "Looks" },
  { id: "exclusions", label: "Exclusions", short: "Exclude" },
  { id: "usage", label: "Campaign", short: "Usage" },
  { id: "candidates", label: "Cast Size", short: "Cast" },
  { id: "confirm", label: "Confirm", short: "Confirm" },
] as const;

export const VISUAL_FLOW = [
  { id: "brand_cast", label: "Brand Cast" },
  { id: "creator", label: "Persona Creator" },
  { id: "candidates", label: "Candidates" },
  { id: "reference", label: "Reference Package" },
  { id: "identity", label: "Identity Lock" },
  { id: "approved", label: "Approved Brand Cast" },
] as const;

export const CAST_MILESTONES = [
  { id: "defined", label: "Persona defined" },
  { id: "generated", label: "Candidates generated" },
  { id: "selected", label: "Candidate selected" },
  { id: "draft", label: "Converted to Draft" },
  { id: "reference", label: "Reference package complete" },
  { id: "locked", label: "Identity locked" },
  { id: "approved", label: "Approved" },
] as const;

export type PresetBestFor = "Campaigns" | "Editorial" | "Social" | "Shopify";

export type PresetCardMeta = {
  title: string;
  description: string;
  usage: string;
  icon: "diamond" | "frame" | "urban" | "campaign" | "nordic" | "commercial";
  bestFor: PresetBestFor[];
};

/** Enrichment for API presets + pure client style starters. */
export const PRESET_CARD_META: Record<string, PresetCardMeta> = {
  primary_male_quiet_luxury: {
    title: "Quiet Luxury",
    description: "Restrained presence, calm confidence, premium neutrals.",
    usage: "Hero campaigns · brand face",
    icon: "diamond",
    bestFor: ["Campaigns", "Editorial"],
  },
  primary_female_minimal_editorial: {
    title: "Minimal Editorial",
    description: "Clean lines, soft structure, brand-forward restraint.",
    usage: "Editorial · lookbooks",
    icon: "frame",
    bestFor: ["Editorial", "Campaigns"],
  },
  secondary_male_street_editorial: {
    title: "Street Editorial",
    description: "Urban edge with controlled texture and sharp silhouette.",
    usage: "Street drops · seasonal",
    icon: "urban",
    bestFor: ["Social", "Editorial"],
  },
};

export type StyleStarter = {
  id: string;
  meta: PresetCardMeta;
  patch: Partial<CreatorFormState>;
};

export const STYLE_STARTERS: StyleStarter[] = [
  {
    id: "luxury_campaign",
    meta: {
      title: "Luxury Campaign",
      description: "High polish casting for flagship seasonal films.",
      usage: "Campaign · video hero",
      icon: "campaign",
      bestFor: ["Campaigns", "Shopify"],
    },
    patch: {
      fashion_style: "Luxury campaign",
      preferred_brand_looks: "Luxury Campaign",
      preferred_outfits: "Tailored blacks, silk layers, architectural coats",
      visual_keywords: "campaign, cinematic, elevated, polished",
      expression_direction: "Commanding calm, camera-ready",
      personality: "Assured, magnetic restraint",
      intended_usage: "image_and_video",
      candidate_count: 4,
    },
  },
  {
    id: "scandinavian_minimal",
    meta: {
      title: "Scandinavian Minimal",
      description: "Light, architectural, quietly modern northern clarity.",
      usage: "Product · lifestyle",
      icon: "nordic",
      bestFor: ["Editorial", "Social"],
    },
    patch: {
      fashion_style: "Scandinavian minimal",
      preferred_brand_looks: "Scandinavian Minimal",
      preferred_outfits: "Wool knits, soft tailoring, pale neutrals",
      visual_keywords: "nordic, airy, architectural, soft light",
      expression_direction: "Open stillness, natural ease",
      personality: "Understated warmth",
      skin_tone_direction: "Fair to light olive",
      hair_direction: "Natural, soft texture",
      intended_usage: "image_and_video",
      candidate_count: 4,
    },
  },
  {
    id: "commercial_fashion",
    meta: {
      title: "Commercial Fashion",
      description: "Approachable polish built for conversion and clarity.",
      usage: "E-com · social · ads",
      icon: "commercial",
      bestFor: ["Shopify", "Social", "Campaigns"],
    },
    patch: {
      fashion_style: "Commercial fashion",
      preferred_brand_looks: "Commercial Fashion",
      preferred_outfits: "Versatile staples, clean denim, soft structure",
      visual_keywords: "commercial, clear, convertible, friendly premium",
      expression_direction: "Approachable confidence",
      personality: "Warm professionalism",
      intended_usage: "image_and_video",
      candidate_count: 6,
    },
  },
];

export type LiveCastScores = {
  brandFit: number;
  luxury: number;
  commercial: number;
  videoReadiness: number;
  imageReadiness: number;
  consistency: number;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function filled(value: string): boolean {
  return value.trim().length > 0;
}

function keywordHit(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((acc, w) => (lower.includes(w) ? acc + 1 : acc), 0);
}

/** Deterministic UX scores from selected options — not AI. */
export function computeLiveCastScores(form: CreatorFormState): LiveCastScores {
  const coreFields = [
    form.name,
    form.age_range,
    form.height_range,
    form.body_type,
    form.hair_direction,
    form.eye_direction,
    form.skin_tone_direction,
    form.fashion_style,
    form.personality,
    form.preferred_brand_looks,
  ];
  const filledCore = coreFields.filter(filled).length;
  const consistency = clampScore(40 + (filledCore / coreFields.length) * 55);

  const fashionBlob = [
    form.fashion_style,
    form.visual_keywords,
    form.preferred_brand_looks,
    form.expression_direction,
  ].join(" ");

  const luxuryHits = keywordHit(fashionBlob, [
    "luxury",
    "quiet",
    "editorial",
    "premium",
    "campaign",
    "refined",
    "elevated",
    "minimal",
  ]);
  const commercialHits = keywordHit(fashionBlob, [
    "commercial",
    "street",
    "casual",
    "social",
    "e-com",
    "convertible",
    "friendly",
    "clear",
  ]);

  const roleBoost =
    form.brand_role.startsWith("primary")
      ? 12
      : form.brand_role.includes("campaign")
        ? 10
        : 4;

  const usageImage =
    form.intended_usage === "image" || form.intended_usage === "image_and_video";
  const usageVideo =
    form.intended_usage === "video" || form.intended_usage === "image_and_video";

  return {
    brandFit: clampScore(55 + roleBoost + luxuryHits * 4 + (filled(form.name) ? 6 : 0)),
    luxury: clampScore(48 + luxuryHits * 8 + (form.brand_role.includes("campaign") ? 8 : 0)),
    commercial: clampScore(42 + commercialHits * 9 + (form.candidate_count >= 6 ? 6 : 0)),
    videoReadiness: clampScore(
      (usageVideo ? 72 : 28) + (filled(form.expression_direction) ? 10 : 0) + luxuryHits * 2,
    ),
    imageReadiness: clampScore(
      (usageImage ? 78 : 30) + (filled(form.face_shape_direction) ? 8 : 0) + filledCore,
    ),
    consistency,
  };
}

export function isPersonaDefined(form: CreatorFormState): boolean {
  return (
    filled(form.name) &&
    filled(form.age_range) &&
    filled(form.height_range) &&
    filled(form.body_type) &&
    filled(form.fashion_style) &&
    filled(form.hair_direction)
  );
}

export function castProgressPercent(form: CreatorFormState): number {
  return isPersonaDefined(form) ? 14 : Math.round((computeLiveCastScores(form).consistency / 100) * 12);
}

export type CreatorCostPreview = {
  estimatedMin: number;
  estimatedMax: number;
  estimatedTotal: number;
  currency: "EUR";
  expectedMinutesMin: number;
  expectedMinutesMax: number;
  generationMode: string;
  dailyBudget: number;
  provider: string;
  candidateCount: number;
  imagesPerCandidate: number;
  note: string;
};

const MODE_LABELS: Record<ProviderMode, string> = {
  manual_upload: "Manual Upload",
  image_provider: "Image Provider",
  hybrid: "Hybrid",
  disabled: "Disabled",
};

export function computeCreatorCostPreview(form: CreatorFormState): CreatorCostPreview {
  const count = Math.min(8, Math.max(1, form.candidate_count || 1));
  const imagesPerCandidate = STAGE_A_ASSET_TYPES.length;
  const totalImages = count * imagesPerCandidate;
  const mode = form.provider_mode;

  if (mode === "manual_upload" || mode === "disabled") {
    return {
      estimatedMin: 0,
      estimatedMax: 0,
      estimatedTotal: 0,
      currency: "EUR",
      expectedMinutesMin: mode === "manual_upload" ? 5 : 0,
      expectedMinutesMax: mode === "manual_upload" ? 15 : 0,
      generationMode: MODE_LABELS[mode],
      dailyBudget: MAX_DAILY_GENERATION_EUR,
      provider: mode === "manual_upload" ? "Manual" : "None",
      candidateCount: count,
      imagesPerCandidate,
      note:
        mode === "manual_upload"
          ? "Manual upload — no provider cost. Time depends on your uploads."
          : "Generation disabled — no cost, no candidates.",
    };
  }

  const estimatedMin = Number((totalImages * DISPLAY_COST_EUR_MIN).toFixed(2));
  const estimatedMax = Number((totalImages * DISPLAY_COST_EUR_MAX).toFixed(2));
  const estimatedTotal = Number(((estimatedMin + estimatedMax) / 2).toFixed(2));
  const perCandidateSec = mode === "hybrid" ? 50 : 45;

  return {
    estimatedMin,
    estimatedMax,
    estimatedTotal,
    currency: "EUR",
    expectedMinutesMin: Math.max(1, Math.ceil((count * perCandidateSec) / 60)),
    expectedMinutesMax: Math.max(2, Math.ceil((count * perCandidateSec * 1.6) / 60)),
    generationMode: MODE_LABELS[mode],
    dailyBudget: MAX_DAILY_GENERATION_EUR,
    provider: "OpenAI",
    candidateCount: count,
    imagesPerCandidate,
    note: `Stage A discovery: ${count} × ${imagesPerCandidate} previews. Explicit cost confirmation required before generation.`,
  };
}

export function brandRoleDisplayLabel(role: BrandRole): string {
  const labels: Record<BrandRole, string> = {
    primary_male: "Primary Male",
    secondary_male: "Secondary Male",
    primary_female: "Primary Female",
    secondary_female: "Secondary Female",
    unisex_editorial: "Unisex Editorial",
    campaign_specialist: "Campaign Specialist",
  };
  return labels[role];
}

export function usageDisplayLabel(usage: IntendedUsage): string {
  if (usage === "image") return "Image campaigns";
  if (usage === "video") return "Video campaigns";
  return "Image & Video";
}

export function primaryFaceLabel(form: CreatorFormState): string {
  if (filled(form.name)) return form.name;
  return brandRoleDisplayLabel(form.brand_role);
}

/** Future generation loading copy — UI only, not wired to providers. */
export const GENERATION_LOADING_MESSAGES = [
  "Creating official Milaene Brand Cast...",
  "Matching facial structure...",
  "Building luxury identity...",
  "Generating Candidate {n} of {total}...",
  "Preparing editorial consistency...",
  "Optimizing realism...",
  "Almost finished...",
] as const;

export type CastProgressView = {
  percent: number;
  currentMilestone: string;
  nextMilestone: string;
  estimatedCompletion: string;
  completedCount: number;
};

export function computeCastProgressView(form: CreatorFormState): CastProgressView {
  const defined = isPersonaDefined(form);
  const completedCount = defined ? 1 : 0;
  const percent = defined
    ? 14
    : Math.max(4, Math.round((computeLiveCastScores(form).consistency / 100) * 12));

  return {
    percent,
    currentMilestone: defined ? "Persona defined" : "Defining persona",
    nextMilestone: defined ? "Candidates generated" : "Persona defined",
    estimatedCompletion: defined ? "6 remaining milestones" : "7 milestones remaining",
    completedCount,
  };
}

export type MockCandidateCard = {
  id: string;
  label: string;
  luxury: number;
  realism: number;
  commercial: number;
  consistency: number;
};

/** Deterministic placeholder scores for comparison mockup — not AI. */
export function mockComparisonCandidates(form: CreatorFormState): MockCandidateCard[] {
  const base = computeLiveCastScores(form);
  const offsets = [
    { id: "A", d: 0 },
    { id: "B", d: -4 },
    { id: "C", d: 3 },
    { id: "D", d: -7 },
  ];
  return offsets.map(({ id, d }) => ({
    id,
    label: `Candidate ${id}`,
    luxury: clampScore(base.luxury + d),
    realism: clampScore(base.consistency + d + 2),
    commercial: clampScore(base.commercial - d),
    consistency: clampScore(base.consistency + Math.floor(d / 2)),
  }));
}

export function fashionDirectionLabel(form: CreatorFormState): string {
  return form.preferred_brand_looks.trim() || form.fashion_style.trim() || "Quiet Luxury";
}
