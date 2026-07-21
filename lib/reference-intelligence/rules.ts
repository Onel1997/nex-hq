import {
  assertVisionExtractionDisabled,
  flattenDescriptorValues,
  personaCastingFieldsFromDescriptor,
} from "./descriptors";
import type {
  ReferenceApprovalStatus,
  ReferenceAsset,
  ReferenceDescriptor,
  ReferenceDirection,
  ReferenceUsage,
  ReferenceWorkspaceCatalog,
} from "./types";

const FORBIDDEN_COPY_PATTERNS: RegExp[] = [
  /\bcopy\b/i,
  /\brecreate exactly\b/i,
  /\bidentical to\b/i,
  /\bsame composition\b/i,
  /\bsame person\b/i,
  /\bsame logo\b/i,
  /\bclone\b/i,
  /\breplicate\b/i,
  /\bin the exact style of\b/i,
  /\bmake it look exactly like\b/i,
  /\bexact(?:ly)? (?:like|as|same)\b/i,
  /\bface embedding\b/i,
  /\bcelebrity\b/i,
  /\bcopyrighted\b/i,
];

const IDENTITY_FORBIDDEN_KEYS = [
  "personIdentity",
  "faceEmbedding",
  "celebrityIdentity",
  "celebrity",
  "logo",
  "exactArtwork",
  "exactGraphic",
  "exactPoseCoordinates",
  "brandCompositionRecipe",
] as const;

export function isReferenceApproved(asset: ReferenceAsset): boolean {
  return asset.approvalStatus === "approved";
}

export function canReferenceBeUsedFor(
  asset: ReferenceAsset,
  usage: ReferenceUsage,
): boolean {
  if (!isReferenceApproved(asset)) return false;
  return asset.usage.includes(usage);
}

export function getApprovedReferencesForUsage(
  catalog: ReferenceWorkspaceCatalog,
  usage: ReferenceUsage,
): ReferenceAsset[] {
  return catalog.assets
    .filter((a) => canReferenceBeUsedFor(a, usage))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function assertReferenceUsageAllowed(
  asset: ReferenceAsset,
  usage: ReferenceUsage,
): void {
  if (asset.approvalStatus === "draft") {
    throw new Error(
      `Reference "${asset.id}" is draft and cannot affect production prompts.`,
    );
  }
  if (asset.approvalStatus === "rejected") {
    throw new Error(
      `Reference "${asset.id}" is rejected and cannot affect production prompts.`,
    );
  }
  if (asset.approvalStatus === "archived") {
    throw new Error(
      `Reference "${asset.id}" is archived and cannot affect production prompts.`,
    );
  }
  if (!asset.usage.includes(usage)) {
    throw new Error(
      `Reference "${asset.id}" usage mismatch — not allowed for ${usage}.`,
    );
  }
}

export function createReferenceDescriptorFingerprint(
  descriptor: ReferenceDescriptor,
): string {
  const values = flattenDescriptorValues(descriptor)
    .map((v) => v.toLowerCase())
    .sort();
  return [
    descriptor.id,
    descriptor.assetId,
    descriptor.boardId,
    descriptor.extractionMethod,
    descriptor.version,
    values.join("|"),
  ].join("::");
}

function normalizeLine(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deduplicate abstract descriptor lines across approved references. */
export function dedupeReferenceDescriptors(
  descriptors: ReferenceDescriptor[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of descriptors) {
    for (const line of flattenDescriptorValues(d)) {
      const key = normalizeLine(line);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(line.trim());
    }
  }
  return out;
}

/**
 * Merge approved descriptors into a single abstract direction.
 * Only abstract values — no identity / logo / composition clone fields.
 */
export function mergeReferenceDescriptors(
  descriptors: ReferenceDescriptor[],
): ReferenceDescriptor | null {
  if (descriptors.length === 0) return null;
  const sorted = descriptors
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const base = structuredClone(sorted[0]!);

  for (const next of sorted.slice(1)) {
    base.camera = { ...base.camera, ...next.camera };
    base.lighting = { ...base.lighting, ...next.lighting };
    base.pose = { ...base.pose, ...next.pose };
    base.expression = { ...base.expression, ...next.expression };
    base.styling = {
      ...base.styling,
      ...next.styling,
      garmentCategories: uniqueStrings([
        ...(base.styling.garmentCategories ?? []),
        ...(next.styling.garmentCategories ?? []),
      ]),
      palette: uniqueStrings([
        ...(base.styling.palette ?? []),
        ...(next.styling.palette ?? []),
      ]),
    };
    base.environment = {
      ...base.environment,
      ...next.environment,
      surfaceMaterials: uniqueStrings([
        ...(base.environment.surfaceMaterials ?? []),
        ...(next.environment.surfaceMaterials ?? []),
      ]),
    };
    base.visualMood = { ...base.visualMood, ...next.visualMood };
    base.personaDirection = {
      ...base.personaDirection,
      ...next.personaDirection,
    };
    if (next.notes?.trim()) {
      base.notes = [base.notes, next.notes].filter(Boolean).join(" | ");
    }
  }

  base.id = `merged:${sorted.map((d) => d.id).join("+")}`;
  base.version = "merged";
  return sanitizeReferenceDescriptor(base);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Strip forbidden identity keys and copying language from descriptor notes/fields. */
export function sanitizeReferenceDescriptor(
  descriptor: ReferenceDescriptor,
): ReferenceDescriptor {
  assertVisionExtractionDisabled(descriptor.extractionMethod);

  const clone = structuredClone(descriptor);
  const raw = clone as unknown as Record<string, unknown>;
  for (const key of IDENTITY_FORBIDDEN_KEYS) {
    delete raw[key];
  }

  const sanitizeBag = (value: unknown): unknown => {
    if (typeof value === "string") {
      return sanitizeReferencePromptDirection(value).text;
    }
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === "string" ? sanitizeReferencePromptDirection(v).text : v))
        .filter((v) => (typeof v === "string" ? v.trim().length > 0 : true));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if ((IDENTITY_FORBIDDEN_KEYS as readonly string[]).includes(k)) continue;
        out[k] = sanitizeBag(v);
      }
      return out;
    }
    return value;
  };

  clone.camera = sanitizeBag(clone.camera) as typeof clone.camera;
  clone.lighting = sanitizeBag(clone.lighting) as typeof clone.lighting;
  clone.pose = sanitizeBag(clone.pose) as typeof clone.pose;
  clone.expression = sanitizeBag(clone.expression) as typeof clone.expression;
  clone.styling = sanitizeBag(clone.styling) as typeof clone.styling;
  clone.environment = sanitizeBag(clone.environment) as typeof clone.environment;
  clone.visualMood = sanitizeBag(clone.visualMood) as typeof clone.visualMood;
  clone.personaDirection = sanitizeBag(
    clone.personaDirection,
  ) as typeof clone.personaDirection;
  if (clone.notes) {
    clone.notes = sanitizeReferencePromptDirection(clone.notes).text;
  }
  return clone;
}

