import type { LabOpsState } from "@/lib/facility/types";

export const PLACEHOLDER_LAB_IDS = [
  "operations",
  "commerce",
  "analytics",
] as const;

export type PlaceholderLabId = (typeof PLACEHOLDER_LAB_IDS)[number];

export interface PlaceholderLabSnapshot {
  id: PlaceholderLabId;
  label: string;
  opsState: LabOpsState;
  activity: string;
  progress: number | null;
  progressLabel: string | null;
  confidence: number | null;
  color: string;
}

/** Static operational placeholders — visual only, no backend wiring. */
export const PLACEHOLDER_LABS: Record<PlaceholderLabId, PlaceholderLabSnapshot> = {
  operations: {
    id: "operations",
    label: "Operations Lab",
    opsState: "executing",
    activity: "Monitoring fulfillment pipeline",
    progress: 67,
    progressLabel: "12/18",
    confidence: 84,
    color: "#14B8A6",
  },
  commerce: {
    id: "commerce",
    label: "Commerce Lab",
    opsState: "queued",
    activity: "Preparing catalog sync",
    progress: null,
    progressLabel: "Queued",
    confidence: 78,
    color: "#F97316",
  },
  analytics: {
    id: "analytics",
    label: "Analytics Lab",
    opsState: "executing",
    activity: "Processing conversion metrics",
    progress: 42,
    progressLabel: "42%",
    confidence: 91,
    color: "#8B5CF6",
  },
};
