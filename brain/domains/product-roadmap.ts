/**
 * Product Roadmap — SaaS HQ industry domain.
 */

export type RoadmapItemStatus =
  | "idea"
  | "planned"
  | "in_progress"
  | "shipped"
  | "deprecated";

export type RoadmapPriority = "low" | "medium" | "high" | "critical";

export interface RoadmapItem {
  itemId: string;
  title: string;
  status: RoadmapItemStatus;
  priority: RoadmapPriority;
  targetQuarter?: string;
  description?: string;
  customerRequests?: number;
}

export interface ProductRoadmapContent {
  kind: "product_roadmap";
  productName: string;
  currentVersion?: string;
  items: RoadmapItem[];
  themes?: string[];
  releaseCadence?: string;
}
