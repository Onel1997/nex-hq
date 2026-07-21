/**
 * Casting recommendations — agency-style "Best for" channels per candidate.
 * Rule-based from commercial quality dimensions (no vision model).
 */

import type { CandidateQualityDimensions } from "./quality-score";

export type CastingChannel =
  | "Social Media"
  | "Website"
  | "Paid Ads"
  | "Product Mockups"
  | "Lookbooks"
  | "Campaign Videos"
  | "Email Marketing"
  | "Homepage Hero"
  | "Brand Ambassador";

export interface CastingRecommendation {
  bestFor: CastingChannel[];
  primaryUse: CastingChannel;
  marketFitLabel: string;
  campaignReadinessLabel: string;
}

const CHANNEL_RULES: Array<{
  channel: CastingChannel;
  score: (d: CandidateQualityDimensions) => number;
}> = [
  {
    channel: "Social Media",
    score: (d) =>
      d.socialMediaPresence * 0.45 + d.communityAppeal * 0.35 + d.memorability * 0.2,
  },
  {
    channel: "Website",
    score: (d) =>
      d.commercialFace * 0.35 + d.brandMatch * 0.35 + d.premiumPresence * 0.3,
  },
  {
    channel: "Paid Ads",
    score: (d) =>
      d.commercialFace * 0.4 + d.brandRecall * 0.35 + d.eyeContact * 0.25,
  },
  {
    channel: "Product Mockups",
    score: (d) =>
      d.streetwearMatch * 0.45 + d.lifestyleAuthenticity * 0.3 + d.facialBalance * 0.25,
  },
  {
    channel: "Lookbooks",
    score: (d) =>
      d.streetwearMatch * 0.35 + d.campaignVersatility * 0.35 + d.premiumPresence * 0.3,
  },
  {
    channel: "Campaign Videos",
    score: (d) =>
      d.campaignVersatility * 0.4 + d.eyeContact * 0.3 + d.authenticity * 0.3,
  },
  {
    channel: "Email Marketing",
    score: (d) =>
      d.relatability * 0.4 + d.communityAppeal * 0.35 + d.commercialFace * 0.25,
  },
  {
    channel: "Homepage Hero",
    score: (d) =>
      d.memorability * 0.35 + d.premiumPresence * 0.35 + d.commercialFace * 0.3,
  },
  {
    channel: "Brand Ambassador",
    score: (d) =>
      d.communityAppeal * 0.35 +
      d.lifestyleAuthenticity * 0.35 +
      d.brandMatch * 0.3,
  },
];

/**
 * Derive agency-style casting recommendations from scored dimensions.
 */
export function buildCastingRecommendation(
  dimensions: CandidateQualityDimensions,
): CastingRecommendation {
  const ranked = CHANNEL_RULES.map((rule) => ({
    channel: rule.channel,
    score: rule.score(dimensions),
  })).sort((a, b) => b.score - a.score || a.channel.localeCompare(b.channel));

  const bestFor = ranked.slice(0, 4).map((r) => r.channel);
  const primaryUse = bestFor[0] ?? "Social Media";

  const marketFit =
    dimensions.brandMatch >= 75 && dimensions.streetwearMatch >= 70
      ? "Strong Market Fit"
      : dimensions.brandMatch >= 60
        ? "Solid Market Fit"
        : "Review Market Fit";

  const campaignReadiness =
    dimensions.campaignVersatility >= 75 && dimensions.commercialFace >= 70
      ? "Campaign Ready"
      : dimensions.campaignVersatility >= 60
        ? "Selective Campaign Use"
        : "Lifestyle First";

  return {
    bestFor,
    primaryUse,
    marketFitLabel: marketFit,
    campaignReadinessLabel: campaignReadiness,
  };
}
