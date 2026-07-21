import type { ProductCatalog } from "@/lib/product-intelligence";
import { isProductTypeAllowed } from "@/lib/product-intelligence";
import type {
  ArchetypeRecommendation,
  BrandArchetype,
  BrandArchetypeCatalog,
  BrandArchetypePlatform,
  BrandArchetypeProductAffinity,
  CampaignRecommendationInput,
  VideoRecommendationInput,
} from "./types";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function getArchetypePlatformScore(
  archetype: BrandArchetype,
  platform: BrandArchetypePlatform,
): number {
  return archetype.platformScores[platform] ?? 50;
}

export function getProductAffinityForArchetype(
  archetype: BrandArchetype,
  catalog?: ProductCatalog,
): BrandArchetypeProductAffinity[] {
  if (!catalog) return archetype.productAffinity.slice();

  return archetype.productAffinity.map((affinity) => {
    // Role-based affinities (e.g. couple campaign) stay as direction.
    if (!affinity.productId) return affinity;
    const exists = catalog.products.some(
      (p) =>
        p.id === affinity.productId ||
        normalize(p.productType) === normalize(affinity.productType),
    );
    const allowed = isProductTypeAllowed(catalog, affinity.productType);
    if (exists && allowed) return affinity;
    return {
      ...affinity,
      rating: Math.min(affinity.rating, 2) as BrandArchetypeProductAffinity["rating"],
      reason: `${affinity.reason} (Product Intelligence: limited / unverified)`,
    };
  });
}

function scoreArchetypeForPlatform(
  archetype: BrandArchetype,
  platform: BrandArchetypePlatform,
  productHint?: string | null,
): { score: number; reasonParts: string[] } {
  let score = getArchetypePlatformScore(archetype, platform);
  const reasonParts: string[] = [
    `Base ${platform} score ${score}`,
  ];

  if (productHint) {
    const hint = normalize(productHint);
    const hit = archetype.productAffinity.find(
      (a) =>
        normalize(a.productType).includes(hint) ||
        hint.includes(normalize(a.productType)),
    );
    if (hit) {
      score += hit.rating;
      reasonParts.push(`Product affinity ${hit.productType} ★${hit.rating}`);
    }
  }

  return { score: Math.min(100, score), reasonParts };
}

export function recommendArchetypeForCampaign(
  catalog: BrandArchetypeCatalog,
  input: CampaignRecommendationInput,
): ArchetypeRecommendation[] {
  const active = catalog.archetypes.filter((a) => a.status === "active");
  const ranked = active
    .map((archetype) => {
      const { score, reasonParts } = scoreArchetypeForPlatform(
        archetype,
        input.platform,
        input.product,
      );
      return {
        archetypeId: archetype.id,
        archetypeSlug: archetype.slug,
        archetypeName: archetype.name,
        confidence: score,
        reason: reasonParts.join("; "),
        roles: archetype.roles,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || a.archetypeSlug.localeCompare(b.archetypeSlug));

  return ranked;
}

export function recommendArchetypeForVideo(
  catalog: BrandArchetypeCatalog,
  input: VideoRecommendationInput,
): ArchetypeRecommendation[] {
  return recommendArchetypeForCampaign(catalog, {
    platform: input.platform,
    product: input.product,
    audience: input.audience,
  });
}

export function bestArchetypeForPlatform(
  catalog: BrandArchetypeCatalog,
  platform: BrandArchetypePlatform,
): ArchetypeRecommendation | null {
  return recommendArchetypeForCampaign(catalog, { platform })[0] ?? null;
}
