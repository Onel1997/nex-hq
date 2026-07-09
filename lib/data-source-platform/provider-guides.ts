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
      "Set GOOGLE_TRENDS_API_KEY in .env.local (SerpAPI key — SERPAPI_API_KEY is also accepted as an alias).",
      "Restart the dev server, then run Health and Test.",
      "Live mode scans up to 10 streetwear keywords plus top Shopify product titles when Shopify is connected.",
    ],
    simulatedWhen:
      "Without GOOGLE_TRENDS_API_KEY the provider stays Coming Soon with static estimates. Invalid keys show Offline/Auth error. Live SerpAPI responses produce connected keyword, related-query, demand, seasonality, and direction signals for the Fusion Report.",
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
    purpose:
      "Live streetwear/fashion community intelligence: aggregated titles, flairs, keywords, brand/color/material/silhouette/graphic mentions, discussed aesthetics, most-upvoted ideas, and average engagement + comment velocity across curated public subreddits via Reddit's application OAuth API.",
    steps: [
      "Create a Reddit app at reddit.com/prefs/apps (choose 'script' or 'web app').",
      "Copy the client ID (under the app name) and the client secret.",
      "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local (never commit the secret). Optionally set REDDIT_USER_AGENT.",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode collects hot, rising, and top (24h/7d/30d) posts from r/streetwear, r/streetwearstartup, r/malefashion, r/malefashionadvice, r/graphic_design, and r/fashion, then returns structured aggregates only — never raw Reddit JSON.",
      "Limitation: Application-only OAuth is READ-ONLY — we never post, vote, comment, or authenticate as a user. Only public subreddits are visible; deleted/removed posts and private/quarantined communities are never returned. Comment velocity is approximated from post age.",
    ],
    simulatedWhen:
      "Without REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET, or if the API is unreachable, no Reddit data is returned. Status shows Simulated (missing credentials) or Offline (API failure) — engagement and threads are never fabricated. History is limited to Reddit's fixed top windows (24h/7d/30d); there is no full-archive access.",
    requiredEnvKeys: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
    docsUrl: "https://github.com/reddit-archive/reddit/wiki/OAuth2",
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
    purpose:
      "Fashion / streetwear news intelligence via RSS: article titles, source, publication date, links, categories/tags, plus aggregated fashion keywords, brand mentions, color/material/silhouette signals, repeated topics, and emerging themes across public fashion feeds.",
    steps: [
      "Optional: set FASHION_NEWS_RSS_URL to a single fashion RSS feed URL in .env.local.",
      "Optional: set FASHION_NEWS_RSS_URLS to multiple feeds (comma or whitespace separated) for broader coverage.",
      "If neither is set, the provider reads default public fashion RSS feeds (Hypebeast, Highsnobiety, Vogue Business, FashionUnited) — no credentials needed.",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode parses each RSS/Atom feed and aggregates only the metadata publishers expose — never scraping HTML or bypassing paywalls.",
      "Limitation: Many outlets expose only a headline, link, date, and snippet in RSS — not the full article. Paywalled sources provide metadata only.",
    ],
    simulatedWhen:
      "With no reachable feed (no custom URL and defaults unreachable), status is Coming Soon and no articles are shown. If a configured FASHION_NEWS_RSS_URL(S) feed is unreachable, status is Offline with the fetch error. Article data is never fabricated, scraped, or paywall-bypassed. RSS is not real-time — it updates on the publisher's schedule.",
    requiredEnvKeys: ["FASHION_NEWS_RSS_URL", "FASHION_NEWS_RSS_URLS"],
  },
  youtube: {
    purpose:
      "YouTube fashion intelligence via Data API v3: video metadata (title, channel, views, likes, comments, duration, tags, language) across 18 curated EN+DE streetwear/fashion topics, plus aggregated trending topics, brand/color/material/fit/graphic signals, creator ranking, engagement metrics, and sample-derived trend momentum/velocity/growth estimates.",
    steps: [
      "Create a Google Cloud project and enable the YouTube Data API v3.",
      "Create an API key (restrict to YouTube Data API v3 and your server IP if possible).",
      "Set YOUTUBE_API_KEY in .env.local (never commit the key).",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode runs bilingual fashion topic searches (region DE) and aggregates structured intelligence only — never raw video playback or comment text.",
      "Limitation: Default quota is 10,000 units/day (~1,800+ units per full sync). Monitor usage in Google Cloud Console.",
    ],
    simulatedWhen:
      "Without YOUTUBE_API_KEY, or if the API is unreachable/quota-exceeded, no YouTube data is returned. Status shows Simulated (missing credentials) or Offline (API failure). Video metrics, trends, and brand signals are never fabricated. Trend momentum/velocity are sample-derived estimates, not YouTube internal analytics.",
    requiredEnvKeys: ["YOUTUBE_API_KEY"],
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
  },
  depop: {
    purpose:
      "Streetwear resale intelligence via Depop's official Partner Selling API: your authenticated seller inventory (titles, brands, colors, materials, sizes, prices, categories, style tags, listing freshness, and location metadata when exposed by the API). Aggregates rising styles, popular brands, price bands, color/silhouette/product-type trends, repeated title patterns, streetwear keywords, and inventory-based resale demand proxies.",
    steps: [
      "Depop has no public marketplace API — apply for Partner Selling API access at partners@depop.com (enterprise/high-volume sellers and approved partners only).",
      "Once approved, obtain your Bearer API key from Depop.",
      "Set DEPOP_API_KEY in .env.local (never commit the key).",
      "Optional: set DEPOP_API_BASE_URL (defaults to https://partnerapi.depop.com) or DEPOP_API_ENV=staging for sandbox.",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode reads your seller inventory via GET /api/v1/products/ only — never scrapes depop.com or fabricates marketplace-wide trends.",
      "Limitation: Data is your inventory only, not global Depop resale intelligence. Empty inventory returns Offline, not fabricated listings.",
    ],
    simulatedWhen:
      "Without DEPOP_API_KEY (partner approval required), status is Coming Soon and no resale data is shown. If credentials are set but the Partner API fails, status is Offline with the error. Marketplace-wide Depop trends are not available via any public API — we never scrape or fake live data.",
    requiredEnvKeys: ["DEPOP_API_KEY"],
    docsUrl: "https://partnerapi.depop.com/api-docs/",
  },
  stockx: {
    purpose:
      "Streetwear resale market intelligence via StockX Developer API v2 catalog search: product names, brands, categories, retail/market/last-sale prices (only when API returns them), price premium, release dates, colorways, silhouettes, product types, and demand proxies. Aggregates rising brands, trending silhouettes, premium price ranges, colorway trends, category movement, and resale demand signals from curated streetwear search queries.",
    steps: [
      "StockX has no open public marketplace API — apply for Developer API access at developer.stockx.com (approval required).",
      "Complete OAuth2 authorization and obtain your API key (x-api-key header) plus access token.",
      "Set STOCKX_API_KEY and STOCKX_ACCESS_TOKEN in .env.local (never commit credentials).",
      "Optional: STOCKX_REFRESH_TOKEN + STOCKX_CLIENT_ID + STOCKX_CLIENT_SECRET for automatic token refresh instead of a static access token.",
      "Optional: STOCKX_API_BASE_URL (defaults to https://api.stockx.com/v2).",
      "Restart the dev server, then run Health and Test in this panel.",
      "Live mode queries GET /v2/catalog/search across 12 curated streetwear topics — never scrapes stockx.com or fabricates marketplace prices.",
      "Limitation: ~25,000 requests/day and ~1 request/second. Retail, market, and last-sale fields are often null unless the API exposes them for each product.",
    ],
    simulatedWhen:
      "Without approved developer credentials (STOCKX_API_KEY + OAuth access token), status is Coming Soon and no resale data is shown. If credentials are set but the Developer API fails, status is Offline with the error. We never scrape StockX, use unofficial endpoints, or claim sales/volume data the API does not provide. Trend aggregates are catalog-search samples, not full marketplace analytics.",
    requiredEnvKeys: ["STOCKX_API_KEY", "STOCKX_ACCESS_TOKEN"],
    docsUrl: "https://developer.stockx.com/",
  },
  grailed: {
    purpose:
      "Designer fashion / resale intelligence via Grailed partner API (when available): listing titles, brands, designers, categories, prices, sizes, conditions, colors, materials, product types, listing freshness, location when exposed, and demand proxies when the API provides them. Aggregates rising designers, archive fashion signals, luxury streetwear signals, designer price bands, color/silhouette/material trends, repeated title patterns, and inventory-based resale demand proxies.",
    steps: [
      "Grailed has NO open public marketplace API — there is no official catalog search, browse, or trend endpoint for developers. We never scrape grailed.com.",
      "Live mode requires Grailed-issued partner credentials when Grailed provides an official seller/partner API.",
      "Set GRAILED_API_KEY (Bearer token) and GRAILED_API_BASE_URL (official partner API base URL from Grailed) in .env.local.",
      "Restart the dev server, then run Health and Test in this panel.",
      "When configured, live mode reads your authenticated seller inventory via GET /api/v1/listings only — not global Grailed marketplace trends.",
      "Limitation: Rate limits depend on Grailed partner agreement. Watchers, offers, and sold counts appear only when the API returns them.",
    ],
    simulatedWhen:
      "Without partner credentials (GRAILED_API_KEY + GRAILED_API_BASE_URL), status is Coming Soon and no resale data is shown. Grailed currently has no public developer API — most sellers use the Grailed app directly. If credentials are set but the partner API fails, status is Offline with the error. We never scrape Grailed, use unofficial Algolia endpoints, or claim sales/volume data the API does not provide.",
    requiredEnvKeys: ["GRAILED_API_KEY", "GRAILED_API_BASE_URL"],
    docsUrl: "https://www.grailed.com/sell",
  },
};

export function getProviderSetupGuide(id: ProviderId): ProviderSetupGuide {
  return PROVIDER_SETUP_GUIDES[id];
}

export function partitionGuideSteps(guide: ProviderSetupGuide): {
  setupSteps: string[];
  limitations: string[];
  notes: string[];
} {
  const setupSteps: string[] = [];
  const limitations: string[] = [];
  const notes: string[] = [];

  for (const step of guide.steps) {
    if (/^limitation:/i.test(step)) {
      limitations.push(step.replace(/^limitation:\s*/i, ""));
      continue;
    }
    if (/^note:/i.test(step)) {
      notes.push(step.replace(/^note:\s*/i, ""));
      continue;
    }
    setupSteps.push(step);
  }

  if (guide.simulatedWhen) {
    notes.push(guide.simulatedWhen);
  }

  return { setupSteps, limitations, notes };
}
