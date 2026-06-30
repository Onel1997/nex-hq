import type { ImageStudioAsset } from "@/agents/image/types";
import { OPENAI_IMAGE_MODEL } from "@/agents/image/providers/openai-images-provider";
import { queuedAssetsForPipeline, resolveMissionSlotAssets } from "@/lib/image/image-studio-assets";

export interface ImageProductionProject {
  reportId: string;
  reportRecordId: string;
  projectName: string;
  productionAssets: ImageStudioAsset[];
}

export interface ProductionPipelineCallbacks {
  onPreparingAsset: (assetId: string, slotId: string) => void;
  onGeneratingAsset: (assetId: string) => void;
  onAssetUpdated: (asset: ImageStudioAsset) => void;
  onPipelineActive: (active: boolean) => void;
  onError: (message: string) => void;
}

let queueRunning = false;
let pipelineRunning = false;

export function isProductionQueueRunning(): boolean {
  return queueRunning;
}

export function isProductionPipelineRunning(): boolean {
  return pipelineRunning;
}

function countAssetsByState(assets: ImageStudioAsset[]): {
  pendingAssets: number;
  completedAssets: number;
} {
  const slotted = resolveMissionSlotAssets(assets).map(({ asset }) => asset);
  return {
    pendingAssets: slotted.filter((asset) => !asset.imageUrl && asset.status !== "completed").length,
    completedAssets: slotted.filter((asset) => Boolean(asset.imageUrl) || asset.status === "completed").length,
  };
}

function logPipelineState(
  stage: string,
  extra: Record<string, unknown> = {},
  assets: ImageStudioAsset[] = [],
): void {
  const { pendingAssets, completedAssets } = countAssetsByState(assets);
  console.info(`[Image Studio] ${stage}`, {
    queueRunning,
    pipelineRunning,
    pendingAssets,
    completedAssets,
    ...extra,
  });
}

function logAssetStage(
  stage: string,
  asset: ImageStudioAsset,
  extra: Record<string, unknown> = {},
): void {
  console.info(`[Image Studio] ${stage}`, {
    assetId: asset.id,
    assetType: asset.assetType,
    currentStatus: asset.status,
    title: asset.title,
    ...extra,
  });
}

export function generatePrompt(asset: ImageStudioAsset): {
  prompt: string;
  promptLength: number;
  variant: "openai";
} {
  const prompt = asset.prompt?.openai?.trim() ?? "";
  logAssetStage("generatePrompt", asset, {
    promptLength: prompt.length,
    model: OPENAI_IMAGE_MODEL,
    nextStatus: prompt.length >= 3 ? "generating" : "failed",
  });
  return { prompt, promptLength: prompt.length, variant: "openai" };
}

export function updateAssetStatus(
  asset: ImageStudioAsset,
  status: ImageStudioAsset["status"],
  callbacks: Pick<ProductionPipelineCallbacks, "onAssetUpdated">,
  patch: Partial<ImageStudioAsset> = {},
): ImageStudioAsset {
  const updated: ImageStudioAsset = { ...asset, status, ...patch };
  logAssetStage("updateAssetStatus", asset, {
    nextStatus: status,
    patchKeys: Object.keys(patch),
  });
  callbacks.onAssetUpdated(updated);
  return updated;
}

export function prepareAsset(
  asset: ImageStudioAsset,
  slotId: string,
  callbacks: ProductionPipelineCallbacks,
): ImageStudioAsset {
  logAssetStage("prepareAsset", asset, {
    slotId,
    nextStatus: "preparing",
  });
  callbacks.onPreparingAsset(asset.id, slotId);
  return updateAssetStatus(asset, asset.status ?? "pending", callbacks);
}

export async function executeGeneration(
  asset: ImageStudioAsset,
  project: ImageProductionProject,
  callbacks: ProductionPipelineCallbacks,
): Promise<ImageStudioAsset | null> {
  const startedAt = performance.now();
  const { promptLength, variant } = generatePrompt(asset);

  if (promptLength < 3) {
    const message = "Asset prompt is empty — cannot generate";
    console.error("[Image Studio] executeGeneration aborted", {
      assetId: asset.id,
      assetType: asset.assetType,
      promptLength,
      apiError: message,
    });
    callbacks.onError(message);
    return updateAssetStatus(asset, "failed", callbacks, { message });
  }

  logAssetStage("executeGeneration", asset, {
    promptLength,
    model: OPENAI_IMAGE_MODEL,
    nextStatus: "generating",
    apiRequestStart: new Date().toISOString(),
  });

  callbacks.onGeneratingAsset(asset.id);
  const generating = updateAssetStatus(asset, "generating", callbacks);

  try {
    const res = await fetch("/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportRecordId: project.reportRecordId,
        reportId: project.reportId,
        assetId: generating.id,
        provider: "openai",
        promptVariant: variant,
      }),
    });

    const data = (await res.json()) as {
      asset?: ImageStudioAsset;
      error?: string;
    };
    const durationMs = Math.round(performance.now() - startedAt);

    console.info("[Image Studio] executeGeneration API response", {
      assetId: generating.id,
      assetType: generating.assetType,
      ok: res.ok,
      status: res.status,
      durationMs,
      apiError: res.ok ? undefined : data.error,
      hasImageUrl: Boolean(data.asset?.imageUrl),
    });

    if (!res.ok) {
      throw new Error(data.error ?? `Generation failed (${res.status})`);
    }

    if (!data.asset) {
      throw new Error("Generation response missing asset payload");
    }

    return finishAsset(
      generating,
      {
        status: (data.asset.status === "ready" ? "completed" : data.asset.status) as ImageStudioAsset["status"],
        imageUrl: data.asset.imageUrl,
        createdAt: data.asset.createdAt,
      },
      callbacks,
      durationMs,
    );
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : "Generation failed";
    console.error("[Image Studio] executeGeneration API error", {
      assetId: generating.id,
      assetType: generating.assetType,
      durationMs,
      apiError: message,
    });
    callbacks.onError(message);
    return updateAssetStatus(generating, "failed", callbacks, { message });
  }
}

