import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Camera,
  Clapperboard,
  Globe,
  Image,
  Layers,
  LayoutGrid,
  Monitor,
  Package,
  Sparkles,
  Square,
} from "lucide-react";
import type { ImageStudioAsset } from "@/agents/image/types";

export type ProductionQueueStatus =
  | "waiting"
  | "preparing"
  | "generating"
  | "ready"
  | "approved"
  | "needs_revision";

export const PRODUCTION_QUEUE_LABELS: Record<ProductionQueueStatus, string> = {
  waiting: "Waiting",
  preparing: "Preparing Prompt",
  generating: "Generating",
  ready: "Ready",
  approved: "Approved",
  needs_revision: "Needs Revision",
};

/** Visual indicator class suffix for production queue status dots */
export const PRODUCTION_QUEUE_DOT: Record<ProductionQueueStatus, string> = {
  waiting: "waiting",
  preparing: "preparing",
  generating: "generating",
  ready: "ready",
  approved: "approved",
  needs_revision: "revision",
};

export type MissionAssetStatus = ProductionQueueStatus;

export const MISSION_STATUS_LABELS: Record<MissionAssetStatus, string> = PRODUCTION_QUEUE_LABELS;

export const PRODUCTION_TIMELINE_STEPS = [
  { id: "research", label: "Research" },
  { id: "creative", label: "Creative Director" },
  { id: "ai-designer", label: "AI Designer" },
  { id: "image-studio", label: "Image Studio" },
  { id: "commercial", label: "Commercial Review" },
  { id: "marketing", label: "Marketing" },
  { id: "shopify", label: "Shopify" },
] as const;

export type ProductionTimelineStepId = (typeof PRODUCTION_TIMELINE_STEPS)[number]["id"];

export const DELIVERABLE_GROUPS = [
  { label: "Hero Image", count: 1 },
  { label: "Mockups", count: 2 },
  { label: "Lifestyle", count: 2 },
  { label: "Campaign", count: 2 },
  { label: "Social Assets", count: 4 },
  { label: "Website Assets", count: 1 },
] as const;

export type AssetSlotPriority = "hero" | "core" | "support";

export interface MissionAssetSlot {
  id: string;
  label: string;
  icon: LucideIcon;
  assetTypes: string[];
  commercial: boolean;
  priority: AssetSlotPriority;
}

export const ASSET_PRIORITY_LABELS: Record<AssetSlotPriority, string> = {
  hero: "Hero",
  core: "Core",
  support: "Support",
};

export const MISSION_ASSET_SLOTS: MissionAssetSlot[] = [
  { id: "hero", label: "Hero Image", icon: Sparkles, assetTypes: ["hero_image"], commercial: true, priority: "hero" },
  { id: "mockup", label: "Product Mockup", icon: Package, assetTypes: ["ecommerce_image", "studio_shot"], commercial: true, priority: "core" },
  { id: "flatlay", label: "Flat Lay", icon: LayoutGrid, assetTypes: ["detail_shot"], commercial: false, priority: "support" },
  { id: "lifestyle", label: "Lifestyle", icon: Camera, assetTypes: ["editorial_streetwear"], commercial: true, priority: "core" },
  { id: "editorial", label: "Editorial", icon: BookOpen, assetTypes: ["editorial_luxury"], commercial: true, priority: "core" },
  { id: "campaign", label: "Campaign Hero", icon: Clapperboard, assetTypes: ["collection_cover", "launch_banner"], commercial: true, priority: "hero" },
  { id: "instagram", label: "Instagram Feed", icon: Square, assetTypes: ["instagram_post"], commercial: true, priority: "core" },
  { id: "story", label: "Instagram Story", icon: Monitor, assetTypes: ["story_slide"], commercial: false, priority: "support" },
  { id: "pinterest", label: "Pinterest", icon: Layers, assetTypes: ["carousel_image"], commercial: false, priority: "support" },
  { id: "tiktok", label: "TikTok Cover", icon: Image, assetTypes: ["tiktok_cover"], commercial: true, priority: "core" },
  { id: "lookbook", label: "Lookbook", icon: BookOpen, assetTypes: ["lookbook_outfit"], commercial: true, priority: "core" },
  { id: "banner", label: "Website Banner", icon: Globe, assetTypes: ["launch_banner"], commercial: true, priority: "core" },
];

export const FASHION_PRODUCTION_PIPELINE = [
  { id: "blueprint", label: "Preparing Blueprint" },
  { id: "composition", label: "Building Composition" },
  { id: "hero", label: "Generating Hero Image" },
  { id: "lifestyle", label: "Creating Lifestyle Scene" },
  { id: "mockup", label: "Rendering Product Mockup" },
  { id: "evaluation", label: "Commercial Evaluation" },
  { id: "approved", label: "Production Approved" },
] as const;

export type FashionProductionStepId = (typeof FASHION_PRODUCTION_PIPELINE)[number]["id"];

export const HANDOFF_CHECKLIST = [
  { id: "mission", label: "Mission Imported", check: (h: HandoffChecks) => Boolean(h.hasMission) },
  { id: "blueprint", label: "AI Designer Blueprint Received", check: (h: HandoffChecks) => Boolean(h.hasBlueprint) },
  { id: "image-prompt", label: "Image Prompt Ready", check: (h: HandoffChecks) => Boolean(h.hasImagePrompt) },
  { id: "mockup-prompt", label: "Mockup Prompt Ready", check: (h: HandoffChecks) => Boolean(h.hasMockupPrompt) },
  { id: "assets", label: "12 Assets Planned", check: (h: HandoffChecks) => Boolean(h.hasMission) },
] as const;

