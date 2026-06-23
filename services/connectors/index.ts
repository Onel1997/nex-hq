import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { scanAmazon, type AmazonIntelligenceData } from "./amazon";
import { scanEtsy, type EtsyIntelligenceData } from "./etsy";
import { scanGoogleTrends, type GoogleTrendsData } from "./google-trends";
import { scanPinterest, type PinterestIntelligenceData } from "./pinterest";
import { scanReddit, type RedditIntelligenceData } from "./reddit";
import { scanTikTok, type TikTokIntelligenceData } from "./tiktok";
import type { IntelligenceSignal, SourceIntelligence } from "./types";

export type {
  IntelligenceSignal,
  IntelligenceSignalCategory,
  SourceIntelligence,
  ConnectorMode,
  ConnectorIntelligenceScores,
} from "./types";

export type ExternalIntelligence = {
  googleTrends: SourceIntelligence<GoogleTrendsData>;
  reddit: SourceIntelligence<RedditIntelligenceData>;
  pinterest: SourceIntelligence<PinterestIntelligenceData>;
  tiktok: SourceIntelligence<TikTokIntelligenceData>;
  etsy: SourceIntelligence<EtsyIntelligenceData>;
  amazon: SourceIntelligence<AmazonIntelligenceData>;
};

export interface ScanExternalSourcesInput {
  baseline?: MilaeneCommerceBaseline | null;
  region?: string;
}

/** Scan all external intelligence sources in priority order. */
export async function scanExternalSources(
  input: ScanExternalSourcesInput = {},
): Promise<ExternalIntelligence> {
  const [googleTrends, reddit, pinterest, tiktok, etsy, amazon] =
    await Promise.all([
      scanGoogleTrends({ baseline: input.baseline, region: input.region }),
      scanReddit(),
      scanPinterest(),
      scanTikTok(),
      scanEtsy(),
      scanAmazon(),
    ]);

  return { googleTrends, reddit, pinterest, tiktok, etsy, amazon };
}

export function flattenExternalSignals(
  external: ExternalIntelligence,
): IntelligenceSignal[] {
  return [
    ...external.googleTrends.signals,
    ...external.reddit.signals,
    ...external.pinterest.signals,
    ...external.tiktok.signals,
    ...external.etsy.signals,
    ...external.amazon.signals,
  ];
}
