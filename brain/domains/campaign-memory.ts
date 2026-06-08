/**
 * Campaign Memory — Agency HQ industry domain.
 */

export type AgencyCampaignStatus =
  | "pitch"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface AgencyCampaignDeliverable {
  name: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "delivered" | "approved";
}

export interface CampaignMemoryContent {
  kind: "campaign_memory";
  campaignId: string;
  name: string;
  clientId: string;
  status: AgencyCampaignStatus;
  objective?: string;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  deliverables?: AgencyCampaignDeliverable[];
  channels?: string[];
}
