import { z } from "zod";

import type { CompositingProvenance } from "@/lib/image/artwork-compositing/types";
import type { ImageGenerationInputSnapshotV2 } from "@/lib/image/paid-generation/types-v2";

export const productionStageOutputSchema = z.object({
  stageOutputId: z.string().uuid(),
  jobId: z.string().uuid(),
  stage: z.enum(["BASE_GENERATION", "DETERMINISTIC_COMPOSITE"]),
  stageAttempt: z.number().int().positive(),
  status: z.enum(["SUCCEEDED", "FAILED"]),
  assetId: z.string().min(1).nullable(),
  storagePath: z.string().min(1).nullable(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  providerRequestId: z.string().min(1).nullable(),
  provenance: z.record(z.string(), z.unknown()),
  failureCode: z.string().min(1).nullable(),
  failureMessage: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
});

export type ProductionStageOutput = z.infer<typeof productionStageOutputSchema>;
export type SuccessfulBaseStage = ProductionStageOutput & {
  stage: "BASE_GENERATION";
  status: "SUCCEEDED";
  assetId: string;
  storagePath: string;
  checksumSha256: string;
};

export interface DeterministicAttemptDependencies {
  generateBase(snapshot: ImageGenerationInputSnapshotV2): Promise<SuccessfulBaseStage>;
  composite(input: {
    snapshot: ImageGenerationInputSnapshotV2;
    base: SuccessfulBaseStage;
  }): Promise<{
    assetId: string;
    storagePath: string;
    checksumSha256: string;
    provenance: CompositingProvenance;
  }>;
  persistStage(stage: ProductionStageOutput): Promise<void>;
  id(): string;
  now(): string;
}

export type DeterministicAttemptResult =
  | { status: "SUCCEEDED"; base: SuccessfulBaseStage; composite: ProductionStageOutput }
  | { status: "COMPOSITE_FAILED"; base: SuccessfulBaseStage; composite: ProductionStageOutput };

/**
 * Executes exactly one asset's two stages. A persisted successful base is a
 * hard retry boundary: compositing retries reuse it and never call the paid
 * provider again. Composite failure is returned, not converted into a new base.
 */
export async function runDeterministicAttempt(input: {
  jobId: string;
  snapshot: ImageGenerationInputSnapshotV2;
  existingBase?: SuccessfulBaseStage | null;
  compositeAttempt?: number;
  dependencies: DeterministicAttemptDependencies;
}): Promise<DeterministicAttemptResult> {
  const { snapshot, dependencies } = input;
  if (snapshot.productionMode !== "DETERMINISTIC_COMPOSITE") {
    throw new Error("Two-stage deterministic attempt requires DETERMINISTIC_COMPOSITE mode.");
  }
  if (snapshot.baseGeneration.assetCount !== 1) {
    throw new Error("One paid job must produce exactly one base asset.");
  }

  const base = input.existingBase ?? await dependencies.generateBase(snapshot);
  productionStageOutputSchema.parse(base);
  if (!input.existingBase) await dependencies.persistStage(base);

  try {
    const output = await dependencies.composite({ snapshot, base });
    const composite = productionStageOutputSchema.parse({
      stageOutputId: dependencies.id(),
      jobId: input.jobId,
      stage: "DETERMINISTIC_COMPOSITE",
      stageAttempt: input.compositeAttempt ?? 1,
      status: "SUCCEEDED",
      assetId: output.assetId,
      storagePath: output.storagePath,
      checksumSha256: output.checksumSha256,
      providerRequestId: null,
      provenance: output.provenance,
      failureCode: null,
      failureMessage: null,
      createdAt: dependencies.now(),
    });
    await dependencies.persistStage(composite);
    return { status: "SUCCEEDED", base, composite };
  } catch (error) {
    const composite = productionStageOutputSchema.parse({
      stageOutputId: dependencies.id(),
      jobId: input.jobId,
      stage: "DETERMINISTIC_COMPOSITE",
      stageAttempt: input.compositeAttempt ?? 1,
      status: "FAILED",
      assetId: null,
      storagePath: null,
      checksumSha256: null,
      providerRequestId: null,
      provenance: {
        retryBoundary: "REUSE_PERSISTED_BASE",
        automaticProviderRetry: false,
        baseStageOutputId: base.stageOutputId,
      },
      failureCode: "DETERMINISTIC_COMPOSITE_FAILED",
      failureMessage: error instanceof Error ? error.message : "Unknown composite failure",
      createdAt: dependencies.now(),
    });
    await dependencies.persistStage(composite);
    return { status: "COMPOSITE_FAILED", base, composite };
  }
}
