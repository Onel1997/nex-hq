import { NextResponse } from "next/server";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";
import { fetchShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";
import { buildProductAgentInsights } from "@/lib/shopify/operations";
import { loadBusinessProfile } from "@/lib/business/load-profile";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";

function getStoreDomain(): string {
  return (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

async function countAgentReports() {
  try {
    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();
    const result = await brain.searchRecords({
      workspaceId: workspace.id,
      domains: ["reports"],
      limit: 200,
    });

    const counts = { design: 0, image: 0, marketing: 0, content: 0, ceo: 0 };

    for (const record of result.records) {
      const tags = (record.tags ?? []).map((t) => t.toLowerCase());
      const agentId = (record.content as { agentId?: string })?.agentId ?? "";

      if (tags.some((t) => t.includes("design")) || agentId === "designer") counts.design++;
      if (tags.some((t) => t.includes("image")) || agentId === "image") counts.image++;
      if (tags.some((t) => t.includes("marketing")) || agentId === "marketing") counts.marketing++;
      if (tags.some((t) => t.includes("content")) || agentId === "content") counts.content++;
      if (tags.some((t) => t.includes("ceo")) || agentId === "ceo") counts.ceo++;
    }

    return counts;
  } catch {
    return { design: 0, image: 0, marketing: 0, content: 0, ceo: 0 };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);

    const [detail, knowledge, reportCounts, businessProfile] = await Promise.all([
      fetchShopifyProductDetail(decodedId),
      fetchShopifyKnowledge(),
      countAgentReports(),
      loadBusinessProfile(""),
    ]);

    if (!detail) {
      return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
    }

    const productKnowledge = buildProductKnowledge(knowledge);
    const knowledgeProduct = knowledge.products.find((p) => p.id === decodedId);

    const agentInsights = knowledgeProduct
      ? buildProductAgentInsights(
          knowledgeProduct,
          reportCounts,
          productKnowledge,
          businessProfile,
        )
      : null;

    return NextResponse.json({
      ok: true,
      storeDomain: getStoreDomain(),
      product: detail,
      agentInsights,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch product";

    console.error("[Shopify Product Detail]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
