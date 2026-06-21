import type { ReportListItem } from "@/lib/mock/reports";
import type {
  FacilityEvent,
  LabInspectorMetrics,
  LabTaskSnapshot,
} from "@/lib/facility/types";

export interface ResearchIntelItem {
  id: string;
  title: string;
  reportType: string;
  confidence: number;
  createdAt: string;
  status: string;
  summary: string;
}

export interface ResearchIntelligence {
  reports: ResearchIntelItem[];
  trendAnalyses: string[];
  competitorReports: ResearchIntelItem[];
  streetwearInsights: string[];
  colorDirections: string[];
  confidence: number | null;
}

export interface DesignIntelItem {
  id: string;
  title: string;
  collectionName: string;
  confidence: number;
  createdAt: string;
  status: string;
}

export interface DesignIntelligence {
  reports: DesignIntelItem[];
  collectionConcepts: Array<{ name: string; story: string; season?: string; theme?: string }>;
  productDirections: string[];
  products: Array<{
    name: string;
    category: string;
    fit: string;
    material: string;
    color: string;
    pricePosition: string;
    priority: string;
  }>;
  moodboardColors: Array<{ name: string; hex?: string; role: string }>;
  visualReferences: string[];
  collectionStory: string | null;
  mood: string | null;
  stylingDirection: string | null;
  approvedConcepts: DesignIntelItem[];
  currentCollection: string | null;
  confidence: number | null;
}

export interface MarketingIntelItem {
  id: string;
  title: string;
  confidence: number;
  createdAt: string;
  status: string;
}

export interface MarketingIntelligence {
  reports: MarketingIntelItem[];
  launchPlans: string[];
  targetAudiences: string[];
  strategies: string[];
  contentInitiatives: Array<{ day: number; title: string; channel: string }>;
  confidence: number | null;
}

export interface ContentIntelItem {
  id: string;
  title: string;
  confidence: number;
  createdAt: string;
  status: string;
}

export interface ContentIntelligence {
  reports: ContentIntelItem[];
  contentQueue: LabTaskSnapshot[];
  hooks: string[];
  captions: string[];
  postIdeas: string[];
  publishingStatus: Array<{ title: string; status: string }>;
}

export interface ImageIntelItem {
  id: string;
  title: string;
  confidence: number;
  createdAt: string;
  status: string;
  assetCount: number;
}

export interface ImageIntelligence {
  reports: ImageIntelItem[];
  prompts: Array<{ title: string; prompt: string }>;
  assets: Array<{ title: string; type: string; status: string }>;
  campaignVisuals: string[];
  productImages: string[];
  generationStatus: Array<{ name: string; status: string }>;
}

export interface CeoIntelligence {
  currentObjective: string | null;
  activeDelegations: LabTaskSnapshot[];
  recentDecisions: Array<{ label: string; timestamp: string }>;
  finalReports: Array<{ title: string; completionScore: number; verdict: string }>;
  completionPercentage: number | null;
  executiveConfidence: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildLabMetrics(
  reports: ReportListItem[],
  tasks: LabTaskSnapshot[],
): LabInspectorMetrics {
  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "failed",
  );
  return {
    confidence: reports[0]?.confidence ?? null,
    reportCount: reports.length,
    activeTaskCount: activeTasks.length,
    approvedReportCount: reports.filter((r) => r.status === "approved").length,
  };
}

export function extractResearchIntelligence(
  reports: ReportListItem[],
): ResearchIntelligence {
  const items: ResearchIntelItem[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    reportType: String(r.reportType ?? "research"),
    confidence: r.confidence,
    createdAt: r.createdAt,
    status: r.status,
    summary: r.summary,
  }));

  const trendAnalyses = reports
    .filter((r) => r.reportType === "trend")
    .map((r) => r.summary);

  const competitorReports = items.filter((r) => r.reportType === "competitor");

  const streetwearInsights = [
    ...reports.flatMap((r) => r.highlights ?? []),
    ...reports.flatMap((r) => r.opportunities ?? []),
  ].slice(0, 8);

  const colorDirections = reports
    .flatMap((r) => r.recommendations ?? [])
    .filter((s) => /color|palette|hue|tone|shade/i.test(s))
    .slice(0, 6);

  return {
    reports: items,
    trendAnalyses,
    competitorReports,
    streetwearInsights,
    colorDirections,
    confidence: reports[0]?.confidence ?? null,
  };
}

