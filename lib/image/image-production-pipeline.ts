import type { ImageStudioAsset } from "@/agents/image/types";
import {
  ImageOpenAiQuotaExceededError,
  OPENAI_QUOTA_ERROR_CODE,
  OPENAI_QUOTA_USER_MESSAGE,
} from "@/agents/image/generation-errors";
import { getOpenAiImageModel } from "@/lib/image/image-generation-config";
import {
  MISSION_ASSET_SLOTS,
  resolveMissionSlotAssets,
} from "@/lib/image/image-studio-assets";

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

type MissionQueueEntry = {
  slot: (typeof MISSION_ASSET_SLOTS)[number];
  asset: ImageStudioAsset;
};

let queueRunning = false;
let pipelineRunning = false;
let pipelineQueueAssets: ImageStudioAsset[] | null = null;
let currentAssetIndex = 0;

export function isProductionQueueRunning(): boolean {
  return queueRunning;
}

export function isProductionPipelineRunning(): boolean {
  return pipelineRunning;
}

function releasePipelineLocks(reason: string): void {
  if (queueRunning || pipelineRunning) {
    console.info("[Image Studio] releasePipelineLocks", {
      reason,
      queueRunning,
      pipelineRunning,
      currentAssetIndex,
    });
  }
  queueRunning = false;
  pipelineRunning = false;
  pipelineQueueAssets = null;
  currentAssetIndex = 0;
}

function isAssetPending(asset: ImageStudioAsset): boolean {
  return !asset.imageUrl && asset.status !== "completed";
}

function getPendingMissionQueue(assets: ImageStudioAsset[]): MissionQueueEntry[] {
  return resolveMissionSlotAssets(assets).filter(({ asset }) => isAssetPending(asset));
}

function countAssetsByState(assets: ImageStudioAsset[]): {
  pendingAssets: number;
  completedAssets: number;
} {
  const slotted = resolveMissionSlotAssets(assets).map(({ asset }) => asset);
  return {
    pendingAssets: slotted.filter((asset) => isAssetPending(asset)).length,
    completedAssets: slotted.filter(
      (asset) => Boolean(asset.imageUrl) || asset.status === "completed",
    ).length,
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
    currentAssetIndex,
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
    model: getOpenAiImageModel(),
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
    model: getOpenAiImageModel(),
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
      code?: string;
      requestId?: string;
      model?: string;
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
      code: data.code,
      requestId: data.requestId,
    });

    if (!res.ok) {
      if (res.status === 429 || data.code === OPENAI_QUOTA_ERROR_CODE) {
        console.error("[Image Studio] executeGeneration OpenAI quota exceeded", {
          assetId: generating.id,
          assetType: generating.assetType,
          model: data.model ?? getOpenAiImageModel(),
          httpStatus: res.status,
          requestId: data.requestId,
          responseBody: data,
          apiError: data.error,
          durationMs,
        });
        callbacks.onError(OPENAI_QUOTA_USER_MESSAGE);
        updateAssetStatus(generating, "pending", callbacks, {
          message: OPENAI_QUOTA_USER_MESSAGE,
        });
        throw new ImageOpenAiQuotaExceededError(OPENAI_QUOTA_USER_MESSAGE, {
          model: data.model ?? getOpenAiImageModel(),
          requestId: data.requestId,
          responseBody: data,
        });
      }

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
    if (error instanceof ImageOpenAiQuotaExceededError) {
      throw error;
    }

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

  const pendingAfterFinish = pipelineQueueAssets
    ? getPendingMissionQueue(
        pipelineQueueAssets.map((item) =>
          item.id === completed.id ? completed : item,
        ),
      )
    : [];
  const nextEntry = pendingAfterFinish[0];

  logAssetStage("finishAsset", asset, {
    nextStatus: completed.status,
    generationDurationMs: durationMs,
    hasImageUrl: Boolean(completed.imageUrl),
    nextAssetSelected: nextEntry?.asset.id ?? null,
    nextSlotId: nextEntry?.slot.id ?? null,
    remainingPending: pendingAfterFinish.length,
    currentAssetIndex,
    queueRunning,
    pipelineRunning,
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
    currentAssetIndex,
    nextStatus: "preparing",
    queueRunning,
    pipelineRunning,
  });

  prepareAsset(asset, slotId, callbacks);
  return executeGeneration(asset, project, callbacks);
}

