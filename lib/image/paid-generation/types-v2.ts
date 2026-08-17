import { z } from "zod";

import { IMAGE_GENERATION_PROVIDERS } from "@/agents/image/types-generation";
import {
  imageGenerationInputSnapshotSchema,
  imageMasterArtworkSnapshotSchema,
} from "@/lib/image/paid-generation/types";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";
import { productVisualInputSchema } from "@/lib/product-library/product-reference-package";
import { productProductionBindingV2Schema } from "@/lib/product-library/types";

export const IMAGE_GENERATION_INPUT_VERSION_V2 = "image-generation-input-v2" as const;
export const IMAGE_PRODUCTION_MODES = [
  "DETERMINISTIC_COMPOSITE",
  "DRAFT_GENERATIVE_ARTWORK",
] as const;

export const baseImageGenerationSettingsSchema = z.object({
  provider: z.enum(IMAGE_GENERATION_PROVIDERS),
  model: z.string().min(1),
  dimensions: z.string().min(1),
  quality: z.enum(["low", "medium", "high", "auto"]),
  assetCount: z.literal(1),
  personaStrategy: z.literal("MASTER_IDENTITY_REFERENCE"),
  productStrategy: z.enum(["PRODUCT_REFERENCES_AND_METADATA", "PRODUCT_METADATA_ONLY"]),
  artworkStrategy: z.enum(["NO_MASTER_ARTWORK_INPUT", "SECONDARY_MASTER_ARTWORK_REFERENCE"]),
  prompt: z.string().min(1),
}).strict();

export const deterministicCompositingSettingsSchema = z.object({
  compositorVersion: z.literal("nexhq-deterministic-compositor-v1"),
  sampling: z.enum(["NEAREST_SOURCE_PIXEL", "BILINEAR_SOURCE_PIXEL"]),
  blending: z.enum(["SOURCE_OVER", "SOURCE_OVER_WITH_UNIFORM_SHADING"]),
  shadingFactor: z.number().min(0).max(1),
  automaticProviderRetryOnCompositeFailure: z.literal(false),
}).strict();

export const imageGenerationInputSnapshotV2Schema = z.object({
  version: z.literal(IMAGE_GENERATION_INPUT_VERSION_V2),
  productionMode: z.enum(IMAGE_PRODUCTION_MODES),
  workspaceId: z.string().uuid(),
  brandModel: brandModelTraceSchema.extend({
    displayName: z.string().min(1),
    masterIdentityAssetId: z.string().min(1),
  }),
  product: productProductionBindingV2Schema,
  productVisualInput: productVisualInputSchema,
  masterArtwork: imageMasterArtworkSnapshotSchema,
  printSurface: printSurfaceSchema,
  shot: z.object({
    assetId: z.string().min(1),
    assetType: z.string().min(1),
    title: z.string().min(1),
    scene: z.string().min(1),
    lighting: z.string().min(1),
    poseDirection: z.string().nullable(),
    campaignDirection: z.string().min(1),
  }).strict(),
  production: z.object({
    projectId: z.string().uuid(),
    projectVersion: z.number().int().positive(),
    reportRecordId: z.string().uuid(),
    reportId: z.string().uuid(),
  }).strict(),
  baseGeneration: baseImageGenerationSettingsSchema,
  compositing: deterministicCompositingSettingsSchema,
}).strict().superRefine((snapshot, ctx) => {
  if (
    snapshot.productionMode === "DETERMINISTIC_COMPOSITE" &&
    snapshot.baseGeneration.artworkStrategy !== "NO_MASTER_ARTWORK_INPUT"
  ) {
    ctx.addIssue({ code: "custom", path: ["baseGeneration", "artworkStrategy"], message: "Deterministic base generation cannot receive Master Artwork pixels." });
  }
  if (
    snapshot.productionMode === "DRAFT_GENERATIVE_ARTWORK" &&
    snapshot.baseGeneration.artworkStrategy !== "SECONDARY_MASTER_ARTWORK_REFERENCE"
  ) {
    ctx.addIssue({ code: "custom", path: ["baseGeneration", "artworkStrategy"], message: "Draft generative mode must be explicit about its Master Artwork conditioning reference." });
  }
  if (snapshot.product.authority === "SHOPIFY_LIVE" && snapshot.productVisualInput.authority !== "SHOPIFY_LIVE") {
    ctx.addIssue({ code: "custom", path: ["productVisualInput", "authority"], message: "Live Shopify production context requires a Shopify-live visual input." });
  }
  if (snapshot.product.productProfileId !== snapshot.productVisualInput.productProfileId) {
    ctx.addIssue({ code: "custom", path: ["productVisualInput", "productProfileId"], message: "Product visual input must bind the exact frozen Product profile." });
  }
  if (snapshot.product.shopifyProductId !== snapshot.productVisualInput.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["productVisualInput", "shopifyProductId"], message: "Product visual input must bind the exact frozen production product." });
  }
  if (snapshot.product.variantId !== snapshot.productVisualInput.variantId) {
    ctx.addIssue({ code: "custom", path: ["productVisualInput", "variantId"], message: "Product visual input must bind the exact frozen production variant." });
  }
  if (
    snapshot.baseGeneration.productStrategy === "PRODUCT_REFERENCES_AND_METADATA" &&
    snapshot.productVisualInput.referencePackage.references.length === 0
  ) {
    ctx.addIssue({ code: "custom", path: ["productVisualInput", "referencePackage", "references"], message: "Product-reference strategy requires at least one frozen reference." });
  }
  for (const [index, reference] of snapshot.productVisualInput.referencePackage.references.entries()) {
    if (!reference.contentChecksumSha256 || !reference.privateStoragePath) {
      ctx.addIssue({ code: "custom", path: ["productVisualInput", "referencePackage", "references", index], message: "Paid v2 inputs require checksummed private Product references frozen before confirmation." });
    }
  }
});

export type ImageGenerationInputSnapshotV2 = z.infer<typeof imageGenerationInputSnapshotV2Schema>;
export const anyImageGenerationInputSnapshotSchema = z.union([
  imageGenerationInputSnapshotSchema,
  imageGenerationInputSnapshotV2Schema,
]);
export type AnyImageGenerationInputSnapshot = z.infer<typeof anyImageGenerationInputSnapshotSchema>;

export const mockupReviewDimensionSchema = z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]);
export const mockupHumanReviewSchema = z.object({
  contractVersion: z.literal("mockup-human-review-v1"),
  overallStatus: z.enum(["REVIEW_REQUIRED", "APPROVED", "REJECTED"]),
  identity: mockupReviewDimensionSchema,
  productFidelity: mockupReviewDimensionSchema,
  artworkFidelityExact: mockupReviewDimensionSchema,
  placement: mockupReviewDimensionSchema,
  perspective: mockupReviewDimensionSchema,
  lightingIntegration: mockupReviewDimensionSchema,
  reviewedBy: z.string().min(1).nullable(),
  reviewedAt: z.string().datetime().nullable(),
  note: z.string().nullable(),
}).superRefine((review, ctx) => {
  if (review.overallStatus !== "REVIEW_REQUIRED" && (!review.reviewedBy || !review.reviewedAt)) {
    ctx.addIssue({ code: "custom", path: ["reviewedBy"], message: "Approval or rejection requires a human actor and timestamp." });
  }
});

export type MockupHumanReview = z.infer<typeof mockupHumanReviewSchema>;
