import type { XerianoAccountContext } from "@/lib/xeriano/access-policy";
import {
  VIDEO_EDITOR_CONTRACT_VERSION,
  type VideoEditorManifest,
  type VideoEditorRenderRequest,
} from "./contracts";

export function createPreparingVideoEditorManifest(input: {
  context: XerianoAccountContext;
  request: VideoEditorRenderRequest;
  now?: string;
}): VideoEditorManifest {
  const now = input.now ?? new Date().toISOString();
  const { jobId, projectId, contractVersion: _contractVersion, ...setup } = input.request;
  void _contractVersion;
  return {
    version: VIDEO_EDITOR_CONTRACT_VERSION,
    jobId,
    projectId,
    accountId: input.context.accountId,
    workspaceId: input.context.workspaceKey,
    actorId: input.context.userId,
    status: "PREPARING",
    setup,
    createdAt: now,
    updatedAt: now,
    renderStartedAt: null,
    completedAt: null,
    failedClipIds: [],
    result: null,
    error: null,
  };
}

export function transitionVideoEditorManifest(
  current: VideoEditorManifest,
  update: Partial<VideoEditorManifest> & Pick<VideoEditorManifest, "status">,
): VideoEditorManifest {
  if (["SUCCEEDED", "FAILED"].includes(current.status)) return current;
  const allowed =
    (current.status === "PREPARING" && ["PREPARING", "RENDERING", "FAILED"].includes(update.status)) ||
    (current.status === "RENDERING" && ["RENDERING", "SUCCEEDED", "FAILED"].includes(update.status));
  if (!allowed) throw new Error("VIDEO_EDITOR_STATUS_REGRESSION");
  return {
    ...current,
    ...update,
    jobId: current.jobId,
    projectId: current.projectId,
    accountId: current.accountId,
    workspaceId: current.workspaceId,
    actorId: current.actorId,
    setup: current.setup,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

