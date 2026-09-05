import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { VIDEO_EDITOR_RENDER_LEASE_MS } from "./contracts";

export class VideoEditorRenderLeaseError extends Error {
  constructor(readonly code: "VIDEO_EDITOR_RENDER_ACTIVE" | "VIDEO_EDITOR_LEASE_UNAVAILABLE") {
    super(code);
    this.name = "VideoEditorRenderLeaseError";
  }
}

export type VideoEditorLeaseAcquireResult = "ACQUIRED" | "HELD_BY_JOB";

export interface VideoEditorRenderLeaseStore {
  acquire(input: { context: XerianoAccountContext; jobId: string; now?: Date }): Promise<VideoEditorLeaseAcquireResult>;
  release(input: { context: XerianoAccountContext; jobId: string }): Promise<void>;
}

export class SupabaseVideoEditorRenderLeaseStore implements VideoEditorRenderLeaseStore {
  async acquire(input: { context: XerianoAccountContext; jobId: string; now?: Date }) {
    const now = input.now ?? new Date();
    const admin = createAdminClient();
    const expired = await admin.from("xeriano_video_editor_render_leases")
      .delete()
      .eq("account_id", input.context.accountId)
      .eq("actor_user_id", input.context.userId)
      .lte("expires_at", now.toISOString());
    if (expired.error) throw new VideoEditorRenderLeaseError("VIDEO_EDITOR_LEASE_UNAVAILABLE");

    const inserted = await admin.from("xeriano_video_editor_render_leases").insert({
      account_id: input.context.accountId,
      actor_user_id: input.context.userId,
      job_id: input.jobId,
      acquired_at: now.toISOString(),
      expires_at: new Date(now.getTime() + VIDEO_EDITOR_RENDER_LEASE_MS).toISOString(),
    });
    if (!inserted.error) return "ACQUIRED" as const;

    const existing = await admin.from("xeriano_video_editor_render_leases")
      .select("job_id,expires_at")
      .eq("account_id", input.context.accountId)
      .eq("actor_user_id", input.context.userId)
      .maybeSingle();
    if (existing.error) throw new VideoEditorRenderLeaseError("VIDEO_EDITOR_LEASE_UNAVAILABLE");
    if (existing.data?.job_id === input.jobId && Date.parse(existing.data.expires_at) > now.getTime()) {
      return "HELD_BY_JOB" as const;
    }
    throw new VideoEditorRenderLeaseError("VIDEO_EDITOR_RENDER_ACTIVE");
  }

  async release(input: { context: XerianoAccountContext; jobId: string }) {
    const removed = await createAdminClient().from("xeriano_video_editor_render_leases")
      .delete()
      .eq("account_id", input.context.accountId)
      .eq("actor_user_id", input.context.userId)
      .eq("job_id", input.jobId);
    if (removed.error) throw new VideoEditorRenderLeaseError("VIDEO_EDITOR_LEASE_UNAVAILABLE");
  }
}
