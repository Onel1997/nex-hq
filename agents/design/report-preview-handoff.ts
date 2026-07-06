import type { BrainReportContent, BrainResearchSections } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import { getBrainClient } from "@/brain/client";
import type { ReportListItem } from "@/lib/mock/reports";
import { brainReportRecordToListItem } from "@/lib/reports/from-brain";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import type { DesignStudioBrief, IntelligenceHandoffContext } from "./studio-brief";

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

async function findIntelligenceReportRecord(
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

function connectedDepartmentsFor(report: ReportListItem): string[] {
  const base =
    report.category === "commerce" || report.agentId === "shopify"
      ? "Commerce Lab"
      : report.agentId === "ceo"
        ? AGENT_STUDIO_NAMES.ceo
        : AGENT_STUDIO_NAMES[report.agentId] ?? report.category;

  switch (report.category) {
    case "commerce":
      return [...new Set([base, AGENT_STUDIO_NAMES.ceo, AGENT_STUDIO_NAMES.shopify])];
    case "research":
      return [...new Set([base, AGENT_STUDIO_NAMES.designer, AGENT_STUDIO_NAMES.ceo])];
    case "design":
    case "image":
      return [...new Set([base, AGENT_STUDIO_NAMES.image, AGENT_STUDIO_NAMES.marketing])];
    case "marketing":
    case "content":
      return [...new Set([base, AGENT_STUDIO_NAMES.content, AGENT_STUDIO_NAMES.ceo])];
    case "operations":
      return [
        AGENT_STUDIO_NAMES.ceo,
        AGENT_STUDIO_NAMES.research,
        AGENT_STUDIO_NAMES.designer,
        AGENT_STUDIO_NAMES.marketing,
      ];
    default:
      return [base];
  }
}

function keyFindingsFor(report: ReportListItem): string[] {
  return (
    report.ceoFinalReport?.keyFindings ??
    report.highlights ??
    report.opportunities ??
    (report.summary ? [report.summary] : [])
  )
    .filter(Boolean)
    .slice(0, 6);
}

function recommendationsFor(report: ReportListItem): string[] {
  return (
    report.recommendations ??
    report.nextSteps?.map((step) => step.action) ??
    report.designReport?.launchRecommendations ??
    report.ceoFinalReport?.recommendedActions?.map((action) => action.action) ??
    []
  )
    .filter(Boolean)
    .slice(0, 6);
}

function extractCollectionName(report: ReportListItem): string {
  const fromImage = report.imageProject?.collectionName?.trim();
  if (fromImage) return fromImage;
  const fromDesign = report.designReport?.collectionName?.trim();
  if (fromDesign) return fromDesign;
  const fromShopify = report.shopifyReport?.collectionName?.trim();
  if (fromShopify) return fromShopify;

  const dashParts = report.title
    .split("—")
    .map((part) => part.trim())
    .filter(Boolean);
  if (dashParts.length >= 2) return dashParts[0];

  return report.title.trim() || "Intelligence Collection";
}

function extractProduct(report: ReportListItem): string {
  const fromImage = report.imageProject?.productionAssets.find((asset) =>
    asset.productName?.trim(),
  )?.productName;
  if (fromImage?.trim()) return fromImage.trim();

  const fromDesign =
    report.designReport?.products?.[0]?.name ??
    report.designReport?.heroProducts?.[0]?.name ??
    report.designReport?.productLineup?.[0]?.name;
  if (fromDesign?.trim()) return fromDesign.trim();

  const fromShopify = report.shopifyReport?.products?.[0]?.productName;
  if (fromShopify?.trim()) return fromShopify.trim();

  const dashParts = report.title
    .split("—")
    .map((part) => part.trim())
    .filter(Boolean);
  if (dashParts.length >= 2) return dashParts[dashParts.length - 1];

  return "Oversized Tee";
}

function extractColor(report: ReportListItem): string {
  const designColor = report.designReport?.colorPalette?.[0]?.name?.trim();
  if (designColor) return designColor;

  const imageMoodColor = report.imageProject?.moodboard?.colorSystem?.[0]?.trim();
  if (imageMoodColor) return imageMoodColor;

  return "Black";
}

function buildIntelligenceContextBlock(report: ReportListItem): string {
  const findings = keyFindingsFor(report);
  const recommendations = recommendationsFor(report);
  const departments = connectedDepartmentsFor(report);

  const parts = [
    report.executiveSummary?.trim() ?? report.summary?.trim(),
    findings.length ? `Key findings: ${findings.join(" · ")}` : "",
    recommendations.length
      ? `Recommendations: ${recommendations.join(" · ")}`
      : "",
    report.opportunities?.length
      ? `Opportunities: ${report.opportunities.join(" · ")}`
      : "",
    report.risks?.length ? `Risks: ${report.risks.join(" · ")}` : "",
    departments.length
      ? `Connected departments: ${departments.join(" · ")}`
      : "",
    report.imageProject?.visualDirection?.trim()
      ? `Visual direction: ${report.imageProject.visualDirection}`
      : "",
    report.designReport?.theme?.trim()
      ? `Theme: ${report.designReport.theme}`
      : "",
    report.designReport?.story?.trim()
      ? `Story: ${report.designReport.story}`
      : "",
    report.marketingReport?.launchStrategy?.trim()
      ? `Launch strategy: ${report.marketingReport.launchStrategy}`
      : "",
  ].filter(Boolean);

  return parts.join("\n\n") || report.title;
}

/** Build a Design Studio brief from any Reports Center intelligence report. */
export function convertIntelligenceReportToStudioBrief(
  report: ReportListItem,
  content?: BrainReportContent,
): DesignStudioBrief {
  if (content?.agentId === "research" && content.researchSections) {
    return convertReportPreviewToStudioBrief(content, report.title);
  }

  const collectionName = extractCollectionName(report);
  const designId = `${slugify(collectionName)}-from-report`;
  const product = extractProduct(report);
  const color = extractColor(report);
  const contextBlock = buildIntelligenceContextBlock(report);
  const audience =
    report.designReport?.targetAudience?.trim() || "urban creatives 18–35";
  const silhouettes =
    report.designReport?.silhouettes?.join(", ") || "oversized, relaxed";
  const visualConcept =
    report.imageProject?.visualDirection?.trim() ||
    report.designReport?.stylingDirection?.trim() ||
    report.designReport?.designDirection?.trim() ||
    report.executiveSummary?.trim() ||
    report.summary?.trim() ||
    `Premium streetwear direction for ${collectionName}`;
  const palette = report.designReport?.colorPalette?.length
    ? report.designReport.colorPalette.map((entry) => ({
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
    `Source: ${AGENT_STUDIO_NAMES[report.agentId] ?? report.category}`,
    contextBlock,
  ].join("\n");

  const displayTitle = report.title.trim() || collectionName;

  return {
    designId,
    title: displayTitle,
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
      `Translate intelligence from ${displayTitle} into a commercially strong hero graphic.`,
      `Honor Milaene calm-luxury restraint — no stale template geometry.`,
      `Align to ${audience} and ${silhouettes} silhouettes.`,
      ...recommendationsFor(report)
        .slice(0, 2)
        .map((rec) => `Intelligence recommendation: ${rec}`),
    ],
    svgPrompt: `${promptBase}\n\nCreate print-ready vector artwork with transparent background, editorial luxury streetwear composition, center chest placement.`,
    mockupPrompt: `${promptBase}\n\nPhotorealistic oversized ${product.toLowerCase()} mockup on ${color.toLowerCase()} blank, soft studio light, premium streetwear styling.`,
    imagePrompt: `${promptBase}\n\nHigh-fashion editorial artwork for ${product}, luxury streetwear, muted tonal palette, campaign-ready.`,
    printReadinessScore: Math.min(
      100,
      Math.max(55, Math.round((report.confidence ?? 0.72) * 100)),
    ),
    commercialScore: Math.round((report.confidence ?? 0.72) * 100),
    campaignPotential: report.confidence >= 0.8 ? "high" : "medium",
  };
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

  const displayTitle = reportTitle.trim() || collectionName;

  return {
    designId,
    title: displayTitle,
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
      `Translate research intelligence for ${displayTitle} into a commercially strong hero graphic.`,
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

/** Reports Center preview fields for Design Studio handoff UI. */
export function buildIntelligenceHandoffContext(
  report: ReportListItem,
): IntelligenceHandoffContext {
  const collectionName = extractCollectionName(report);
  const studioName = AGENT_STUDIO_NAMES[report.agentId] ?? report.category;

  return {
    sourceType: `${studioName} / Intelligence Report`,
    sourceReportId: report.id,
    reportTitle: report.title.trim() || collectionName,
    executiveSummary:
      report.executiveSummary?.trim() ?? report.summary?.trim() ?? report.title,
    keyFindings: keyFindingsFor(report),
    recommendations: recommendationsFor(report),
    connectedDepartments: connectedDepartmentsFor(report),
    productName: extractProduct(report),
    collectionName: collectionName !== report.title.trim() ? collectionName : undefined,
  };
}

export interface LoadedIntelligenceReportRecord {
  brainRecordId: string;
  reportId: string;
  title: string;
  content: BrainReportContent;
  listItem: ReportListItem;
}

/** @deprecated Use LoadedIntelligenceReportRecord */
export type LoadedResearchReportRecord = LoadedIntelligenceReportRecord;

/** Load any intelligence report visible in Reports Center for Design Studio handoff. */
export async function loadIntelligenceReportRecord(
  workspaceId: string,
  reportId: string,
): Promise<LoadedIntelligenceReportRecord | null> {
  const record = await findIntelligenceReportRecord(workspaceId, reportId);
  if (!record || record.domain !== "reports") return null;

  const content = record.content as BrainReportContent;
  const listItem = brainReportRecordToListItem(record as BrainRecord<"reports">);

  return {
    brainRecordId: record.id,
    reportId: content.reportId || listItem.id,
    title: record.title,
    content,
    listItem,
  };
}

/** @deprecated Use loadIntelligenceReportRecord */
export async function loadResearchReportRecord(
  workspaceId: string,
  reportId: string,
): Promise<LoadedIntelligenceReportRecord | null> {
  return loadIntelligenceReportRecord(workspaceId, reportId);
}
