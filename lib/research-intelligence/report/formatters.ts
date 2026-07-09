import type { ConfidenceTier } from "../types/confidence";
import type { RecommendationPriority } from "../types/recommendation";
import type { ReasoningSeverity } from "../types/reasoning";
import { getSourceWeightProfile, roleLabel } from "../confidence/source-weights";

export function formatScoreTier(tier: ConfidenceTier | string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function formatPriority(priority: RecommendationPriority | string): string {
  switch (priority) {
    case "act":
      return "Act";
    case "monitor":
      return "Monitor";
    case "explore":
      return "Explore";
    case "avoid":
      return "Avoid";
    default:
      return priority;
  }
}

export function formatSeverity(severity: ReasoningSeverity | string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function formatSourceLabel(sourceKey: string): string {
  return getSourceWeightProfile(sourceKey).label;
}

export function formatSourceRole(sourceKey: string): string {
  return roleLabel(getSourceWeightProfile(sourceKey).role);
}

export function scoreChipClass(score: number, tier?: string): string {
  if (tier === "verified" || score >= 85) return "rs3-chip-verified";
  if (tier === "high" || score >= 65) return "rs3-chip-high";
  if (tier === "medium" || score >= 35) return "rs3-chip-medium";
  return "rs3-chip-low";
}

export function priorityChipClass(priority: string): string {
  switch (priority) {
    case "act":
      return "rs3-priority-act";
    case "monitor":
      return "rs3-priority-monitor";
    case "avoid":
      return "rs3-priority-avoid";
    default:
      return "rs3-priority-explore";
  }
}

export function severityChipClass(severity: string): string {
  switch (severity) {
    case "high":
      return "rs3-severity-high";
    case "medium":
      return "rs3-severity-medium";
    default:
      return "rs3-severity-low";
  }
}

export function truncateText(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function uniqueSourceKeys(keys: string[]): string[] {
  return [...new Set(keys.filter(Boolean))];
}
