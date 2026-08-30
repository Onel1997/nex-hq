import { z } from "zod";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { masterArtworkReferenceSchema } from "@/lib/design/master-artwork-authority/types";
import { semanticPlacementPresetSchema } from "@/lib/image/semantic-print-placement";
import { normalizedQuadSchema } from "@/lib/image/print-surface/types";
import { socialCreativeDirectionV1Schema } from "@/lib/image/social-creative-direction";
import { ownerArtworkPlacementSchema } from "@/lib/product-library/product-family";

export const prepareDeterministicJobRequestSchema = z
  .object({
    reportRecordId: z.string().uuid(),
    reportId: z.string().uuid(),
    assetId: z.string().min(1),
    brandModelTrace: brandModelTraceSchema,
    masterArtwork: z
      .object({ reference: masterArtworkReferenceSchema })
      .strict(),
    productProfile: z
      .object({
        profileKey: z.string().min(1),
        version: z.number().int().positive(),
        variantId: z.string().min(1),
      })
      .strict(),
    printSurface: z
      .object({
        printSurfaceId: z.string().min(1),
        version: z.number().int().positive(),
        authority: z
          .enum(["PRODUCT_PROFILE", "NEXHQ_PRODUCT_TEMPLATE"])
          .optional(),
        templateId: z.string().min(1).optional(),
        templateVersion: z.number().int().positive().optional(),
        ownerProfileKey: z.string().min(1).optional(),
        ownerProfileVersion: z.number().int().positive().optional(),
      })
      .strict(),
    semanticPlacement: z
      .object({
        printSide: z.enum(["FRONT", "BACK"]),
        placementPreset: semanticPlacementPresetSchema,
      })
      .strict()
      .optional(),
    productionOverride: z
      .object({
        basePrintSurfaceId: z.string().min(1),
        basePrintSurfaceVersion: z.number().int().positive(),
        quad: normalizedQuadSchema,
      })
      .strict()
      .optional(),
    ownerArtworkPlacement: ownerArtworkPlacementSchema.optional(),
    creativeDirection: socialCreativeDirectionV1Schema.optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      request.printSurface.authority === "NEXHQ_PRODUCT_TEMPLATE" &&
      (!request.printSurface.templateId ||
        !request.printSurface.templateVersion ||
        !request.semanticPlacement)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["printSurface"],
        message:
          "A NexHQ Product template requires exact template and semantic placement identity.",
      });
    }
    if (
      request.productionOverride &&
      (request.productionOverride.basePrintSurfaceId !==
        request.printSurface.printSurfaceId ||
        request.productionOverride.basePrintSurfaceVersion !==
          request.printSurface.version)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["productionOverride"],
        message:
          "Production fine tuning must bind the exact canonical PrintSurface version.",
      });
    }
  });
export type PrepareDeterministicJobRequest = z.infer<
  typeof prepareDeterministicJobRequestSchema
>;

export const deterministicJobActionSchema = z
  .object({
    action: z.enum([
      "confirm",
      "execute_real",
      "execute_fake",
      "retry_composite",
    ]),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