async function drainMissionQueue(
  project: ImageProductionProject,
  initialAssets: ImageStudioAsset[],
  callbacks: ProductionPipelineCallbacks,
): Promise<number> {
  let workingAssets = [...initialAssets];
  let workingProject: ImageProductionProject = {
    ...project,
    productionAssets: workingAssets,
  };
  let processed = 0;

  pipelineQueueAssets = workingAssets;

  const initialPending = getPendingMissionQueue(workingAssets);
  logPipelineState(
    "queue.start",
    {
      queuedAssetsCount: initialPending.length,
      queuedAssetIds: initialPending.map(({ asset }) => asset.id),
      reportId: project.reportId,
      reportRecordId: project.reportRecordId,
    },
    workingAssets,
  );

  while (true) {
    const pending = getPendingMissionQueue(workingAssets);
    if (pending.length === 0) {
      logPipelineState(
        "queue.completed",
        {
          processed,
          currentAssetIndex,
        },
        workingAssets,
      );
      break;
    }

    const { slot, asset: queuedAsset } = pending[0]!;
    const asset =
      workingAssets.find((item) => item.id === queuedAsset.id) ?? queuedAsset;
    const nextAfterCurrent = pending[1]?.asset.id ?? null;

    currentAssetIndex = processed;
    logPipelineState(
      "queue.next",
      {
        currentIndex: currentAssetIndex,
        totalPending: pending.length,
        currentAssetId: asset.id,
        slotId: slot.id,
        nextAssetSelected: nextAfterCurrent,
      },
      workingAssets,
    );

    let updated: ImageStudioAsset | null = null;
    try {
      updated = await startNextAsset(
        slot.id,
        asset,
        workingProject,
        callbacks,
      );
    } catch (error) {
      if (error instanceof ImageOpenAiQuotaExceededError) {
        console.warn("[Image Studio] queue paused — OpenAI quota exceeded", {
          currentAssetId: asset.id,
          currentAssetIndex,
          model: error.model ?? getOpenAiImageModel(),
          requestId: error.requestId,
          responseBody: error.responseBody,
        });
        break;
      }
      throw error;
    }
    processed += 1;

    if (updated) {
      workingAssets = workingAssets.map((item) =>
        item.id === updated.id ? updated : item,
      );
      workingProject = {
        ...workingProject,
        productionAssets: workingAssets,
      };
      pipelineQueueAssets = workingAssets;
    }

    console.info("[Image Studio] queue.next finished", {
      currentAssetId: asset.id,
      processed,
      currentAssetIndex,
      updatedStatus: updated?.status ?? "null",
      remainingPending: getPendingMissionQueue(workingAssets).length,
      nextAssetSelected: getPendingMissionQueue(workingAssets)[0]?.asset.id ?? null,
      queueRunning,
      pipelineRunning,
    });
  }

  return processed;
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
    currentAssetIndex,
    hasProject: Boolean(project.reportId && project.reportRecordId),
    totalAssets: assets.length,
  });

  if (queueRunning && !pipelineRunning) {
    console.warn("[Image Studio] runProductionPipeline() recovering stale queue lock", {
      queueRunning,
      pipelineRunning,
      currentAssetIndex,
    });
    releasePipelineLocks("stale-queue-lock-recovery");
  }

  if (queueRunning || pipelineRunning) {
    console.warn("[Image Studio] runProductionPipeline() abort", {
      abortReason: "pipeline already marked running",
      queueRunning,
      pipelineRunning,
      currentAssetIndex,
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

  const initialPending = getPendingMissionQueue(assets);
  if (initialPending.length === 0) {
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

  try {
    processed = await drainMissionQueue(project, assets, callbacks);
    logPipelineState("runProductionPipeline() complete", { processed }, assets);
    return processed > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    console.error("[Image Studio] runProductionPipeline() abort", {
      abortReason: message,
      processed,
      currentAssetIndex,
      queueRunning,
      pipelineRunning,
    });
    callbacks.onError(message);
    return false;
  } finally {
    releasePipelineLocks("runProductionPipeline-finally");
    callbacks.onPipelineActive(false);
    logPipelineState("runProductionPipeline() finished", { processed, currentAssetIndex }, assets);
  }
}

/** Reset module queue lock — for tests only. */
export function resetProductionPipelineLock(): void {
  releasePipelineLocks("resetProductionPipelineLock");
}
