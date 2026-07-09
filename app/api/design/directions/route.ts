import { NextResponse } from "next/server";
import { z } from "zod";
import { designStudioBriefSchema } from "@/agents/design/studio-brief";
import {
  generateDesignDirectionsFromResearch,
  regenerateDesignDirectionFromResearch,
} from "@/agents/design/generate-directions";
import { DesignDirectionsParseError } from "@/agents/design/parse-directions";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const conceptSchema = z.object({
  designId: z.string().min(1),
  title: z.string().min(1),
  collection: z.string().min(1),
  product: z.string().min(1),
  color: z.string().min(1),
  printArea: z.string().min(1),
  designStory: z.string().min(1),
  creativeDirection: z.object({
    summary: z.string().min(1),
    mood: z.string().min(1),
    emotion: z.string().min(1),
    collectionRole: z.string().min(1),
    visualIntent: z.string().min(1),
    fashionSystem: z.string().min(1),
  }),
  fashionLanguage: z.object({
    principles: z.array(z.string()),
    mood: z.string().optional(),
    garmentScale: z.string().optional(),
    luxurySignals: z.array(z.string()).optional(),
  }),
  typographyLanguage: z.object({
    direction: z.string().min(1),
    hierarchy: z.string().min(1),
    compositionShare: z.string().optional(),
  }),
  commercialIntention: z.object({
    buyerHook: z.string().min(1),
    role: z.string().optional(),
    priceBand: z.string().optional(),
    campaignPotential: z.string().optional(),
  }),
  confidence: z.number().optional(),
  generatedAt: z.string().optional(),
});

const generateRequestSchema = z.object({
  mode: z.literal("generate").optional(),
  reportId: z.string().uuid(),
  brief: designStudioBriefSchema,
  concept: conceptSchema.passthrough(),
  avoidTitles: z.array(z.string()).optional(),
});

const regenerateRequestSchema = z.object({
  mode: z.literal("regenerate"),
  reportId: z.string().uuid(),
  brief: designStudioBriefSchema,
  concept: conceptSchema.passthrough(),
  avoidTitles: z.array(z.string()).optional(),
  variantIndex: z.number().int().min(0).optional(),
});

const requestSchema = z.union([generateRequestSchema, regenerateRequestSchema]);

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: dict.design.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: dict.design.errors.openaiNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

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

    const { workspace } = await ensureWorkspaceBrainSeeded();
    const { reportId, brief, concept, avoidTitles } = parsed.data;
    const generationNonce = `${Date.now()}-${requestId}`;

    if (parsed.data.mode === "regenerate") {
      const direction = await regenerateDesignDirectionFromResearch(
        {
          workspaceId: workspace.id,
          reportId,
          brief,
          concept,
          avoidTitles,
          generationNonce,
        },
        workspace.name,
      );

      if (parsed.data.variantIndex != null) {
        direction.variantIndex = parsed.data.variantIndex;
      }

      console.info(`[Design Directions ${requestId}] Regenerated`, {
        title: direction.title,
        reportId,
      });

      return NextResponse.json({
        ok: true,
        direction,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await generateDesignDirectionsFromResearch(
      {
        workspaceId: workspace.id,
        reportId,
        brief,
        concept,
        avoidTitles,
        generationNonce,
      },
      workspace.name,
    );

    console.info(`[Design Directions ${requestId}] Generated`, {
      count: result.directions.length,
      reportId,
      researchContextUsed: result.researchContextUsed,
      titles: result.directions.map((d) => d.title),
    });

    return NextResponse.json({
      ok: true,
      directions: result.directions,
      researchContextUsed: result.researchContextUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof DesignDirectionsParseError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: "parse_error" },
        { status: 422 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.design.errors.unexpected;

    console.error(`[Design Directions ${requestId}] Failed`, { message });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
