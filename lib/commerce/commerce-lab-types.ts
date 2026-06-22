/** Client-safe types for Commerce Lab V1. */

export interface CommerceLabProductRow {
  title: string;
  productKey: string;
  category: string;
  vendor: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  historicalScore: number;
  bestsellerRank: number;
  trendScore: number;
  firstSale: string | null;
  lastSale: string | null;
}

export interface CommerceLabCategoryRow {
  category: string;
  unitsSold: number;
  revenue: number;
  productCount: number;
  rank: number;
  sharePercent: number;
}

export interface CommerceLabSeasonRow {
  month: number;
  monthLabel: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface CommerceLabSeasonSummary {
  season: string;
  months: string[];
  unitsSold: number;
  revenue: number;
}

export interface CommerceLabInsight {
  id: string;
  category: "commerce" | "ceo" | "design" | "marketing";
  message: string;
  priority: "high" | "medium" | "low";
  action?: string;
}

export interface CommerceLabRevenueIntelligence {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  averageOrderValue: number;
  firstOrder: string | null;
  latestOrder: string | null;
  revenueGrowthPercent: number | null;
  revenueGrowthLabel: string;
  currency: string;
  totalUnits: number;
}

export interface CommerceLabProductIntelligence {
  bestsellers: CommerceLabProductRow[];
  worstPerforming: CommerceLabProductRow[];
  highestRevenue: CommerceLabProductRow[];
  highestVolume: CommerceLabProductRow[];
  lifetimeRevenue: CommerceLabProductRow[];
}

export interface CommerceLabSeasonalIntelligence {
  revenueByMonth: CommerceLabSeasonRow[];
  unitsByMonth: CommerceLabSeasonRow[];
  strongestSeason: CommerceLabSeasonSummary | null;
  weakestSeason: CommerceLabSeasonSummary | null;
  suggestedDropWindows: string[];
}

export interface CommerceLabCategoryIntelligence {
  revenueByCategory: CommerceLabCategoryRow[];
  unitsByCategory: CommerceLabCategoryRow[];
  fastestGrowingCategory: CommerceLabCategoryRow | null;
}

export interface CommerceLabIntegrations {
  ceoCommand: string;
  designStudio: string;
  shopifyOperations: string;
  marketingCenter: string;
}

export interface CommerceLabPayload {
  mission: string;
  loadedAt: string;
  dataSource: string;
  hasHistoricalData: boolean;
  revenue: CommerceLabRevenueIntelligence;
  products: CommerceLabProductIntelligence;
  seasonal: CommerceLabSeasonalIntelligence;
  categories: CommerceLabCategoryIntelligence;
  recommendations: CommerceLabInsight[];
  ceoInsights: CommerceLabInsight[];
  designInsights: CommerceLabInsight[];
  marketingInsights: CommerceLabInsight[];
  integrations: CommerceLabIntegrations;
  warnings: string[];
}
