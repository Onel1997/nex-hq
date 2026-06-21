const SHOPIFY_API_VERSION = "2026-01";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

interface ShopifyTokenResponse {
  access_token: string;
  scope?: string;
  expires_in: number;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class ShopifyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyConfigError";
  }
}

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

let tokenCache: TokenCache | null = null;

function requireShopifyEnv(name: "SHOPIFY_STORE_DOMAIN" | "SHOPIFY_CLIENT_ID" | "SHOPIFY_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ShopifyConfigError(
      `Missing required environment variable: ${name}. Add it to .env.local.`,
    );
  }
  return value;
}

function getShopifyStoreDomain(): string {
  const raw = requireShopifyEnv("SHOPIFY_STORE_DOMAIN");
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function getShopifyAdminBaseUrl(): string {
  return `https://${getShopifyStoreDomain()}/admin`;
}

function isTokenValid(cache: TokenCache | null): cache is TokenCache {
  if (!cache) return false;
  return Date.now() < cache.expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Fetch a Shopify Admin API access token via Client Credentials Grant.
 * Tokens are cached in memory until shortly before expiry.
 */
export async function getShopifyAccessToken(): Promise<string> {
  if (isTokenValid(tokenCache)) {
    return tokenCache.accessToken;
  }

  const clientId = requireShopifyEnv("SHOPIFY_CLIENT_ID");
  const clientSecret = requireShopifyEnv("SHOPIFY_CLIENT_SECRET");
  const tokenUrl = `${getShopifyAdminBaseUrl()}/oauth/access_token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | ShopifyTokenResponse
    | { error?: string; error_description?: string }
    | null;

  if (!response.ok) {
    const message =
      body && "error_description" in body && body.error_description
        ? body.error_description
        : body && "error" in body && body.error
          ? body.error
          : `Shopify token request failed with status ${response.status}`;
    throw new ShopifyApiError(message, response.status, body);
  }

  if (!body || !("access_token" in body) || !body.access_token) {
    throw new ShopifyApiError("Shopify token response did not include access_token", response.status, body);
  }

  const expiresInSeconds =
    typeof body.expires_in === "number" && body.expires_in > 0
      ? body.expires_in
      : 86_400;

  tokenCache = {
    accessToken: body.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };

  return tokenCache.accessToken;
}

export interface ShopifyGraphQLResponse<TData = Record<string, unknown>> {
  data?: TData;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  extensions?: Record<string, unknown>;
}

/**
 * Execute a Shopify Admin GraphQL query or mutation.
 */
export async function shopifyGraphQL<TData = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphQLResponse<TData>> {
  const token = await getShopifyAccessToken();
  const url = `${getShopifyAdminBaseUrl()}/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      query,
      ...(variables ? { variables } : {}),
    }),
  });

  const body = (await response.json().catch(() => null)) as ShopifyGraphQLResponse<TData> | null;

  if (!response.ok) {
    throw new ShopifyApiError(
      `Shopify GraphQL request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  if (!body) {
    throw new ShopifyApiError("Shopify GraphQL returned an empty response", response.status);
  }

  if (body.errors?.length) {
    throw new ShopifyApiError(
      body.errors.map((error) => error.message).join("; "),
      response.status,
      body.errors,
    );
  }

  return body;
}

/** Clear the in-memory token cache (useful for tests). */
export function clearShopifyTokenCache(): void {
  tokenCache = null;
}
