import { NextResponse } from "next/server";
import {
  generateImageAsset,
  ImageProviderNotConfiguredError,
} from "@/agents/image/generate";
import { imageGenerateRequestSchema } from "@/agents/image/types-generation";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.image.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = imageGenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.image.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();

    const result = await generateImageAsset({
      workspaceId: workspace.id,
      request: parsed.data,
    });

    console.info(`[Image Generate ${requestId}] Success`, {
      assetId: result.asset.id,
      provider: result.asset.provider,
      url: result.asset.imageUrl,
    });

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ImageProviderNotConfiguredError) {
      return NextResponse.json(
        {
          error: error.message,
          provider: error.provider,
          providerConfigured: false,
        },
        { status: 503 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.image.errors.unexpected;

    console.error(`[Image Generate ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
