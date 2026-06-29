import { NextResponse } from "next/server";
import { z } from "zod";
import { designStudioBriefSchema } from "@/agents/design/studio-brief";
import { composeFromBrief } from "@/lib/design/design-library/composition";
import { runCommercialDesignReview } from "@/lib/design/commercial-design-director";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

const requestSchema = z.object({
  brief: designStudioBriefSchema,
  svg: z.string().optional(),
  variantIndex: z.number().int().min(0).optional(),
});

/** Standalone commercial design director critique — does not render graphics. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: dict.design.errors.invalidRequest, details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const spec = composeFromBrief(parsed.data.brief, {
      variantIndex: parsed.data.variantIndex ?? 0,
      forceRich: true,
    });

    const review = runCommercialDesignReview({
      brief: parsed.data.brief,
      spec,
      svg: parsed.data.svg ?? "",
      iteration: 1,
    });

    return NextResponse.json({
      ok: true,
      approved: review.approved,
      score: review.score,
      psychology: review.psychology,
      brandDna: review.brandDna,
      critique: review.critique,
      revisionTasks: review.revisionTasks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : dict.design.errors.unexpected;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
