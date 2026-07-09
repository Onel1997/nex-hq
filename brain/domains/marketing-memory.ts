/**
 * Marketing Memory — campaigns, calendars, channel mix, KPIs, growth playbooks.
 */

export type CampaignStatus = "planned" | "active" | "paused" | "completed" | "cancelled";

export interface CampaignKpi {
  metric: string;
  target: string;
  actual?: string;
}

export interface ChannelMixEntry {
  channel: string;
  role: string;
  budgetPercent?: number;
}

export interface MarketingMemoryContent {
  kind: "marketing_memory";
  campaignId?: string;
  name: string;
  status: CampaignStatus;
  objective?: string;
  startDate?: string;
  endDate?: string;
  channelMix?: ChannelMixEntry[];
  kpis?: CampaignKpi[];
  launchSequence?: string[];
  relatedDropId?: string;
  notes?: string;
}
