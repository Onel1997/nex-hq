import { NextResponse } from "next/server";
import { z } from "zod";

import { requireVideoEditorOwner, VideoEditorAuthorizationError } from "@/lib/video-editor-studio/authority";
import { VIDEO_EDITOR_ANALYSIS_BUDGET_MS, videoEditorSourceSchema } from "@/lib/video-editor-studio/contracts";
import { analyzeOwnedVideoEditorSource } from "@/lib/video-editor-studio/service";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({ source: videoEditorSourceSchema }).strict();

export async function POST(request: Request) {
  const deadlineAt = Date.now() + VIDEO_EDITOR_ANALYSIS_BUDGET_MS;
  try {
    const context = await requireVideoEditorOwner(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, code: "CLIP_INVALID", error: "Der Clip ist ungültig." }, { status: 400 });
    }
    const analysis = await analyzeOwnedVideoEditorSource({ context, source: parsed.data.source, deadlineAt });
    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    if (error instanceof VideoEditorAuthorizationError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, code: "CLIP_ANALYSIS_FAILED", error: "Für diesen Clip konnte kein automatischer Vorschlag erstellt werden." },
      { status: 422 },
    );
  }
}
