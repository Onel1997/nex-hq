import { NextResponse } from "next/server";
import { normalizeCeoReports } from "@/brain/repair/normalize-ceo-reports";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/**
 * POST /api/brain/repair-ceo-reports — scan and normalize CEO report metadata.
 * Optional query: ?slug=milaene&dryRun=1
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") ?? getActiveWorkspaceSlug();
    const dryRun = searchParams.get("dryRun") === "1";

    const { workspace } = await ensureWorkspaceBrainSeeded(slug);
    const { diagnostics, repairedCount } = await normalizeCeoReports({
      workspaceId: workspace.id,
      dryRun,
    });

    return NextResponse.json({
      workspaceId: workspace.id,
      slug: workspace.slug,
      ceoReportCount: diagnostics.length,
      repairedCount,
      dryRun,
      diagnostics,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CEO report repair failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
