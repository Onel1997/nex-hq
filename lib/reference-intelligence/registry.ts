import { DEFAULT_BUSINESS_PROFILE_SLUG } from "@/lib/business/business-profile";
import type {
  ReferenceBoard,
  ReferenceUsage,
  ReferenceWorkspaceCatalog,
} from "./types";

export const DEFAULT_REFERENCE_INTELLIGENCE_SLUG = DEFAULT_BUSINESS_PROFILE_SLUG;

const SEED_UPDATED_AT = "2026-07-21T00:00:00.000Z";
const SEED_WORKSPACE_ID = "ws-milaene";

type BoardSeed = {
  id: string;
  name: string;
  description: string;
  primaryUsage: ReferenceUsage;
  allowedUsages: ReferenceUsage[];
};

/**
 * Canonical empty Milaene reference boards.
 * No copyrighted images are preloaded — boards + descriptor templates only.
 */
const MILAENE_BOARD_SEEDS: BoardSeed[] = [
  {
    id: "board-milaene-persona-casting",
    name: "Milaene Persona Casting",
    description:
      "Abstract casting direction for Brand Faces — mood, grooming, presence. No identity clones.",
    primaryUsage: "persona_casting",
    allowedUsages: ["persona_casting", "pose", "mood", "camera", "lighting"],
  },
  {
    id: "board-milaene-brand-lifestyle",
    name: "Milaene Brand Lifestyle",
    description: "Lifestyle energy and authenticity cues for future Image Studio.",
    primaryUsage: "mood",
    allowedUsages: ["mood", "styling", "social_content", "image_campaign"],
  },
  {
    id: "board-milaene-campaign-shoot",
    name: "Milaene Campaign Shoot",
    description: "Campaign energy, lighting, and framing abstractions.",
    primaryUsage: "image_campaign",
    allowedUsages: ["image_campaign", "camera", "lighting", "environment"],
  },
  {
    id: "board-milaene-product-art",
    name: "Milaene Product Art",
    description: "Texture, silhouette, and color-mood cues for product art.",
    primaryUsage: "product_art",
    allowedUsages: ["product_art", "styling"],
  },
  {
    id: "board-milaene-social-media",
    name: "Milaene Social Media",
    description: "Social-media feeling and approachability abstractions.",
    primaryUsage: "social_content",
    allowedUsages: ["social_content", "mood", "persona_casting"],
  },
  {
    id: "board-milaene-lighting",
    name: "Milaene Lighting",
    description: "Softness, direction, temperature, and shadow-style language.",
    primaryUsage: "lighting",
    allowedUsages: ["lighting", "camera", "image_campaign", "persona_casting"],
  },
  {
    id: "board-milaene-locations",
    name: "Milaene Locations",
    description: "Environment type and surface materials — not location clones.",
    primaryUsage: "environment",
    allowedUsages: ["environment", "image_campaign", "video_campaign"],
  },
  {
    id: "board-milaene-poses",
    name: "Milaene Poses",
    description: "Pose families and body energy — never exact pose coordinates.",
    primaryUsage: "pose",
    allowedUsages: ["pose", "persona_casting", "image_campaign"],
  },
];

function buildBoard(seed: BoardSeed): ReferenceBoard {
  return {
    id: seed.id,
    workspaceId: SEED_WORKSPACE_ID,
    brandSlug: "milaene",
    name: seed.name,
    description: seed.description,
    primaryUsage: seed.primaryUsage,
    allowedUsages: seed.allowedUsages,
    assetIds: [],
    createdAt: SEED_UPDATED_AT,
    updatedAt: SEED_UPDATED_AT,
    version: "seed-1",
  };
}

export const MILAENE_REFERENCE_CATALOG_VERSION = "milaene-reference-seed-2026-07-21";

export const MILAENE_REFERENCE_CATALOG: ReferenceWorkspaceCatalog = {
  brandSlug: "milaene",
  workspaceId: SEED_WORKSPACE_ID,
  version: MILAENE_REFERENCE_CATALOG_VERSION,
  boards: MILAENE_BOARD_SEEDS.map(buildBoard),
  assets: [],
  descriptors: [],
  visionExtractionEnabled: false,
  updatedAt: SEED_UPDATED_AT,
};

export const REFERENCE_CATALOG_BY_SLUG: Record<string, ReferenceWorkspaceCatalog> =
  {
    milaene: MILAENE_REFERENCE_CATALOG,
  };

export function getReferenceCatalogForSlug(
  slug: string,
): ReferenceWorkspaceCatalog {
  return (
    REFERENCE_CATALOG_BY_SLUG[slug] ??
    REFERENCE_CATALOG_BY_SLUG[DEFAULT_REFERENCE_INTELLIGENCE_SLUG]!
  );
}

export function listReferenceCatalogSlugs(): string[] {
  return Object.keys(REFERENCE_CATALOG_BY_SLUG);
}

/** Deep-clone catalog so tests can register assets without mutating seed. */
export function cloneReferenceCatalog(
  catalog: ReferenceWorkspaceCatalog,
): ReferenceWorkspaceCatalog {
  return structuredClone(catalog);
}
