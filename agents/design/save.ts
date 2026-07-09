import type {
  BrainDesignHeroProduct,
  BrainDesignProduct,
  BrainDesignProductV2,
  BrainDesignSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import { resolveReportTaskIds } from "@/lib/reports/task-link";
import type { DesignOutput } from "./types";

export interface SaveDesignInput {
  workspaceId: string;
  brief: string;
  output: DesignOutput;
  originTaskId?: string;
}

export interface SaveDesignResult {
  reportId: string;
  reportRecordId: string;
}

function toLegacyProduct(product: DesignOutput["products"][number]): BrainDesignProduct {
  return {
    name: product.name,
    category: product.category,
    description:
      product.description ??
      `${product.details} · ${product.material} · ${product.color} · ${product.fit}`,
  };
}

function toHeroProducts(
  products: DesignOutput["products"],
): BrainDesignHeroProduct[] {
  return products
    .filter((p) => p.priority === "hero")
    .slice(0, 6)
    .map((p) => ({
      name: p.name,
      description:
        p.description ??
        `${p.details} · ${p.material} · ${p.color}`,
      rationale: `${p.pricePosition} — führt die Kollektionsstory als Hero-SKU.`,
    }));
}

function buildDesignSections(output: DesignOutput): BrainDesignSections {
  const heroProducts = toHeroProducts(output.products);
  const fallbackHeroes =
    heroProducts.length >= 2
      ? heroProducts
      : output.products.slice(0, 2).map((p) => ({
          name: p.name,
          description:
            p.description ??
            `${p.details} · ${p.material} · ${p.color}`,
          rationale: `${p.pricePosition} — Kernprodukt der Kollektion.`,
        }));

  return {
    schemaVersion: "2.0",
    collectionName: output.collectionName,
    season: output.season,
    theme: output.theme,
    story: output.story,
    collectionStory: output.story,
    targetAudience: output.targetAudience,
    colorPalette: output.colorPalette,
    materials: output.materials,
    silhouettes: output.silhouettes,
    fits: output.fits,
    products: output.products as BrainDesignProductV2[],
    stylingDirection: output.stylingDirection,
    designDirection: output.stylingDirection,
    visualKeywords: output.visualKeywords,
    mockupIdeas: output.mockupIdeas,
    campaignIdeas: output.campaignIdeas,
    photographyStyle: output.photographyStyle,
    imagePrompts: output.imagePrompts,
    moodDescription: output.moodDescription,
    productLineup: output.products.map(toLegacyProduct),
    heroProducts: fallbackHeroes,
    launchRecommendations: output.campaignIdeas,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveDesignToBrain(
  input: SaveDesignInput,
): Promise<SaveDesignResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const { taskId, originTaskId } = resolveReportTaskIds(
    input.originTaskId,
    reportId,
    "design",
  );
  const baseSlug = slugify(input.output.title).slice(0, 48) || "design";
  const slugSuffix = reportId.slice(0, 8);
  const designSections = buildDesignSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    ...(originTaskId ? { originTaskId } : {}),
    agentId: "designer",
    status: "submitted",
    summary: input.output.story,
    confidence: input.output.confidence,
    reportType: "design-report",
    designSections,
    notes: `Design-Briefing: ${input.brief}`,
    artifacts: [
      {
        id: `${reportId}-concept`,
        type: "markdown",
        label: "Vollständiges Kollektionskonzept",
        content: input.output.fullConcept,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `design-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.story,
    content: reportContent,
    status: "pending_review",
    tags: [
      "design-report",
      "designer",
      "agent-generated",
      "collection",
      "design-v2",
    ],
    provenance: {
      createdBy: { type: "agent", id: "designer" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
