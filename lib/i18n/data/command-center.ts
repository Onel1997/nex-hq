import type { AgentId } from "@/lib/constants/agents";
import type {
  AgentLiveStatus,
  BrainNode,
  IntelligenceItem,
  StatusPulse,
  SuggestedAction,
} from "@/lib/mock/command-center";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

export function getFounderName(_locale: Locale): string {
  return getDictionary(_locale).common.founder;
}

export function getStatusPulses(locale: Locale): StatusPulse[] {
  const { dashboard } = getDictionary(locale);

  return [
    {
      id: "brand-health",
      label: dashboard.pulses.brandHealth.label,
      value: dashboard.pulses.brandHealth.value,
      detail: dashboard.pulses.brandHealth.detail,
      state: "nominal",
    },
    {
      id: "active-projects",
      label: dashboard.pulses.activeProjects.label,
      value: dashboard.pulses.activeProjects.value,
      detail: dashboard.pulses.activeProjects.detail,
      state: "nominal",
    },
    {
      id: "ai-team",
      label: dashboard.pulses.aiTeam.label,
      value: dashboard.pulses.aiTeam.value,
      detail: dashboard.pulses.aiTeam.detail,
      state: "nominal",
    },
    {
      id: "alerts",
      label: dashboard.pulses.alerts.label,
      value: dashboard.pulses.alerts.value,
      detail: dashboard.pulses.alerts.detail,
      state: "attention",
    },
  ];
}

export function getPulseStateLabel(
  locale: Locale,
  state: StatusPulse["state"],
): string {
  return getDictionary(locale).common.status[state];
}

export function getSuggestedActions(locale: Locale): SuggestedAction[] {
  const { dashboard } = getDictionary(locale);

  return [
    {
      id: "research-trends",
      label: dashboard.suggestedActions.researchTrends.label,
      description: dashboard.suggestedActions.researchTrends.description,
    },
    {
      id: "capsule-concept",
      label: dashboard.suggestedActions.capsuleConcept.label,
      description: dashboard.suggestedActions.capsuleConcept.description,
    },
    {
      id: "review-reports",
      label: dashboard.suggestedActions.reviewReports.label,
      description: dashboard.suggestedActions.reviewReports.description,
    },
    {
      id: "content-plan",
      label: dashboard.suggestedActions.contentPlan.label,
      description: dashboard.suggestedActions.contentPlan.description,
    },
  ];
}

export function getAgentLiveStatus(locale: Locale): AgentLiveStatus[] {
  const { dashboard } = getDictionary(locale);
  const agentIds: AgentId[] = [
    "ceo",
    "research",
    "designer",
    "content",
    "image",
    "marketing",
    "shopify",
  ];

  return agentIds.map((id) => {
    const live = dashboard.agentLive[id];
    return {
      id,
      status:
        id === "ceo" ||
        id === "research" ||
        id === "designer" ||
        id === "content" ||
        id === "image" ||
        id === "marketing" ||
        id === "shopify"
          ? "active"
          : "planned",
      currentFocus: live.currentFocus,
      nextTask: live.nextTask,
      priority: {
        ceo: "urgent",
        research: "high",
        designer: "high",
        content: "medium",
        image: "medium",
        marketing: "medium",
        shopify: "medium",
      }[id] as AgentLiveStatus["priority"],
    };
  });
}

export function getIntelligenceFeed(locale: Locale): IntelligenceItem[] {
  const { dashboard } = getDictionary(locale);

  return [
    {
      id: "int-1",
      type: "trend",
      title: dashboard.intelligenceFeed.int1.title,
      insight: dashboard.intelligenceFeed.int1.insight,
      time: dashboard.intelligenceFeed.int1.time,
      actionable: true,
    },
    {
      id: "int-2",
      type: "design",
      title: dashboard.intelligenceFeed.int2.title,
      insight: dashboard.intelligenceFeed.int2.insight,
      time: dashboard.intelligenceFeed.int2.time,
    },
    {
      id: "int-3",
      type: "market",
      title: dashboard.intelligenceFeed.int3.title,
      insight: dashboard.intelligenceFeed.int3.insight,
      time: dashboard.intelligenceFeed.int3.time,
      actionable: true,
    },
    {
      id: "int-4",
      type: "content",
      title: dashboard.intelligenceFeed.int4.title,
      insight: dashboard.intelligenceFeed.int4.insight,
      time: dashboard.intelligenceFeed.int4.time,
    },
    {
      id: "int-5",
      type: "trend",
      title: dashboard.intelligenceFeed.int5.title,
      insight: dashboard.intelligenceFeed.int5.insight,
      time: dashboard.intelligenceFeed.int5.time,
    },
  ];
}

export function getBrainNodes(locale: Locale): BrainNode[] {
  const { dashboard } = getDictionary(locale);

  return [
    {
      id: "brand",
      label: dashboard.brainNodes.brand,
      entries: 8,
      sync: 100,
      status: "live",
    },
    {
      id: "design",
      label: dashboard.brainNodes.design,
      entries: 6,
      sync: 100,
      status: "live",
    },
    {
      id: "competitor",
      label: dashboard.brainNodes.competitor,
      entries: 5,
      sync: 72,
      status: "syncing",
    },
    {
      id: "content",
      label: dashboard.brainNodes.content,
      entries: 7,
      sync: 100,
      status: "live",
    },
    {
      id: "marketing",
      label: dashboard.brainNodes.marketing,
      entries: 4,
      sync: 88,
      status: "live",
    },
  ];
}

export function getIntelligenceTypeLabel(
  locale: Locale,
  type: IntelligenceItem["type"],
): string {
  return getDictionary(locale).common.intelligenceType[type];
}
