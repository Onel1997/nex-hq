import { NextResponse } from "next/server";
import { ensureMilaeneBrainSeeded } from "@/brain/seed";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/**
 * POST /api/brain/seed — idempotent Milaene Brain seeding.
 * Useful for manual setup and development.
 */
export async function POST() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    }

    const result = await ensureMilaeneBrainSeeded();

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
