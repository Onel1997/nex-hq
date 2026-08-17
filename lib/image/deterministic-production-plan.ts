import {
  IMAGE_SCHEMA_VERSION,
  imageOutputSchema,
  type ImageOutput,
  type ImageOutputCategory,
  type ImageStudioAssetType,
} from "@/agents/image/studio-schema";
import type { ImageBrandModelProductionContext } from "@/lib/image/brand-model-production-context";

export interface DeterministicImagePlanInput {
  brief: string;
  workspaceName: string;
  productName?: string;
  collectionName?: string;
  color?: string;
  material?: string;
  brandModelContext?: ImageBrandModelProductionContext;
}

const SHOTS: ReadonlyArray<{
  assetType: ImageStudioAssetType;
  outputCategory: ImageOutputCategory;
  title: string;
  location: string;
  lighting: string;
  photographyStyle: string;
  cameraStyle: string;
}> = [
  ["studio_shot", "product_photography", "Studio front", "Controlled neutral production studio", "Soft directional key with clean fill", "Realistic premium apparel product photography", "Eye-level medium full-body framing"],
  ["ecommerce_image", "product_photography", "E-commerce garment view", "Seamless neutral e-commerce studio", "Even color-accurate softbox lighting", "Color-accurate commercial apparel photography", "Straight-on product-led composition"],
  ["detail_shot", "product_photography", "Artwork detail", "Controlled close-detail studio setup", "Raking soft light revealing material texture", "High-fidelity garment and print detail photography", "Tight crop centered on approved artwork placement"],
  ["editorial_streetwear", "editorial_campaign", "Campaign environment", "Campaign-appropriate real-world environment", "Naturalistic cinematic directional light", "Editorial fashion campaign with realistic garment behavior", "Dynamic full-body environmental portrait"],
  ["lookbook_outfit", "lookbook", "Lookbook full look", "Minimal architectural lookbook setting", "Balanced daylight with subtle contrast", "Premium seasonal fashion lookbook photography", "Full-look portrait with clear silhouette"],
  ["hero_image", "launch_assets", "Launch hero", "Campaign hero environment with negative space", "Cinematic hero light with controlled highlights", "Premium launch key visual grounded in photographic realism", "Wide hero composition with adaptable crop space"],
].map(([assetType, outputCategory, title, location, lighting, photographyStyle, cameraStyle]) => ({
  assetType: assetType as ImageStudioAssetType,
  outputCategory: outputCategory as ImageOutputCategory,
  title,
  location,
  lighting,
  photographyStyle,
  cameraStyle,
}));

function normalized(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

/** Builds a reviewable shot plan without calling a model or paid provider. */
export function createDeterministicImageProductionPlan(
  input: DeterministicImagePlanInput,
): ImageOutput {
  const productName = normalized(input.productName, "Selected product");
  const collectionName = normalized(input.collectionName, "Current collection");
  const color = normalized(input.color, "As selected in production context");
  const material = normalized(input.material, "As selected in production context");
  const brief = input.brief.trim();
  const identityRule = input.brandModelContext
    ? `Preserve the exact approved Brand Model identity locked at version ${input.brandModelContext.trace.identityLockVersion}.`
    : "Use only an eligible approved Brand Model selected before paid preparation.";
  const productionAssets = SHOTS.flatMap((shot, shotIndex) =>
    ["primary", "alternate", "crop"].map((variation, variationIndex) => {
      const shared = `${identityRule} Show ${productName} in ${color}, made from ${material}. Apply the approved Master Artwork exactly as supplied: do not redesign, restyle, rewrite, add, remove, or replace any part. ${brief}`;
      return {
        id: `shot-${shotIndex + 1}-${variation}`,
        assetType: shot.assetType,
        outputCategory: shot.outputCategory,
        productName,
        collection: collectionName,
        color,
        material,
        location: shot.location,
        lighting: shot.lighting,
        photographyStyle: shot.photographyStyle,
        cameraStyle: `${shot.cameraStyle}; ${variation} variation`,
        prompt: {
          openai: `${shared} Create the ${shot.title.toLowerCase()} ${variation} composition. Preserve garment construction, artwork placement, print colors, human anatomy, and photographic realism.`,
          midjourney: `${shared} Plan the ${shot.title.toLowerCase()} ${variation} composition with realistic apparel construction, exact artwork placement, coherent anatomy, and production-grade detail.`,
          flux: `${shared} Render the ${shot.title.toLowerCase()} ${variation} composition while preserving exact identity, garment construction, artwork content, placement, colors, and realistic material behavior.`,
        },
        priority: variationIndex === 0 ? (shotIndex === 5 ? "hero" as const : "core" as const) : "support" as const,
        status: "pending" as const,
        title: `${shot.title} — ${variation}`,
        ...(input.brandModelContext ? { brandModelTrace: input.brandModelContext.trace } : {}),
      };
    }),
  );

  return imageOutputSchema.parse({
    title: `${collectionName} Image Production Plan`,
    reportType: "image-project",
    schemaVersion: IMAGE_SCHEMA_VERSION,
    projectName: `${collectionName} — ${productName}`,
    collectionName,
    visualDirection: `A deterministic, owner-reviewable production plan for ${productName}. Campaign direction: ${brief}. Exact Persona, approved Master Artwork, product authority, and provider inputs are frozen only during paid-job preparation.`,
    moodboard: {
      visualDirection: `Photographic production centered on the exact approved garment artwork and selected Brand Model, using owner direction: ${brief}`,
      aestheticKeywords: ["photographic realism", "garment fidelity", "identity continuity"],
      colorSystem: [color, "neutral production background"],
      materialReferences: [material, "realistic textile behavior"],
      photographyStyle: "Premium commercial fashion photography with reviewable, repeatable shot intent",
    },
    palette: { primary: "Production black #111111", secondary: "Neutral grey #777777", accent: "Review amber #C58B00", background: "Studio white #F5F5F3", text: "Near black #171717" },
    productionAssets,
    lookbookShots: SHOTS.slice(0, 4).map((shot) => ({
      shotName: shot.title,
      models: input.brandModelContext?.contract.displayName ?? "Selected approved Brand Model",
      location: shot.location,
      outfitProducts: [productName],
      styling: `Keep ${productName} and the approved artwork visually dominant; use production context rather than invented variant details.`,
      purpose: `Owner-reviewable ${shot.outputCategory.replaceAll("_", " ")} production shot.`,
    })),
    confidence: 1,
    sourceReportTitles: ["Owner campaign direction (deterministic planning)"],
    fullProject: `# ${collectionName} Image Production Plan\n\n## Authority\nThis is a deterministic shot plan, not generated artwork. It does not approve a Persona, artwork, product variant, or output. Paid preparation must resolve and freeze the exact approved Brand Model identity lock, durable Design-owned Master Artwork version/checksum, and typed product production context.\n\n## Direction\n${brief}\n\n## Product\n- Product: ${productName}\n- Collection: ${collectionName}\n- Color: ${color}\n- Material: ${material}\n\n## Shot plan\n${SHOTS.map((shot, index) => `${index + 1}. ${shot.title}: ${shot.location}; ${shot.lighting}; ${shot.cameraStyle}.`).join("\n")}\n\n## Fidelity rules\nThe approved Master Artwork remains canonical and must not be redesigned. Persona identity remains locked while pose and scene may change. Exact Shopify variant claims are permitted only after live server-side resolution. Every provider output requires human review and is never auto-approved.`,
  });
}
