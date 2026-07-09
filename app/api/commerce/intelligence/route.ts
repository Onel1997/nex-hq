import { NextResponse } from "next/server";
import { formatDepartmentCommerceSignals } from "@/lib/commerce/department-signals";
import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";

/**
 * Milaene Commerce Intelligence API — department consumption layer.
 * Shopify Operations UI remains the canonical surface; this route exposes
 * the same intelligence to CEO, Design, Marketing, Image, and Commerce Lab.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");

  try {
    const baseline = await loadMilaeneCommerceBaseline();

    if (department) {
      const valid = ["ceo", "design", "marketing", "image", "commerce-lab", "research"] as const;
      if (!valid.includes(department as (typeof valid)[number])) {
        return NextResponse.json(
          { ok: false, error: `Unknown department: ${department}` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        baseline: baseline.baseline,
        loadedAt: baseline.loadedAt,
        department,
        signals: formatDepartmentCommerceSignals(
          department as (typeof valid)[number],
          baseline,
        ),
        insights: baseline.insights,
        agentConnections: baseline.agentConnections,
      });
    }

    return NextResponse.json({
      ok: true,
      ...baseline,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load commerce intelligence";

    console.error("[Commerce Intelligence]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
