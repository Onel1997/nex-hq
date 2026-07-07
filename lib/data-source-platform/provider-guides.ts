import type { ProviderId } from "./types";

export interface ProviderSetupGuide {
  /** One-line description of what this source provides when live. */
  purpose: string;
  /** Human-readable setup steps (no secret values). */
  steps: string[];
  /** Why data may be simulated instead of live. */
  simulatedWhen: string;
  /** Env var names required for live mode (shown in developer section only). */
  requiredEnvKeys: string[];
  docsUrl?: string;
}

export const PROVIDER_SETUP_GUIDES: Record<ProviderId, ProviderSetupGuide> = {
  shopify: {
    purpose:
      "Live catalog, collections, inventory, tags, and product images from your Shopify store.",
    steps: [
      "Create a custom app in Shopify Admin → Settings → Apps and sales channels → Develop apps.",
      "Enable Admin API scopes: read_products, read_inventory, read_product_listings (read_orders optional for sales velocity).",
      "Install the app and copy Client ID and Client Secret.",
      "Set SHOPIFY_STORE_DOMAIN (e.g. your-store.myshopify.com), SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET in .env.local.",
      "Restart the dev server, then run Health and Test in this panel.",
    ],
    simulatedWhen:
      "Never faked on failure — if credentials are missing or the API is unreachable, no catalog data is returned. Status shows Simulated or Offline until a live sync succeeds.",
    requiredEnvKeys: [
      "SHOPIFY_STORE_DOMAIN",
      "SHOPIFY_CLIENT_ID",
      "SHOPIFY_CLIENT_SECRET",
    ],
    docsUrl: "https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials",
  },
  google_trends: {
    purpose:
      "Keyword trend growth, related rising queries, regional interest (DE), and seasonal movement via SerpAPI Google Trends.",
    steps: [
      "Create a SerpAPI account at serpapi.com and copy your API key.",
      "Set GOOGLE_TRENDS_API_KEY in .env.local (this is a SerpAPI key, not a Google Cloud API key).",
      "Restart the dev server, then run Health and Test.",
      "Live mode scans up to 10 streetwear keywords plus top Shopify product titles when Shopify is connected.",
    ],
    simulatedWhen:
      "Without GOOGLE_TRENDS_API_KEY, or if SerpAPI fails, keyword demand/change values are static estimates — not live Google data. UI will show Simulated.",
    requiredEnvKeys: ["GOOGLE_TRENDS_API_KEY"],
    docsUrl: "https://serpapi.com/google-trends-api",
  },
  pinterest: {
    purpose: "Pinterest aesthetics, color worlds, and rising board trends.",
    steps: [
      "Obtain a Pinterest API access token with read scopes.",
      "Set PINTEREST_ACCESS_TOKEN in .env.local.",
      "Restart and run Test.",
    ],
    simulatedWhen:
      "Without PINTEREST_ACCESS_TOKEN, aesthetics and board trends use static fashion intelligence — not live Pinterest API data.",
    requiredEnvKeys: ["PINTEREST_ACCESS_TOKEN"],
  },
  tiktok: {
    purpose: "TikTok hashtag velocity, viral trends, and silhouette signals.",
    steps: [
      "Obtain a TikTok Research or Marketing API key from TikTok for Developers.",
      "Set TIKTOK_API_KEY in .env.local.",
      "Restart and run Test.",
    ],
    simulatedWhen:
      "Without TIKTOK_API_KEY, hashtag and trend data is simulated streetwear intelligence.",
    requiredEnvKeys: ["TIKTOK_API_KEY"],
  },
  etsy: {
    purpose: "Etsy marketplace bestsellers and handmade fashion keywords.",
    steps: [
      "Register an Etsy app and obtain an API key string.",
      "Set ETSY_API_KEY in .env.local.",
      "Restart and run Test.",
    ],
    simulatedWhen:
      "Without ETSY_API_KEY, bestseller and keyword data is simulated.",
    requiredEnvKeys: ["ETSY_API_KEY"],
  },
  amazon: {
    purpose: "Amazon category bestsellers and competitive pricing signals.",
    steps: [
      "Obtain an Amazon Product Advertising or Selling Partner API credential.",
      "Set AMAZON_API_KEY in .env.local.",
      "Restart and run Test.",
    ],
    simulatedWhen:
      "Without AMAZON_API_KEY, category and bestseller data is simulated.",
    requiredEnvKeys: ["AMAZON_API_KEY"],
  },
  reddit: {
    purpose: "Reddit community discussions and emerging fashion topics.",
    steps: [
      "Create a Reddit app at reddit.com/prefs/apps (script or web app).",
      "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local.",
      "Restart and run Test.",
    ],
    simulatedWhen:
      "Without Reddit OAuth credentials, community threads and trends are simulated.",
    requiredEnvKeys: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
  },
  instagram: {
    purpose: "Instagram visual trends and creator aesthetics.",
    steps: [
      "Instagram Graph API requires Meta Business verification — integration coming later.",
    ],
    simulatedWhen:
      "Instagram is not yet connected. All data is Coming Soon.",
    requiredEnvKeys: ["INSTAGRAM_ACCESS_TOKEN"],
  },
  fashion_news: {
    purpose: "Fashion industry RSS headlines and editorial signals.",
    steps: [
      "Provide a fashion news RSS feed URL.",
      "Set FASHION_NEWS_RSS_URL in .env.local.",
      "Restart and run Test.",
    ],
    simulatedWhen:
      "Without FASHION_NEWS_RSS_URL, news feed is not available — Coming Soon.",
    requiredEnvKeys: ["FASHION_NEWS_RSS_URL"],
  },
};

export function getProviderSetupGuide(id: ProviderId): ProviderSetupGuide {
  return PROVIDER_SETUP_GUIDES[id];
}
