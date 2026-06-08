import type { BrainContextSlice } from "@/brain/context";
import type { BrainReportContent } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import { IMAGE_REPORT_TAG_ALIASES } from "./retrieve-context";

export interface ImageCollectionIdentity {
  /** Single source of truth — from Design report (CEO fallback). */
  collectionName: string;
  /** Campaign context — from Marketing report (CEO fallback). */
  campaignName: string;
  /** Workspace-level project label. */
  projectName: string;
}

const GENERIC_NAME_PATTERNS = [
  /^drop$/i,
  /^summer collection$/i,
  /^collection$/i,
  /^project$/i,
  /^image project$/i,
  /^test\b/i,
  /^milaene$/i,
  /^milaene creative production$/i,
  /^creative production$/i,
  /^neue kollektion$/i,
];

const TITLE_PREFIX_STRIP =
  /^(design|ceo|marketing|content|image|shopify)\s*(report|bericht)?\s*[:\-—–]\s*/i;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getRecordContent(
  record: BrainRecord,
): BrainReportContent | undefined {
  const content = record.content;
  if (!content || typeof content !== "object") return undefined;
  if ((content as BrainReportContent).kind !== "reports") return undefined;
  return content as BrainReportContent;
}

function recordHasTag(record: BrainRecord, aliases: readonly string[]): boolean {
  const tags = (record.tags ?? []).map((t) => t.toLowerCase());
  return aliases.some((alias) => tags.includes(alias.toLowerCase()));
}

export function isGenericCollectionName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return true;
  const normalized = trimmed.replace(/\s+creative production$/i, "").trim();
  return GENERIC_NAME_PATTERNS.some(
    (pattern) => pattern.test(trimmed) || pattern.test(normalized),
  );
}

export function formatAssetTitle(
  collectionName: string,
  assetTypeLabel: string,
): string {
  return `${collectionName} — ${assetTypeLabel}`;
}

function extractNameFromReportTitle(title: string): string | undefined {
  const cleaned = title.replace(TITLE_PREFIX_STRIP, "").trim();
  const segments = cleaned.split(/\s*[—–-]\s+/);
  for (const segment of segments) {
    const candidate = segment.trim();
    if (candidate && !isGenericCollectionName(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function extractCollectionFromBrief(brief: string): string | undefined {
  const match = brief.match(
    /(?:für|for)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)/,
  );
  if (match?.[1] && !isGenericCollectionName(match[1])) {
    return match[1].trim();
  }
  return undefined;
}

function sanitizeName(name: string): string {
  return name
    .replace(/\s+creative production$/i, "")
    .replace(/\s+image[- ]?project$/i, "")
    .trim();
}

function pickCampaignName(
  marketingTitle: string | undefined,
  collectionName: string,
): string {
  if (marketingTitle) {
    const fromTitle = extractNameFromReportTitle(marketingTitle);
    if (fromTitle && !isGenericCollectionName(fromTitle)) {
      return fromTitle;
    }
  }
  return collectionName;
}

export function buildProjectName(collectionName: string): string {
  return `${collectionName} Creative Production`;
}

export function resolveIdentityFromPayload(
  payload: Record<string, unknown>,
  fallback?: Partial<ImageCollectionIdentity>,
): ImageCollectionIdentity {
  const rawProject = sanitizeName(
    asString(payload.projectName) || asString(payload.title),
  );
  const rawCollection = sanitizeName(asString(payload.collectionName));

  let collectionName = "";
  if (rawCollection && !isGenericCollectionName(rawCollection)) {
    collectionName = rawCollection;
  } else if (rawProject && !isGenericCollectionName(rawProject)) {
    collectionName = rawProject;
  } else if (fallback?.collectionName) {
    collectionName = fallback.collectionName;
  } else {
    collectionName = "Brand Collection";
  }

  const campaignName =
    asString(payload.campaignName) && !isGenericCollectionName(asString(payload.campaignName))
      ? asString(payload.campaignName)
      : fallback?.campaignName && !isGenericCollectionName(fallback.campaignName)
        ? fallback.campaignName
        : collectionName;

  const projectName = buildProjectName(collectionName);

  return { collectionName, campaignName, projectName };
}

export function extractCollectionIdentity(params: {
  slices: BrainContextSlice[];
  brief?: string;
  workspaceName?: string;
}): ImageCollectionIdentity {
  const reportSlice = params.slices.find((s) => s.domain === "reports");
  const records = reportSlice?.records ?? [];

  let collectionName = "";
  let marketingTitle: string | undefined;

  const designAliases = IMAGE_REPORT_TAG_ALIASES["design-report"];
  const ceoAliases = IMAGE_REPORT_TAG_ALIASES["ceo-report"];
  const marketingAliases = IMAGE_REPORT_TAG_ALIASES["marketing-report"];

  for (const record of records) {
    const content = getRecordContent(record);
    if (!content) continue;

    if (recordHasTag(record, designAliases)) {
      const fromSections = asString(content.designSections?.collectionName);
      if (fromSections && !isGenericCollectionName(fromSections)) {
        collectionName = fromSections;
      } else {
        const fromTitle = extractNameFromReportTitle(record.title);
        if (fromTitle && !collectionName) collectionName = fromTitle;
      }
    }
  }

  if (!collectionName) {
    for (const record of records) {
      if (!recordHasTag(record, ceoAliases)) continue;
      const fromTitle = extractNameFromReportTitle(record.title);
      if (fromTitle && !isGenericCollectionName(fromTitle)) {
        collectionName = fromTitle;
        break;
      }
    }
  }

  for (const record of records) {
    if (recordHasTag(record, marketingAliases)) {
      marketingTitle = record.title;
      break;
    }
  }

  if (!collectionName && params.brief) {
    const fromBrief = extractCollectionFromBrief(params.brief);
    if (fromBrief) collectionName = fromBrief;
  }

  if (!collectionName && params.workspaceName) {
    const workspace = sanitizeName(params.workspaceName);
    if (!isGenericCollectionName(workspace)) {
      collectionName = workspace;
    }
  }

  if (!collectionName) {
    collectionName = "Brand Collection";
  }

  const campaignName = pickCampaignName(marketingTitle, collectionName);
  const projectName = buildProjectName(collectionName);

  return { collectionName, campaignName, projectName };
}
