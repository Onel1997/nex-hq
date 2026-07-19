export {
  emptyResearchStudioReport,
  RESEARCH_STUDIO_REPORT_VERSION,
  RESEARCH_STUDIO_REPORT_LEGACY_VERSION,
} from "./types";

export type {
  ReportActionCard,
  ReportBrandIntelligence,
  ReportBrandLearning,
  ReportCreativeBrief,
  ReportDesignPattern,
  ReportInsight,
  ReportOpportunity,
  ReportPatternIntelligence,
  ReportRecommendationCard,
  ReportRiskCard,
  ReportScoreBlock,
  ReportScoredOpportunity,
  ReportSourceBadge,
  ReportSourceCoverage,
  ResearchStudioReport,
  ResearchReportMode,
  ResearchProviderMode,
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

export {
  adaptLegacyResearchStudioReport,
  isCreativeResearchReport,
  isLegacyTrendReport,
} from "./legacy-adapter";
