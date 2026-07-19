import { resolveProductTarget, type CoreProductTarget } from "../pattern-intelligence/product-target";
import {
  dedupeSilhouettes,
  isIncompleteSilhouette,
  normalizeSilhouetteLabel,
} from "./product-terminology";

export interface ResearchScope {
  userRequest: string;
  primaryTarget: CoreProductTarget;
  allowedSilhouettes: string[];
  rejectedCategoryPatterns: RegExp[];
}

const OUT_OF_SCOPE_RE =
  /\b(tee|t-?shirt|shorts|pants|cargo|footwear|sneaker|beanie|mütze|hat|cap|accessoire|accessory|sherpa|jacke|jacket)\b/i;

const HOODIE_SCOPE_RE = /heavyweight\s+hoodie|premium\s+heavyweight|hoodie/i;

function hoodieScope(userRequest: string): ResearchScope {
  return {
    userRequest,
    primaryTarget: "Heavyweight Hoodie",
    allowedSilhouettes: ["Heavyweight Hoodie", "Oversized Hoodie", "Zip Hoodie", "Long Sleeve"],
    rejectedCategoryPatterns: [
      OUT_OF_SCOPE_RE,
      /\btee\b/i,
      /\bsherpa\b/i,
      /\bjacke\b/i,
      /\bjacket\b/i,
    ],
  };
}

function defaultScope(userRequest: string, primaryTarget: CoreProductTarget): ResearchScope {
  const silhouettes = dedupeSilhouettes([
    primaryTarget,
    "Oversized Hoodie",
    "Zip Hoodie",
    "Oversized T-Shirt",
    "Long Sleeve",
  ]);
  return {
    userRequest,
    primaryTarget,
    allowedSilhouettes: silhouettes,
    rejectedCategoryPatterns: [/\bsherpa\b/i, /\bshorts\b/i, /\bcargo\b/i],
  };
}

export function deriveResearchScope(userRequest?: string): ResearchScope {
  const request = userRequest?.trim() ?? "";
  if (request && HOODIE_SCOPE_RE.test(request)) {
    return hoodieScope(request);
  }
  const primaryTarget = resolveProductTarget({ userRequest: request });
  return defaultScope(request, primaryTarget);
}

export function isOutOfScopeCategory(label: string, scope: ResearchScope): boolean {
  const normalized = label.trim();
  if (!normalized) return true;
  if (scope.userRequest && HOODIE_SCOPE_RE.test(scope.userRequest)) {
    for (const pattern of scope.rejectedCategoryPatterns) {
      if (pattern.test(normalized)) return true;
    }
  }
  return false;
}

export function passesResearchScope(label: string, scope: ResearchScope): boolean {
  const trimmed = label.trim();
  if (!trimmed || isIncompleteSilhouette(trimmed)) return false;

  if (isOutOfScopeCategory(trimmed, scope)) return false;

  if (scope.userRequest && HOODIE_SCOPE_RE.test(scope.userRequest)) {
    const canonical = normalizeSilhouetteLabel(trimmed);
    if (!canonical) return false;
    if (scope.allowedSilhouettes.some((allowed) => silhouetteMatches(canonical, allowed))) {
      return true;
    }
    if (/heavyweight|gsm|oversized|zip|hoodie|fleece|cotton|premium|streetwear|quiet luxury|archive|minimal/i.test(trimmed)) {
      return true;
    }
    return false;
  }

  return true;
}

function silhouetteMatches(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function filterSilhouettesForScope(labels: string[], scope: ResearchScope): string[] {
  const normalized = labels
    .map((label) => normalizeSilhouetteLabel(label))
    .filter((label): label is string => Boolean(label));
  const deduped = dedupeSilhouettes(normalized);
  return deduped.filter((label) => passesResearchScope(label, scope));
}

export function scopeApprovedSilhouettes(scope: ResearchScope): string[] {
  if (scope.userRequest && HOODIE_SCOPE_RE.test(scope.userRequest)) {
    return ["Heavyweight Hoodie", "Oversized Hoodie", "Zip Hoodie"];
  }
  return scope.allowedSilhouettes.slice(0, 4);
}
