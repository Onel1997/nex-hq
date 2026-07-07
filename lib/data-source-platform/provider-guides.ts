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
    purpose:
      "DE fashion trending keywords, authenticated board insights, pin color signals, and aesthetic trends via Pinterest API v5.",
    steps: [
      "Create a Pinterest app at developers.pinterest.com and generate an OAuth access token.",
      "Required scopes: user_accounts:read (health), boards:read (boards), pins:read (pin colors). Trends API may require additional Business/Ads approval.",
      "Set PINTEREST_ACCESS_TOKEN in .env.local (never commit the token).",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode fetches DE fashion trending keywords, your account boards, and dominant_color from owned pins.",
      "Limitation: Trends API returns keywords only — not full trends.pinterest.com visuals. Boards/pins are from your account, not global Pinterest.",
    ],
    simulatedWhen:
      "Without PINTEREST_ACCESS_TOKEN, or if the API is unreachable, no Pinterest data is returned. Status shows Simulated (missing credentials) or Offline (API failure). Save counts are unavailable via API — follower_count is used as a proxy on boards.",
    requiredEnvKeys: ["PINTEREST_ACCESS_TOKEN"],
    docsUrl: "https://developers.pinterest.com/docs/api/v5/trending_keywords-list",
  },
  tiktok: {
    purpose:
      "DE fashion hashtag engagement (views, likes, comments, shares), co-occurring hashtags, and color/silhouette signals via the official TikTok Research API.",
    steps: [
      "Apply for TikTok Research API access at developers.tiktok.com/products/research-api (approved research projects only — academic/non-profit; approval can take ~4 weeks).",
      "Create a project and copy the Client key and Client secret.",
      "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env.local (never commit the secret).",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode queries a fixed set of DE fashion hashtags and aggregates engagement per hashtag over the last 30 days.",
      "Limitation: The official API has NO global trend-discovery endpoint — new/emerging hashtags cannot be discovered, only queried. Data is archived (up to 48h/10d lag) and 'change' reflects engagement rate, not velocity.",
    ],
    simulatedWhen:
      "Without TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET, or if the Research API is unreachable/unapproved, no TikTok data is returned. Status shows Simulated (missing credentials) or Offline (API failure). Global trend discovery and sound-trend data are not available via the official API.",
    requiredEnvKeys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    docsUrl: "https://developers.tiktok.com/doc/research-api-specs-query-videos/",
  },
  etsy: {
    purpose:
      "Etsy marketplace fashion listings, popular items (by favorites), keyword tags, price bands, and title/handmade patterns via the Etsy Open API v3.",
    steps: [
      "Register an app at etsy.com/developers/your-apps to get an API Key keystring.",
      "Set ETSY_API_KEY in .env.local (the keystring is used as the x-api-key header; never commit it).",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode searches active fashion listings across curated streetwear keywords and aggregates prices, tags, and favorites.",
      "Limitation: Etsy exposes NO true sales/bestseller ranking via the public API — num_favorers (favorites) is used as a popularity proxy, not sales. Receipts/sales require OAuth and are not accessed.",
    ],
    simulatedWhen:
      "Without ETSY_API_KEY, or if the Open API is unreachable, no Etsy data is returned. Status shows Simulated (missing credentials) or Offline (API failure). Bestseller ranking is approximated by favorites — real sales counts are not available from Etsy's public API.",
    requiredEnvKeys: ["ETSY_API_KEY"],
    docsUrl: "https://developer.etsy.com/documentation/reference/#operation/findAllListingsActive",
  },
  amazon: {
    purpose:
      "Amazon fashion product signals: titles/keywords, categories, price ranges, and category sales-rank (popularity proxy) via the Product Advertising API v5 (DE marketplace).",
    steps: [
      "Join the Amazon Associates program and register for the Product Advertising API (requires ~10 qualifying sales in the trailing 30 days to stay eligible).",
      "Create PA-API credentials: Access Key, Secret Key, and your Associate Partner Tag.",
      "Set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY and AMAZON_PARTNER_TAG in .env.local (never commit the secret key).",
      "Optional: override AMAZON_PAAPI_HOST / AMAZON_PAAPI_REGION / AMAZON_PAAPI_MARKETPLACE (defaults target amazon.de / eu-west-1).",
      "Restart the dev server, then run Health and Test in this panel.",
      "Limitation: PA-API exposes NO real sales counts — WebsiteSalesRank is a category rank proxy. Review count/rating are unavailable to most accounts. PA-API 5.0 is deprecated 2026-05-15.",
    ],
    simulatedWhen:
      "Without the three PA-API credentials, or if the API is unreachable/ineligible, no Amazon data is returned. Status shows Simulated (missing credentials) or Offline (API failure). True bestseller/sales figures are not available — only a category sales-rank proxy where present.",
    requiredEnvKeys: [
      "AMAZON_ACCESS_KEY",
      "AMAZON_SECRET_KEY",
      "AMAZON_PARTNER_TAG",
    ],
    docsUrl: "https://webservices.amazon.com/paapi5/documentation/search-items.html",
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