export function finishAsset(
  asset: ImageStudioAsset,
  result: Partial<ImageStudioAsset>,
  callbacks: ProductionPipelineCallbacks,
  durationMs?: number,
): ImageStudioAsset {
  const completed: ImageStudioAsset = {
    ...asset,
    ...result,
    status: result.status ?? "completed",
  };
  logAssetStage("finishAsset", asset, {
    nextStatus: completed.status,
    generationDurationMs: durationMs,
    hasImageUrl: Boolean(completed.imageUrl),
  });
  callbacks.onAssetUpdated(completed);
  return completed;
}

export async function startNextAsset(
  slotId: string,
  asset: ImageStudioAsset,
  project: ImageProductionProject,
  callbacks: ProductionPipelineCallbacks,
): Promise<ImageStudioAsset | null> {
  console.info("[Image Studio] startNextAsset", {
    assetId: asset.id,
    assetType: asset.assetType,
    slotId,
    currentStatus: asset.status,
    nextStatus: "preparing",
    queueRunning,
    pipelineRunning,
  });

  prepareAsset(asset, slotId, callbacks);
  return executeGeneration(asset, project, callbacks);
}

export async function runProductionPipeline(
  project: ImageProductionProject,
  assets: ImageStudioAsset[],
  callbacks: ProductionPipelineCallbacks,
): Promise<boolean> {
  console.info("[Image Studio] runProductionPipeline()", {
    invoked: true,
    queueRunning,
    pipelineRunning,
    hasProject: Boolean(project.reportId && project.reportRecordId),
    totalAssets: assets.length,
  });

  if (queueRunning) {
    console.warn("[Image Studio] runProductionPipeline() abort", {
      abortReason: "queueRunning already true",
      queueRunning,
      pipelineRunning,
    });
    return false;
  }

  if (!project.reportId || !project.reportRecordId) {
    console.warn("[Image Studio] runProductionPipeline() abort", {
      abortReason: "missing project ids",
      reportId: project.reportId,
      reportRecordId: project.reportRecordId,
    });
    return false;
  }

  const queue = resolveMissionSlotAssets(assets).filter(
    ({ asset }) => !asset.imageUrl && asset.status !== "completed",
  );

  logPipelineState(
    "queue.start()",
    {
      queuedAssetsCount: queue.length,
      queuedAssetIds: queue.map(({ asset }) => asset.id),
      reportId: project.reportId,
      reportRecordId: project.reportRecordId,
    },
    assets,
  );

  if (queue.length === 0) {
    console.warn("[Image Studio] runProductionPipeline() abort", {
      abortReason: "queuedAssets.length === 0",
      totalAssets: assets.length,
      slottedAssets: resolveMissionSlotAssets(assets).length,
    });
    return false;
  }

  queueRunning = true;
  pipelineRunning = true;
  callbacks.onPipelineActive(true);

  let processed = 0;
  let currentIndex = 0;

  try {
    for (const { slot, asset } of queue) {
      currentIndex = processed;
      const activeAsset = asset.id;

      logPipelineState(
        "queue.next()",
        {
          currentIndex,
          total: queue.length,
          currentAssetId: asset.id,
          activeAsset,
          slotId: slot.id,
        },
        assets,
      );

      const updated = await startNextAsset(slot.id, asset, project, callbacks);
      processed += 1;

      if (updated) {
        assets = assets.map((item) => (item.id === updated.id ? updated : item));
      }

      if (!updated || updated.status === "failed") {
        console.warn("[Image Studio] queue.next() asset failed — continuing", {
          assetId: asset.id,
          status: updated?.status ?? "null",
          currentIndex,
        });
        continue;
      }
    }

    logPipelineState("runProductionPipeline() complete", { processed }, assets);
    return processed > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    console.error("[Image Studio] runProductionPipeline() abort", {
      abortReason: message,
      processed,
      currentIndex,
    });
    callbacks.onError(message);
    return false;
  } finally {
    queueRunning = false;
    pipelineRunning = false;
    callbacks.onPipelineActive(false);
    logPipelineState("runProductionPipeline() finished", { processed, currentIndex }, assets);
  }
}

/** Reset module queue lock — for tests only. */
export function resetProductionPipelineLock(): void {
  queueRunning = false;
  pipelineRunning = false;
}
