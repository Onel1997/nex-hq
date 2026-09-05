import assert from "node:assert/strict";
import test from "node:test";

import type { XerianoAccountContext } from "@/lib/xeriano/access-policy";
import { VIDEO_EDITOR_CONTRACT_VERSION } from "./contracts";
import {
  createPreparingVideoEditorManifest,
  transitionVideoEditorManifest,
} from "./manifest";

const context: XerianoAccountContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "owner@example.test",
  role: "OWNER",
  accountId: "00000000-0000-4000-8000-000000000002",
  accountName: "Test",
  workspaceKey: "owner-workspace",
  brainWorkspaceId: null,
  source: "XERIANO_MEMBERSHIP",
  internalOwner: true,
};

function request() {
  return {
    contractVersion: VIDEO_EDITOR_CONTRACT_VERSION,
    jobId: "00000000-0000-4000-8000-000000000003",
    projectId: "00000000-0000-4000-8000-000000000004",
    title: "Reel",
    clips: [0, 1].map((order) => ({
      id: `00000000-0000-4000-8000-00000000001${order}`,
      source: { kind: "TEMP_REFERENCE" as const, id: `10000000-0000-4000-8000-00000000001${order}` },
      title: `Clip ${order}`,
      order,
      enabled: true,
      trimStartSeconds: 0,
      trimEndSeconds: 5,
      sourceDurationSeconds: 5,
    })),
    targetDurationSeconds: 15 as const,
    aspectRatio: "9:16" as const,
    resolution: "720x1280" as const,
    fps: 30 as const,
    tempo: "DYNAMIC" as const,
    preset: "STREETWEAR_PRODUCT_REEL" as const,
    keepOriginalAudio: false,
    music: null,
  };
}

test("local render states are isolated and terminal success cannot be downgraded", () => {
  const preparing = createPreparingVideoEditorManifest({ context, request: request(), now: "2026-09-04T12:00:00.000Z" });
  const rendering = transitionVideoEditorManifest(preparing, { status: "RENDERING", renderStartedAt: "2026-09-04T12:00:01.000Z" });
  const succeeded = transitionVideoEditorManifest(rendering, {
    status: "SUCCEEDED",
    completedAt: "2026-09-04T12:00:02.000Z",
    result: {
      id: "00000000-0000-4000-8000-000000000099",
      storagePath: "private/result.mp4",
      mimeType: "video/mp4",
      byteLength: 10,
      sha256: "a".repeat(64),
      durationSeconds: 10,
      width: 720,
      height: 1280,
      fps: 30,
      libraryAssetId: "00000000-0000-4000-8000-000000000098",
    },
  });
  const attemptedRegression = transitionVideoEditorManifest(succeeded, { status: "FAILED", error: { code: "RENDER_FAILED", message: "late" } });
  assert.equal(attemptedRegression.status, "SUCCEEDED");
  assert.equal(attemptedRegression.result?.libraryAssetId, "00000000-0000-4000-8000-000000000098");
});

test("failed local render retains immutable setup for an explicit later export", () => {
  const preparing = createPreparingVideoEditorManifest({ context, request: request(), now: "2026-09-04T12:00:00.000Z" });
  const failed = transitionVideoEditorManifest(preparing, {
    status: "FAILED",
    error: { code: "RENDER_FAILED", message: "Render fehlgeschlagen." },
  });
  assert.deepEqual(failed.setup, preparing.setup);
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.result, null);
});
