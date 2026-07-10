export type {
  ReportActionCard,
  ReportBrandIntelligence,
  ReportCreativeBrief,
  ReportInsight,
  ReportOpportunity,
  ReportRecommendationCard,
  ReportRiskCard,
  ReportScoreBlock,
  ReportScoredOpportunity,
  ReportSourceBadge,
  ReportSourceCoverage,
  ResearchStudioReport,
} from "./types";
export {
  emptyResearchStudioReport,
  RESEARCH_STUDIO_REPORT_VERSION,
} from "./types";

export {
  formatLaunchPriority,
  formatPriority,
  formatScoreTier,
  formatSeverity,
  formatSourceLabel,
  formatSourceRole,
  priorityChipClass,
  scoreChipClass,
  severityChipClass,
  truncateText,
  uniqueSourceKeys,
} from "./formatters";

export {
  buildResearchReport,
  reportHasVisibleSections,
} from "./build-report";
export type { BuildResearchReportInput } from "./build-report";

export { syncResultToEnvelope, syncResultsToEnvelopes } from "./envelopes";
