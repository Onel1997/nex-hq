import type {
  BrainReportContent,
  BrainShopifySections,
} from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type { ShopifyOutput } from "./types";

export interface SaveShopifyInput {
  workspaceId: string;
  brief: string;
  output: ShopifyOutput;
}

export interface SaveShopifyResult {
  reportId: string;
  reportRecordId: string;
}

function buildShopifySections(output: ShopifyOutput): BrainShopifySections {
  return {
    collectionName: output.collectionName,
    collectionDescription: output.collectionDescription,
    collectionSeoTitle: output.collectionSeoTitle,
    collectionSeoDescription: output.collectionSeoDescription,
    products: output.products,
    collectionsToCreate: output.collectionsToCreate,
    navigationRecommendations: output.navigationRecommendations,
    homepageRecommendations: output.homepageRecommendations,
    launchChecklist: output.launchChecklist,
    storefrontWarnings: output.storefrontWarnings,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveShopifyToBrain(
  input: SaveShopifyInput,
): Promise<SaveShopifyResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const taskId = `shopify-${reportId}`;
  const baseSlug = slugify(input.output.title).slice(0, 48) || "shopify";
  const slugSuffix = reportId.slice(0, 8);
  const shopifySections = buildShopifySections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    agentId: "shopify",
    status: "submitted",
    summary: input.output.collectionDescription.slice(0, 500),
    confidence: input.output.confidence,
    reportType: "shopify-report",
    shopifySections,
    notes: `Shopify-Briefing: ${input.brief}`,
    artifacts: [
      {
        id: `${reportId}-draft`,
        type: "markdown",
        label: "Vollständiger Storefront-Entwurf",
        content: input.output.fullDraft,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `shopify-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.collectionDescription.slice(0, 500),
    content: reportContent,
    status: "pending_review",
    tags: ["shopify-report", "shopify", "agent-generated", "storefront"],
    provenance: {
      createdBy: { type: "agent", id: "shopify" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
