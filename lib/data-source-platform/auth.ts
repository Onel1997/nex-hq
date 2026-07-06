import type { ProviderAuthStatus, ProviderId } from "./types";

interface AuthConfig {
  method: ProviderAuthStatus["method"];
  envKeys: string[];
}

const AUTH_CONFIG: Record<ProviderId, AuthConfig> = {
  shopify: {
    method: "client_credentials",
    envKeys: [
      "SHOPIFY_STORE_DOMAIN",
      "SHOPIFY_CLIENT_ID",
      "SHOPIFY_CLIENT_SECRET",
    ],
  },
  google_trends: {
    method: "api_key",
    envKeys: ["GOOGLE_TRENDS_API_KEY"],
  },
  reddit: {
    method: "oauth",
    envKeys: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
  },
  pinterest: {
    method: "api_key",
    envKeys: ["PINTEREST_ACCESS_TOKEN"],
  },
  tiktok: {
    method: "api_key",
    envKeys: ["TIKTOK_API_KEY"],
  },
  etsy: {
    method: "api_key",
    envKeys: ["ETSY_API_KEY"],
  },
  amazon: {
    method: "api_key",
    envKeys: ["AMAZON_API_KEY"],
  },
  instagram: {
    method: "api_key",
    envKeys: ["INSTAGRAM_ACCESS_TOKEN"],
  },
  fashion_news: {
    method: "rss",
    envKeys: ["FASHION_NEWS_RSS_URL"],
  },
};

export function getProviderAuthStatus(id: ProviderId): ProviderAuthStatus {
  const config = AUTH_CONFIG[id];
  const missingKeys = config.envKeys.filter((key) => !process.env[key]?.trim());
  return {
    configured: missingKeys.length === 0,
    method: config.method,
    envKeys: config.envKeys,
    missingKeys,
  };
}
