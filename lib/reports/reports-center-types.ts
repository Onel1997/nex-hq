/** Client-safe report view types shared by Research and report handoff code. */

import type { ReportAgentTab, ReportSource } from "@/lib/reports/report-source";

export type ReportsCenterSource = ReportSource;
export type ReportsCenterAgentTab = ReportAgentTab;

export interface ReportsCenterDesignCollection {
  name: string;
  story?: string;
  mood?: string;
  philosophy?: string;
  heroDesignId: string;
  campaignTheme?: string;
  collectionScore?: number;
}

export interface ReportsCenterDesignConceptSummary {
  designId: string;
  title: string;
  collectionRole: string;
  product: string;
  color: string;
  printArea: string;
  placement: string;
  dimensions: string;
  productionMethod: string;
  dnaScore: number;
  commercialScore?: number;
  campaignPotential?: string;
  isHero: boolean;
}

export interface ReportsCenterDesignResearch {
  reportId: string;
  hasDesignResearch: boolean;
  designCount: number;
  collection?: ReportsCenterDesignCollection;
  designs: ReportsCenterDesignConceptSummary[];
}
