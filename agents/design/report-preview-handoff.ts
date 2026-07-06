import type { BrainReportContent, BrainResearchSections } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import { getBrainClient } from "@/brain/client";
import type { DesignStudioBrief } from "./studio-brief";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "research-brief";
}

function recordMatchesReportId(
  record: BrainRecord,
  reportId: string,
): boolean {
  if (record.domain !== "reports") return false;
  const content = record.content as BrainReportContent;
  return content.reportId === reportId || record.id === reportId;
}

async function findResearchReportRecord(
  workspaceId: string,
  reportId: string,
): Promise<BrainRecord | null> {
  const brain = getBrainClient();

  const byRecordId = await brain.getRecord("reports", reportId);
  if (
    byRecordId?.workspaceId === workspaceId &&
    recordMatchesReportId(byRecordId, reportId)
  ) {
    return byRecordId;
  }

  const result = await brain.searchRecords({
    workspaceId,
    domains: ["reports"],
    limit: 200,
  });

  return (
    result.records.find((entry) => recordMatchesReportId(entry, reportId)) ??
    null
  );
}

function firstProduct(sections?: BrainResearchSections): string {
  const suggestions = sections?.designBrief?.productSuggestions ?? [];
  return suggestions[0]?.trim() || "Oversized Tee";
}

function firstColor(sections?: BrainResearchSections): string {
  const palette = sections?.designBrief?.colorPalette ?? [];
  return palette[0]?.name?.trim() || "Black";
}

function buildContextBlock(
  sections: BrainResearchSections | undefined,
  reportTitle: string,
): string {
  const parts = [
    sections?.executiveSummary?.trim(),
    sections?.designBrief?.collectionIdea?.trim(),
    sections?.designBrief?.styleDirection?.trim(),
    sections?.designBrief?.rationale?.trim(),
    sections?.keyFindings?.length
      ? `Key findings: ${sections.keyFindings.join(" · ")}`
      : "",
    sections?.recommendations?.length
      ? `Recommendations: ${sections.recommendations.join(" · ")}`
      : "",
    sections?.opportunities?.length
      ? `Opportunities: ${sections.opportunities.join(" · ")}`
      : "",
  ].filter(Boolean);

  return parts.join("\n\n") || reportTitle;
}

/** Build a Design Studio brief from a Research HQ report without structured design concepts. */
export function convertReportPreviewToStudioBrief(
  content: BrainReportContent,
  reportTitle: string,
): DesignStudioBrief {
  const sections = content.researchSections;
  const designBrief = sections?.designBrief;
  const collectionName =
    designBrief?.collectionIdea?.trim() || reportTitle.trim() || "Research Collection";
  const designId = `${slugify(collectionName)}-from-report`;
  const product = firstProduct(sections);
  const color = firstColor(sections);
  const contextBlock = buildContextBlock(sections, reportTitle);
  const silhouettes = designBrief?.silhouettes?.join(", ") || "oversized, relaxed";
  const audience = designBrief?.targetAudience?.trim() || "urban creatives 18–35";
  const visualConcept =
    designBrief?.styleDirection?.trim() ||
    sections?.executiveSummary?.trim() ||
    `Premium streetwear direction for ${collectionName}`;
  const palette =
    designBrief?.colorPalette?.length
      ? designBrief.colorPalette.map((entry) => ({
          name: entry.name,
          usage: entry.role || "primary",
          hex: entry.hex,
        }))
      : [{ name: color, usage: "primary garment color" }];

  const promptBase = [
    `Collection: ${collectionName}`,
    `Product: ${product} in ${color}`,
    `Audience: ${audience}`,
    `Silhouettes: ${silhouettes}`,
    contextBlock,
  ].join("\n");

  return {
    designId,
    title: collectionName,
    role: "Hero Piece",
    product,
    color,
    printArea: "Front",
    placement: "Center chest oversized placement with editorial margins",
    dimensions: "30 × 35 cm",
    visualConcept,
    designDescription: contextBlock.slice(0, 1200),
    geometry: "Editorial mark with restrained negative space",
    visualElements: ["primary mark", "editorial framing", "negative space"],
    typography: "Uppercase tracked sans with editorial hierarchy",
    colorPalette: palette,
    productionMethod: "Screen print spot color or premium DTG",
    materialEffects: "Soft-hand ink with matte finish on heavyweight cotton",
    negativeSpaceRules:
      "Preserve generous margins around the focal mark for premium streetwear balance",
    designerInstructions: [
      `Translate research intelligence for ${collectionName} into a commercially strong hero graphic.`,
      `Honor Milaene calm-luxury restraint — no stale template geometry.`,
      `Align to ${audience} and ${silhouettes} silhouettes.`,
      ...(sections?.recommendations?.slice(0, 2).map(
        (rec) => `Research recommendation: ${rec}`,
      ) ?? []),
    ],
    svgPrompt: `${promptBase}\n\nCreate print-ready vector artwork with transparent background, editorial luxury streetwear composition, center chest placement.`,
    mockupPrompt: `${promptBase}\n\nPhotorealistic oversized ${product.toLowerCase()} mockup on ${color.toLowerCase()} blank, soft studio light, premium streetwear styling.`,
    imagePrompt: `${promptBase}\n\nHigh-fashion editorial artwork for ${product}, luxury streetwear, muted tonal palette, campaign-ready.`,
    printReadinessScore: Math.min(
      100,
      Math.max(
        55,
        designBrief?.confidence ??
          Math.round((content.confidence ?? 0.72) * 100),
      ),
    ),
    dnaScore: designBrief?.confidence,
    commercialScore: designBrief?.demandScore ?? designBrief?.trendScore,
    campaignPotential:
      designBrief && designBrief.confidence >= 80 ? "high" : "medium",
  };
}

export interface LoadedResearchReportRecord {
  brainRecordId: string;
  reportId: string;
  title: string;
  content: BrainReportContent;
}

/** Load any research report record for preview-based Design Studio handoff. */
export async function loadResearchReportRecord(
  workspaceId: string,
  reportId: string,
): Promise<LoadedResearchReportRecord | null> {
  const record = await findResearchReportRecord(workspaceId, reportId);
  if (!record) return null;

  const content = record.content as BrainReportContent;
  if (content.agentId !== "research") return null;

  return {
    brainRecordId: record.id,
    reportId: content.reportId,
    title: record.title,
    content,
  };
}
