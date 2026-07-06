import { NextResponse } from "next/server";
import {
  DataSourceManager,
  getProviderAdapter,
  type ProviderId,
} from "@/lib/data-source-platform";

export const dynamic = "force-dynamic";

const VALID_IDS = new Set([
  "shopify",
  "tiktok",
  "pinterest",
  "google_trends",
  "amazon",
  "etsy",
  "reddit",
  "instagram",
  "fashion_news",
]);

function parseId(raw: string): ProviderId | null {
  return VALID_IDS.has(raw) ? (raw as ProviderId) : null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET single provider snapshot. */
export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 404 });
  }

  const adapter = getProviderAdapter(id);
  if (!adapter) {
    return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });
  }

  try {
    const result = await DataSourceManager.syncProvider(id);
    return NextResponse.json({ ok: true, provider: result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}

/** POST provider actions: refresh | disconnect | health | test */
export async function POST(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
  };
  const action = body.action ?? "refresh";

  try {
    if (action === "disconnect") {
      DataSourceManager.disconnectProvider(id);
      return NextResponse.json({ ok: true, disconnected: true });
    }

    if (action === "health") {
      const health = await DataSourceManager.healthCheckProvider(id);
      return NextResponse.json({ ok: true, health });
    }

    if (action === "test") {
      const [result, health] = await Promise.all([
        DataSourceManager.syncProvider(id, { force: true }),
        DataSourceManager.healthCheckProvider(id),
      ]);
      return NextResponse.json({ ok: true, provider: result, health });
    }

    const result = await DataSourceManager.syncProvider(id, { force: true });
    return NextResponse.json({ ok: true, provider: result });
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
