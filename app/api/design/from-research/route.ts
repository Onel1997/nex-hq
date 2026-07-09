import { NextResponse } from "next/server";
import { z } from "zod";
import {
  handoffResearchToDesignStudio,
  ResearchHandoffError,
} from "@/agents/design/research-handoff";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const singleDesignRequestSchema = z.object({
  reportId: z.string().uuid(),
  designId: z.string().min(1),
});

const allDesignsRequestSchema = z.object({
  reportId: z.string().uuid(),
  mode: z.literal("all"),
});

const reportHandoffRequestSchema = z.object({
  reportId: z.string().uuid(),
});

const handoffRequestSchema = z.union([
  singleDesignRequestSchema,
  allDesignsRequestSchema,
  reportHandoffRequestSchema,
]);

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.design.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = handoffRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request — provide reportId, reportId + designId, or reportId + mode: \"all\"",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();

    const result = await handoffResearchToDesignStudio({
      reportId: parsed.data.reportId,
      designId: "designId" in parsed.data ? parsed.data.designId : undefined,
      mode: "mode" in parsed.data ? parsed.data.mode : undefined,
      workspaceId: workspace.id,
    });

    console.info(`[Design From Research ${requestId}] Success`, {
      reportId: result.reportId,
      briefCount: result.briefs.length,
    });

    if ("mode" in parsed.data && parsed.data.mode === "all") {
      return NextResponse.json({
        ok: true,
        reportId: result.reportId,
        brainRecordId: result.brainRecordId,
        reportTitle: result.reportTitle,
        collectionName: result.collectionName,
        intelligenceContext: result.intelligenceContext,
        briefs: result.briefs,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      reportId: result.reportId,
      brainRecordId: result.brainRecordId,
      reportTitle: result.reportTitle,
      collectionName: result.collectionName,
      intelligenceContext: result.intelligenceContext,
      brief: result.briefs[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ResearchHandoffError) {
      const status =
        error.code === "invalid_request"
          ? 400
          : error.code === "design_not_found" || error.code === "report_not_found"
            ? 404
            : 422;

      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.design.errors.unexpected;

    console.error(`[Design From Research ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
