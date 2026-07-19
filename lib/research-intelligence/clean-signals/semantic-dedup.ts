import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getIntelligenceCopy } from "../copy";
import type { ResearchRecommendation } from "../types/recommendation";
import type { ReportActionCard } from "../report/types";

function normalizeActionText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

export function actionSemanticKey(parts: {
  title: string;
  why?: string;
  suggestedNextStep?: string;
}): string {
  const blob = normalizeActionText(
    [parts.title, parts.why ?? "", parts.suggestedNextStep ?? ""].join(" "),
  );
  if (/tiktok|pinterest|social.?momentum|social-momentum|zielgruppenresonanz/.test(blob)) {
    return "social-momentum";
  }
  if (/google trends|suchnachfrage/.test(blob)) return "google-trends";
  if (/shopify verbinden|shopify/.test(blob) && /verbinden|connect/.test(blob)) {
    return "connect-shopify";
  }
  if (/quellen|coverage|abdeckung erweitern/.test(blob)) return "expand-coverage";
  return normalizeActionText(parts.title);
}

export function dedupeActionCardsSemantic(actions: ReportActionCard[]): ReportActionCard[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const seen = new Map<string, ReportActionCard>();

  for (const action of actions) {
    const key = actionSemanticKey(action);
    const existing = seen.get(key);

    if (key === "social-momentum") {
      seen.set(key, {
        id: action.id,
        title: copy.socialMomentumTitle,
        why: copy.socialMomentumDesc,
        priority: action.priority,
        suggestedNextStep: copy.socialMomentumDesc,
      });
      continue;
    }

    if (!existing) {
      seen.set(key, {
        ...action,
        why: dedupeBodyFromTitle(action.title, action.why),
      });
      continue;
    }
  }

  return [...seen.values()].slice(0, 6);
}

function dedupeBodyFromTitle(title: string, why: string): string {
  const normalizedTitle = normalizeActionText(title);
  const normalizedWhy = normalizeActionText(why);
  if (normalizedWhy === normalizedTitle || normalizedWhy.startsWith(normalizedTitle)) {
    return why;
  }
  if (normalizedTitle.length > 0 && normalizedWhy.includes(normalizedTitle)) {
    return why.replace(new RegExp(normalizedTitle, "i"), "").trim();
  }
  return why;
}

export function dedupeRecommendationsSemantic(
  items: ResearchRecommendation[],
): ResearchRecommendation[] {
  const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
  const seen = new Map<string, ResearchRecommendation>();

  for (const item of items) {
    const key =
      item.type === "next_research_action"
        ? actionSemanticKey({
            title: item.title,
            why: item.why,
            suggestedNextStep: item.suggestedNextStep,
          })
        : `${item.type}:${normalizeActionText(item.title)}`;

    if (key === "social-momentum") {
      seen.set(key, {
        ...item,
        title: copy.socialMomentumTitle,
        why: copy.socialMomentumDesc,
        suggestedNextStep: copy.socialMomentumDesc,
        narrative: copy.socialMomentumDesc,
      });
      continue;
    }

    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}