export interface HandoffChecks {
  hasMission: boolean;
  hasBlueprint: boolean;
  hasImagePrompt: boolean;
  hasMockupPrompt: boolean;
}

export interface MissionContextInput {
  sourceTitle?: string;
  projectName?: string;
  concept?: {
    title?: string;
    collection?: string;
    product?: string;
    color?: string;
    creativeDirection?: { summary?: string };
    commercialIntention?: { role?: string; campaignPotential?: string };
    heroFocus?: { dominantElement?: string };
  };
  commercialBlueprint?: string;
  imagePromptPrimary?: string;
}

export function buildHandoffChecks(input: {
  handoff: boolean;
  hasBlueprint: boolean;
  imagePrompt?: string;
  mockupPrompt?: string;
}): HandoffChecks {
  return {
    hasMission: input.handoff,
    hasBlueprint: input.hasBlueprint,
    hasImagePrompt: Boolean(input.imagePrompt?.trim()),
    hasMockupPrompt: Boolean(input.mockupPrompt?.trim()),
  };
}

export function resolveMissionName(ctx: MissionContextInput): string {
  return (
    ctx.projectName ??
    ctx.concept?.title ??
    ctx.sourceTitle ??
    "Awaiting Mission"
  );
}

export function resolveCreativeDirection(ctx: MissionContextInput): string {
  return (
    ctx.concept?.creativeDirection?.summary ??
    ctx.commercialBlueprint?.slice(0, 160) ??
    "Import from Design Studio to load creative direction"
  );
}

export function resolvePieceClassification(ctx: MissionContextInput): string {
  const role = ctx.concept?.commercialIntention?.role?.trim();
  if (role) {
    if (/hero|statement|flagship/i.test(role)) return "Hero Piece";
    if (/essential|core|baseline/i.test(role)) return "Core Essential";
    if (/statement|editorial|campaign/i.test(role)) return "Statement Piece";
    return role;
  }
  const potential = ctx.concept?.commercialIntention?.campaignPotential;
  if (potential && /high|hero|flagship/i.test(potential)) return "Hero Piece";
  if (ctx.concept?.heroFocus?.dominantElement) return "Statement Piece";
  return ctx.concept ? "Core Essential" : "—";
}

/** Static UX estimate per asset slot — display only. */
export const ASSET_ESTIMATED_SECONDS: Record<string, number> = {
  hero: 48,
  mockup: 36,
  flatlay: 28,
  lifestyle: 42,
  editorial: 45,
  campaign: 50,
  instagram: 32,
  story: 28,
  pinterest: 30,
  tiktok: 34,
  lookbook: 40,
  banner: 38,
};

export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

export function deriveFashionProductionStep(
  isLoading: boolean,
  hasResults: boolean,
  hasBlueprint: boolean,
): FashionProductionStepId {
  if (hasResults && !isLoading) return "approved";
  if (isLoading) return "composition";
  if (hasBlueprint) return "blueprint";
  return "blueprint";
}

export function mapAssetStatusToMission(
  status: ImageStudioAsset["status"] | undefined,
  reviewState?: "approved" | "needs_revision" | null,
): MissionAssetStatus {
  if (reviewState === "needs_revision") return "needs_revision";
  if (reviewState === "approved") return "approved";
  switch (status) {
    case "pending":
      return "preparing";
    case "generating":
      return "generating";
    case "completed":
      return "ready";
    case "ready":
      return "ready";
    case "failed":
      return "needs_revision";
    default:
      return "waiting";
  }
}

export function progressForMissionStatus(status: MissionAssetStatus): number {
  switch (status) {
    case "waiting":
      return 0;
    case "preparing":
      return 15;
    case "generating":
      return 50;
    case "ready":
      return 78;
    case "approved":
      return 95;
    case "needs_revision":
      return 35;
    default:
      return 0;
  }
}

export function assetVersionLabel(asset?: ImageStudioAsset): string {
  if (!asset) return "—";
  if (asset.createdAt) {
    return `v${new Date(asset.createdAt).getTime().toString(36).slice(-4)}`;
  }
  return "v1";
}

export function findAssetForSlot(
  slot: MissionAssetSlot,
  assets: ImageStudioAsset[],
): ImageStudioAsset | undefined {
  return assets.find((asset) => slot.assetTypes.includes(asset.assetType));
}

export function deriveMissionStatus(
  slot: MissionAssetSlot,
  assets: ImageStudioAsset[],
  options?: {
    activeAssetId?: string;
    hasBlueprint?: boolean;
    reviewState?: "approved" | "needs_revision" | null;
    generatingAssetId?: string | null;
  },
): MissionAssetStatus {
  const asset = findAssetForSlot(slot, assets);
  if (!asset) {
    return options?.hasBlueprint ? "preparing" : "waiting";
  }
  if (asset.id === options?.generatingAssetId || asset.status === "generating") {
    return "generating";
  }
  return mapAssetStatusToMission(asset.status, options?.reviewState ?? null);
}

export function derivePipelineStep(
  isProjectLoading: boolean,
  isAssetGenerating: boolean,
  hasResults: boolean,
): FashionProductionStepId {
  return deriveFashionProductionStep(isProjectLoading, hasResults, true);
}
