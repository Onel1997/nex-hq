import { NextResponse } from "next/server";
import { DataSourceManager } from "@/lib/data-source-platform";

export const dynamic = "force-dynamic";

/** Hidden provider settings panel data. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const settings = await DataSourceManager.loadSettings({ force });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load settings",
      },
      { status: 500 },
    );
  }
}

/** POST settings actions: refresh-all | disconnect-all */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  try {
    if (body.action === "disconnect-all") {
      DataSourceManager.disconnectAll();
      return NextResponse.json({ ok: true, disconnected: true });
    }

    const settings = await DataSourceManager.loadSettings({ force: true });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Action failed",
      },
      { status: 500 },
    );
  }
}