export function extractDesignIntelligence(
  reports: ReportListItem[],
): DesignIntelligence {
  const latest = reports[0]?.designReport;
  const items: DesignIntelItem[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    collectionName: r.designReport?.collectionName ?? r.title,
    confidence: r.confidence,
    createdAt: r.createdAt,
    status: r.status,
  }));

  const collectionConcepts = reports
    .filter((r) => r.designReport)
    .map((r) => ({
      name: r.designReport!.collectionName,
      story: r.designReport!.story ?? r.designReport!.collectionStory,
      season: r.designReport!.season,
      theme: r.designReport!.theme,
    }));

  const products = reports.flatMap((r) => {
    const design = r.designReport;
    if (!design) return [];
    const lineup =
      design.products ??
      design.productLineup.map((p) => ({
        name: p.name,
        category: p.category,
        fit: "—",
        material: "—",
        color: "—",
        pricePosition: "—",
        priority: "core",
      }));
    return lineup.map((p) => ({
      name: p.name,
      category: p.category,
      fit: p.fit,
      material: p.material,
      color: p.color,
      pricePosition: p.pricePosition,
      priority: p.priority,
    }));
  });

  const productDirections = [
    ...reports.flatMap((r) => r.designReport?.silhouettes ?? []),
    ...products.map((p) => p.name),
  ].slice(0, 10);

  const moodboardColors = reports.flatMap(
    (r) => r.designReport?.colorPalette ?? [],
  );

  const visualReferences = [
    ...reports.flatMap((r) => r.designReport?.visualKeywords ?? []),
    ...reports.flatMap((r) => r.designReport?.mockupIdeas ?? []),
    ...reports.flatMap((r) => r.designReport?.imagePrompts ?? []),
  ].slice(0, 12);

  const approvedConcepts = items.filter((r) => r.status === "approved");

  return {
    reports: items,
    collectionConcepts,
    productDirections,
    products,
    moodboardColors,
    visualReferences,
    collectionStory:
      latest?.story ?? latest?.collectionStory ?? null,
    mood: latest?.moodDescription ?? null,
    stylingDirection:
      latest?.stylingDirection ?? latest?.designDirection ?? null,
    approvedConcepts,
    currentCollection: latest?.collectionName ?? null,
    confidence: reports[0]?.confidence ?? null,
  };
}

export function extractMarketingIntelligence(
  reports: ReportListItem[],
): MarketingIntelligence {
  const items: MarketingIntelItem[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    confidence: r.confidence,
    createdAt: r.createdAt,
    status: r.status,
  }));

  const launchPlans = reports
    .map((r) => r.marketingReport?.launchStrategy ?? r.summary)
    .filter(Boolean);

  const targetAudiences = reports
    .map((r) => r.marketingReport?.communityBuildingPlan)
    .filter(Boolean) as string[];

  const strategies = reports.flatMap(
    (r) => r.marketingReport?.contentPillars ?? [],
  );

  const contentInitiatives = reports.flatMap(
    (r) =>
      r.marketingReport?.contentCalendar30Day?.slice(0, 5).map((e) => ({
        day: e.day,
        title: e.title,
        channel: e.channel,
      })) ?? [],
  );

  return {
    reports: items,
    launchPlans,
    targetAudiences,
    strategies,
    contentInitiatives,
    confidence: reports[0]?.confidence ?? null,
  };
}

