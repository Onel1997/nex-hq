import { NextResponse } from "next/server";
import { loadDataSourcePlatformSnapshot } from "@/lib/data-source-platform";

export const dynamic = "force-dynamic";

/** GET all live data source providers for Research Studio. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";

    const snapshot = await loadDataSourcePlatformSnapshot({ force });
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load sources",
      },
      { status: 500 },
    );
  }
}

/** POST refresh all providers (force cache bypass). */
export async function POST() {
  try {
    const snapshot = await loadDataSourcePlatformSnapshot({ force: true });
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh sources",
      },
      { status: 500 },
    );
  }
}
