import { MILAENE_DNA, scoreDnaAlignment } from "@/services/milaene-dna";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";

export interface TrendScore {
  id: string;
  label: string;
  change: number;
  direction: "up" | "down" | "stable";
  dnaMatch: number;
  source: string;
}

const BASE_TRENDS: Omit<TrendScore, "dnaMatch">[] = [
  {
    id: "oversized",
    label: "Oversized",
    change: 18,
    direction: "up",
    source: "TikTok",
  },
  {
    id: "earth-tones",
    label: "Earth Tones",
    change: 22,
    direction: "up",
    source: "Pinterest",
  },
  {
    id: "premium-streetwear",
    label: "Premium Streetwear",
    change: 15,
    direction: "up",
    source: "Google Trends",
  },
  {
    id: "slim-fit",
    label: "Slim Fit",
    change: -8,
    direction: "down",
    source: "Reddit",
  },
  {
    id: "embroidery",
    label: "Embroidery Detail",
    change: 12,
    direction: "up",
    source: "MarketPrint",
  },
  {
    id: "boxy-silhouette",
    label: "Boxy Silhouettes",
    change: 14,
    direction: "up",
    source: "TikTok",
  },
];

function computeDnaMatch(trend: Omit<TrendScore, "dnaMatch">): number {
  const label = trend.label.toLowerCase();
  return scoreDnaAlignment({
    styleMatch: /premium|streetwear|editorial/.test(label) ? 95 : 70,
    silhouetteMatch: MILAENE_DNA.silhouettes.some((s) => label.includes(s))
      ? 92
      : label.includes("slim")
        ? 25
        : 65,
    colorMatch: /earth|obsidian|signal|concrete|off white/.test(label) ? 88 : 60,
    qualityMatch: /premium|embroidery/.test(label) ? 90 : 72,
  });
}

export interface TrendScannerInput {
  baseline?: MilaeneCommerceBaseline | null;
}

/** Scan market trends and score against Milaene DNA. */
export function scanTrends(input: TrendScannerInput = {}): TrendScore[] {
  const { baseline } = input;

  const dynamicTrends: TrendScore[] = [];

  if (baseline) {
    for (const insight of baseline.insights) {
      if (!/trend|season|streetwear|oversized|earth|demand/i.test(insight.message)) {
        continue;
      }
      const changeMatch = insight.message.match(/([+-]?\d+)\s*%/);
      const change = changeMatch ? Number(changeMatch[1]) : 10;
      dynamicTrends.push({
        id: `insight-${insight.kind}`,
        label: insight.message.split("—")[0]?.trim() ?? insight.message.slice(0, 40),
        change,
        direction: change >= 0 ? "up" : "down",
        dnaMatch: computeDnaMatch({
          id: insight.kind,
          label: insight.message,
          change,
          direction: change >= 0 ? "up" : "down",
          source: "Shopify",
        }),
        source: "Shopify",
      });
    }
  }

  const baseScored = BASE_TRENDS.map((t) => ({
    ...t,
    dnaMatch: computeDnaMatch(t),
  }));

  const merged = [...dynamicTrends, ...baseScored];
  const seen = new Set<string>();
  return merged.filter((t) => {
    const key = t.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatTrendChange(trend: TrendScore): string {
  const sign = trend.change >= 0 ? "+" : "";
  return `${sign}${trend.change}%`;
}
