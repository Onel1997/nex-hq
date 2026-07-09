export type {
  ReportActionCard,
  ReportInsight,
  ReportOpportunity,
  ReportRecommendationCard,
  ReportRiskCard,
  ReportScoreBlock,
  ReportSourceBadge,
  ReportSourceCoverage,
  ResearchStudioReport,
} from "./types";
export {
  emptyResearchStudioReport,
  RESEARCH_STUDIO_REPORT_VERSION,
} from "./types";

export {
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
