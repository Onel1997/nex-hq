import { NextResponse } from "next/server";
import { runGenerateMasterArtwork } from "@/agents/design/generate-master-artwork";
import {
  masterArtworkRequestSchema,
  normalizeMasterArtworkRequest,
} from "@/lib/design/master-artwork-request";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await request.json();
    console.info(`[Design Generate Master Artwork ${requestId}] Incoming payload`, {
      designId: body?.brief?.designId,
      hasConcept: Boolean(body?.concept),
    });

    const parsed = masterArtworkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: dict.design.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const normalized = normalizeMasterArtworkRequest(parsed.data);
    const result = await runGenerateMasterArtwork(normalized);

    console.info(`[Design Generate Master Artwork ${requestId}] Success`, {
      designId: normalized.brief.designId,
      score: result.commercialReview.score,
      approved: result.commercialReview.approved,
      generationMode: result.generationMode,
      sourceType: result.sourceType,
      textSafe: result.vectorArtwork?.typographyValidation.textSafe,
      svgLength: result.svgString?.length,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      commercialReview: {
        approved: result.commercialReview.approved,
        iterations: result.commercialReview.iterations,
        score: { overall: result.commercialReview.score },
        critique: result.commercialReview.critique,
        revisionTasks: result.commercialReview.revisionTasks,
        imageStudioBlueprint: result.commercialReview.imageStudioBlueprint,
        psychology: result.commercialReview.psychology,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.design.errors.unexpected;

    console.error(`[Design Generate Master Artwork ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
