import { NextResponse } from "next/server";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/**
 * POST /api/brain/seed — idempotent workspace Brain seeding.
 * Optional query: ?slug=nex-trends
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
    const result = await ensureWorkspaceBrainSeeded(slug);

    return NextResponse.json({
      workspaceId: result.workspace.id,
      slug: result.workspace.slug,
      seeded: result.seeded,
      message: result.seeded
        ? "Brain seeded with starter records."
        : "Brain already seeded — no changes made.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
