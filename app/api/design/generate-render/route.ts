import { NextResponse } from "next/server";
import { runGenerateDesignRender } from "@/agents/design/generate-render";
import {
  designRenderRequestInputSchema,
  normalizeDesignRenderRequest,
} from "@/lib/design/render-request";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await request.json();
    console.info(`[Design Generate Render ${requestId}] Incoming payload`, body);

    const parsed = designRenderRequestInputSchema.safeParse(body);

    if (!parsed.success) {
      const validationIssues = parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        code: issue.code,
        message: issue.message,
        received: issue.path.reduce<unknown>((value, segment) => {
          if (value && typeof value === "object") {
            return (value as Record<string, unknown>)[String(segment)];
          }
          return undefined;
        }, body),
      }));

      console.error(
        `[Design Generate Render ${requestId}] Schema validation failed`,
        JSON.stringify(validationIssues, null, 2),
      );

      return NextResponse.json(
        {
          ok: false,
          error: dict.design.errors.invalidRequest,
          validationIssues,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const normalized = normalizeDesignRenderRequest(parsed.data);
    console.info(`[Design Generate Render ${requestId}] Normalized request`, normalized);

    const result = await runGenerateDesignRender(normalized);

    console.info(`[Design Generate Render ${requestId}] Success`, {
      designId: result.designId,
      promptLength: result.prompt.length,
    });

    return NextResponse.json({
      ok: true,
      imageUrl: result.imageUrl,
      renderUrl: result.imageUrl,
      url: result.imageUrl,
      designId: result.designId,
      prompt: result.prompt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.design.errors.unexpected;

    console.error(`[Design Generate Render ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
