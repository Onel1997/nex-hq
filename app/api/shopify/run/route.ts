import { NextResponse } from "next/server";
import { z } from "zod";
import { runShopify, ShopifyKnowledgeError } from "@/agents/shopify";
import { ShopifyParseError } from "@/agents/shopify/parse-output";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveOriginTaskId } from "@/lib/tasks/resolve-origin-task";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const shopifyRequestSchema = z.object({
  brief: z.string().min(3).max(4000),
  taskId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[Shopify Run ${requestId}] Incoming request`);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.shopify.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: dict.shopify.errors.openaiNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = shopifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.shopify.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();
    const originTaskId = await resolveOriginTaskId(parsed.data.taskId);

    const result = await runShopify({
      brief: parsed.data.brief,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      originTaskId,
    });

    console.info(`[Shopify Run ${requestId}] Success`, {
      reportId: result.reportId,
      contextRecordCount: result.contextRecordCount,
    });

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    if (error instanceof ShopifyKnowledgeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    if (error instanceof ShopifyParseError) {
      console.error(`[Shopify Run ${requestId}] Parse error`, error.toLogPayload());
      console.error(
        `[Shopify Run ${requestId}] Validation issues:`,
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error(
        `[Shopify Run ${requestId}] Detailed:\n${error.toDetailedMessage()}`,
      );
      return NextResponse.json(
        {
          error: error.message,
          validationIssues: error.validationIssues,
          missingFields: error.missingFields,
          receivedKeys: error.receivedKeys,
          parsedPreview: error.parsed,
        },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.shopify.errors.unexpected;

    console.error(`[Shopify Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
