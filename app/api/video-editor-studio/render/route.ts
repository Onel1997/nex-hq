import { after, NextResponse } from "next/server";

import {
  VIDEO_EDITOR_INVOCATION_BUDGET_MS,
  publicVideoEditorJob,
  videoEditorRenderRequestSchema,
} from "@/lib/video-editor-studio/contracts";
import { VideoEditorRenderLeaseError } from "@/lib/video-editor-studio/lease";
import { requireVideoEditorOwner, VideoEditorAuthorizationError } from "@/lib/video-editor-studio/authority";
import {
  createDurableVideoEditorJob,
  processVideoEditorJob,
} from "@/lib/video-editor-studio/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const deadlineAt = Date.now() + VIDEO_EDITOR_INVOCATION_BUDGET_MS;
  try {
    const context = await requireVideoEditorOwner(request);
    const parsed = videoEditorRenderRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, code: "VIDEO_EDITOR_SETUP_INVALID", error: "Der Schnitt ist noch nicht vollständig vorbereitet." },
        { status: 400 },
      );
    }
    const durable = await createDurableVideoEditorJob({ context, request: parsed.data });
    if (durable.created) {
      after(async () => {
        await processVideoEditorJob({ context, jobId: durable.manifest.jobId, deadlineAt }).catch((error) => {
          console.error("[xeriamo-video-editor] render task failed", {
            jobId: durable.manifest.jobId,
            error: error instanceof Error ? error.name : "unknown",
          });
        });
      });
    }
    return NextResponse.json(
      { success: true, job: publicVideoEditorJob(durable.manifest), reused: !durable.created },
      { status: durable.created ? 202 : 200 },
    );
  } catch (error) {
    if (error instanceof VideoEditorAuthorizationError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    if (error instanceof VideoEditorRenderLeaseError && error.code === "VIDEO_EDITOR_RENDER_ACTIVE") {
      return NextResponse.json(
        { success: false, code: error.code, error: "Es läuft bereits ein Export. Warte bitte, bis er abgeschlossen ist." },
        { status: 409 },
      );
    }
    const code = error instanceof Error && /SOURCE|CLIP|MUSIC|DUPLICATE|INPUT_TOTAL/.test(error.message)
      ? "VIDEO_EDITOR_SOURCE_INVALID"
      : "VIDEO_EDITOR_START_FAILED";
    return NextResponse.json(
      { success: false, code, error: code === "VIDEO_EDITOR_SOURCE_INVALID"
        ? error instanceof Error && error.message === "VIDEO_EDITOR_CLIP_TOO_LARGE"
          ? "Ein Video darf höchstens 100 MiB groß sein."
          : error instanceof Error && error.message === "VIDEO_EDITOR_MUSIC_TOO_LARGE"
            ? "Eine Musikdatei darf höchstens 15 MiB groß sein."
          : error instanceof Error && error.message === "VIDEO_EDITOR_INPUT_TOTAL_TOO_LARGE"
            ? "Alle ausgewählten Dateien dürfen zusammen höchstens 240 MiB groß sein."
            : "Mindestens ein Medium kann nicht verwendet werden."
        : "Der Export konnte nicht gestartet werden." },
      { status: code === "VIDEO_EDITOR_SOURCE_INVALID" ? 400 : 503 },
    );
  }
}