export function extractContentIntelligence(
  reports: ReportListItem[],
  tasks: LabTaskSnapshot[],
): ContentIntelligence {
  const items: ContentIntelItem[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    confidence: r.confidence,
    createdAt: r.createdAt,
    status: r.status,
  }));

  const contentQueue = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "failed",
  );

  const hooks = reports.flatMap(
    (r) => r.contentReport?.socialContent.tiktokHooks ?? [],
  );

  const captions = reports.flatMap(
    (r) => r.contentReport?.socialContent.instagramCaptions ?? [],
  );

  const postIdeas = [
    ...reports.flatMap((r) => r.contentReport?.socialContent.launchPosts ?? []),
    ...reports.flatMap((r) => r.contentReport?.socialContent.storyIdeas ?? []),
  ];

  const publishingStatus = items.map((r) => ({
    title: r.title,
    status: r.status,
  }));

  return {
    reports: items,
    contentQueue,
    hooks,
    captions,
    postIdeas,
    publishingStatus,
  };
}

export function extractImageIntelligence(
  reports: ReportListItem[],
): ImageIntelligence {
  const items: ImageIntelItem[] = reports.map((r) => ({
    id: r.id,
    title: r.title,
    confidence: r.confidence,
    createdAt: r.createdAt,
    status: r.status,
    assetCount: r.imageProject?.assetCount ?? 0,
  }));

  const prompts = reports.flatMap((r) => {
    const project = r.imageProject;
    if (!project) return [];
    return [...project.corePackage, ...project.advancedPackage]
      .slice(0, 6)
      .map((asset) => ({
        title: asset.title,
        prompt: asset.prompt.openai || asset.prompt.midjourney || asset.prompt.flux,
      }));
  });

  const assets = reports.flatMap((r) => {
    const project = r.imageProject;
    if (!project) return [];
    return [...project.corePackage, ...project.advancedPackage]
      .slice(0, 8)
      .map((asset) => ({
        title: asset.title,
        type: asset.type,
        status: asset.status,
      }));
  });

  const campaignVisuals = reports.flatMap((r) =>
    (r.imageProject?.campaignShots ?? []).map((s) => s.shotName),
  );

  const productImages = reports.flatMap((r) =>
    (r.imageProject?.corePackage ?? [])
      .filter((a) => a.type === "product_mockup" || a.type === "hero_banner")
      .map((a) => a.title),
  );

  const generationStatus = assets.map((a) => ({
    name: a.title,
    status: a.status,
  }));

  return {
    reports: items,
    prompts,
    assets,
    campaignVisuals,
    productImages,
    generationStatus,
  };
}

export function extractCeoIntelligence(
  reports: ReportListItem[],
  tasks: LabTaskSnapshot[],
  events: FacilityEvent[],
): CeoIntelligence {
  const finalReports = reports
    .filter((r) => r.ceoFinalReport || r.reportType === "ceo-final-report")
    .map((r) => ({
      title: r.title,
      completionScore: r.ceoFinalReport?.completionScore ?? Math.round(r.confidence * 100),
      verdict: r.ceoFinalReport?.ceoVerdict ?? r.summary,
    }));

  const latestFinal = reports.find(
    (r) => r.ceoFinalReport || r.reportType === "ceo-final-report",
  );

  const activeDelegations = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "failed",
  );

  const decisionEvents = events
    .filter(
      (e) =>
        e.type.startsWith("task.") ||
        e.type.startsWith("report.") ||
        e.type.startsWith("ceo."),
    )
    .slice(0, 6)
    .map((e) => ({
      label: e.summary,
      timestamp: e.timestamp,
    }));

  return {
    currentObjective:
      latestFinal?.ceoFinalReport?.founderGoal ??
      tasks[0]?.title ??
      null,
    activeDelegations,
    recentDecisions: decisionEvents,
    finalReports,
    completionPercentage: latestFinal?.ceoFinalReport?.completionScore ?? null,
    executiveConfidence: latestFinal?.confidence ?? reports[0]?.confidence ?? null,
  };
}

export { formatDate as formatInspectorDate };