export type SanitizeResult = {
  text: string;
  rejected: boolean;
  removedPhrases: string[];
};

/**
 * Remove or reject copying / imitation language from prompt direction text.
 */
export function sanitizeReferencePromptDirection(input: string): SanitizeResult {
  let text = input;
  const removedPhrases: string[] = [];

  for (const pattern of FORBIDDEN_COPY_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match?.[0]) removedPhrases.push(match[0]);
      text = text.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
    }
  }

  // Strip brand imitation framing like "exactly like Brand X campaign"
  text = text
    .replace(/\b(?:like|as)\s+[A-Z][A-Za-z0-9&.\- ]{1,40}\s+campaign\b/gi, "")
    .replace(/\bimitation of\b/gi, "")
    .replace(/\bmake it look like\b/gi, "evoke abstract qualities of")
    .replace(/\s{2,}/g, " ")
    .trim();

  const rejected =
    removedPhrases.length > 0 &&
    flattenWords(text).length < 3 &&
    flattenWords(input).length >= 3;

  return {
    text: rejected ? "" : text,
    rejected,
    removedPhrases,
  };
}

function flattenWords(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export function buildReferenceDirection(
  catalog: ReferenceWorkspaceCatalog,
  usage: ReferenceUsage,
): ReferenceDirection {
  const assets = getApprovedReferencesForUsage(catalog, usage);
  const descriptors = assets
    .map((a) => catalog.descriptors.find((d) => d.id === a.descriptorId))
    .filter((d): d is ReferenceDescriptor => Boolean(d))
    .map(sanitizeReferenceDescriptor);

  const abstractLines =
    usage === "persona_casting"
      ? dedupeLines(
          descriptors.flatMap((d) => personaCastingFieldsFromDescriptor(d)),
        )
      : dedupeReferenceDescriptors(descriptors);

  const fingerprint = [
    usage,
    ...assets.map((a) => a.id).sort(),
    ...descriptors.map(createReferenceDescriptorFingerprint).sort(),
  ].join("||");

  return {
    usage,
    descriptorIds: descriptors.map((d) => d.id).sort(),
    assetIds: assets.map((a) => a.id).sort(),
    boardIds: [...new Set(assets.map((a) => a.boardId))].sort(),
    abstractLines,
    fingerprint,
  };
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = normalizeLine(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function approvalCounts(
  catalog: ReferenceWorkspaceCatalog,
  boardId: string,
): Record<ReferenceApprovalStatus, number> {
  const assets = catalog.assets.filter((a) => a.boardId === boardId);
  return {
    draft: assets.filter((a) => a.approvalStatus === "draft").length,
    approved: assets.filter((a) => a.approvalStatus === "approved").length,
    rejected: assets.filter((a) => a.approvalStatus === "rejected").length,
    archived: assets.filter((a) => a.approvalStatus === "archived").length,
  };
}
