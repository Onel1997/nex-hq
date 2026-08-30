import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { VideoAsset, VideoJob, VideoProject } from "./types";
export interface VideoRepository {
  createProject(
    scope: WorkspaceScope & { actorId: string },
    project: VideoProject,
  ): Promise<VideoProject>;
  getProject(scope: WorkspaceScope, id: string): Promise<VideoProject | null>;
  createJob(
    scope: WorkspaceScope & { actorId: string },
    job: VideoJob,
  ): Promise<VideoJob>;
  getJob(scope: WorkspaceScope, id: string): Promise<VideoJob | null>;
  listJobs(scope: WorkspaceScope, limit?: number): Promise<VideoJob[]>;
  getAssetsByJobs?(
    scope: WorkspaceScope,
    jobIds: readonly string[],
  ): Promise<Map<string, VideoAsset>>;
  confirm(
    scope: WorkspaceScope & { actorId: string },
    id: string,
    fingerprint: string,
    now: string,
  ): Promise<VideoJob>;
  cancel(
    scope: WorkspaceScope & { actorId: string },
    id: string,
    now: string,
  ): Promise<VideoJob>;
  claim(
    scope: WorkspaceScope,
    id: string,
    fingerprint: string,
    now: string,
  ): Promise<VideoJob | null>;
  markUnknown(
    scope: WorkspaceScope,
    id: string,
    reason: string,
    now: string,
  ): Promise<VideoJob>;
  finish(
    scope: WorkspaceScope,
    jobId: string,
    asset: VideoAsset,
    now: string,
  ): Promise<{ job: VideoJob; asset: VideoAsset }>;
  fail(
    scope: WorkspaceScope,
    id: string,
    code: string,
    message: string,
    safeRetry: boolean,
    now: string,
  ): Promise<VideoJob>;
  getAssetByJob(
    scope: WorkspaceScope,
    jobId: string,
  ): Promise<VideoAsset | null>;
  review(
    scope: WorkspaceScope & { actorId: string },
    assetId: string,
    input: {
      decision: "APPROVED" | "REJECTED";
      checklist: NonNullable<VideoAsset["reviewChecklist"]>;
      note: string | null;
    },
    now: string,
  ): Promise<VideoAsset>;
}
