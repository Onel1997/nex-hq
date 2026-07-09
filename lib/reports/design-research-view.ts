import type { BrainReportContent } from "@/brain/domains/reports";
import type {
  ReportsCenterDesignCollection,
  ReportsCenterDesignConceptSummary,
  ReportsCenterDesignResearch,
} from "@/lib/facility/reports-center-types";

interface DesignResearchPayload {
  title?: string;
  collection?: Record<string, unknown>;
  designs?: Record<string, unknown>[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractPayloadFromContent(
  content: BrainReportContent,
): DesignResearchPayload | null {
  const sectionPayload = content.researchSections?.designResearch;
  if (sectionPayload?.designs?.length) {
    return {
      title: sectionPayload.title,
      collection: sectionPayload.collection as Record<string, unknown> | undefined,
      designs: sectionPayload.designs as Record<string, unknown>[],
    };
  }

  for (const artifact of content.artifacts) {
    if (artifact.type !== "json") continue;
    if (
      !artifact.id.endsWith("-design-payload") &&
      artifact.label !== "Design-Konzepte (structured)"
    ) {
      continue;
    }
    try {
      const parsed = JSON.parse(artifact.content) as DesignResearchPayload;
      if (Array.isArray(parsed.designs) && parsed.designs.length > 0) {
        return parsed;
      }
    } catch {
      // try next artifact
    }
  }

  return null;
}

function mapCollection(
  raw: Record<string, unknown> | undefined,
): ReportsCenterDesignCollection | undefined {
  if (!raw) return undefined;
  const heroDesignId = asString(raw.heroDesignId);
  if (!asString(raw.name) && !heroDesignId) return undefined;

  return {
    name: asString(raw.name) || "Untitled collection",
    story: asString(raw.story) || undefined,
    mood: asString(raw.mood) || undefined,
    philosophy: asString(raw.philosophy) || undefined,
    heroDesignId,
    campaignTheme: asString(raw.campaignTheme) || undefined,
    collectionScore: asNumber(raw.collectionScore),
  };
}

function mapDesignSummary(
  raw: Record<string, unknown>,
  heroDesignId?: string,
): ReportsCenterDesignConceptSummary | null {
  const designId = asString(raw.designId);
  const title = asString(raw.title);
  if (!designId || !title) return null;

  return {
    designId,
    title,
    collectionRole: asString(raw.collectionRole) || "Supporting Piece",
    product: asString(raw.product) || "—",
    color: asString(raw.color) || "—",
    printArea: asString(raw.printArea) || "—",
    placement:
      asString(raw.placementDimensions) ||
      asString(raw.coordinates) ||
      "—",
    dimensions: asString(raw.dimensions) || asString(raw.printSize) || "—",
    productionMethod: asString(raw.printTechnique) || "—",
    dnaScore: asNumber(raw.dnaScore) ?? 0,
    commercialScore: asNumber(raw.commercialScore),
    campaignPotential: asString(raw.campaignPotential) || undefined,
    isHero: Boolean(heroDesignId && designId === heroDesignId),
  };
}

/** Extract client-safe design research view from a Brain report. */
export function extractDesignResearchView(
  content: BrainReportContent,
): ReportsCenterDesignResearch | undefined {
  const payload = extractPayloadFromContent(content);
  if (!payload?.designs?.length) return undefined;

  const collection = mapCollection(payload.collection);
  const heroDesignId = collection?.heroDesignId;

  const designs = payload.designs
    .map((design) => mapDesignSummary(design, heroDesignId))
    .filter((design): design is ReportsCenterDesignConceptSummary => design != null);

  if (designs.length === 0) return undefined;

  return {
    reportId: content.reportId,
    hasDesignResearch: true,
    designCount: designs.length,
    collection,
    designs,
  };
}
