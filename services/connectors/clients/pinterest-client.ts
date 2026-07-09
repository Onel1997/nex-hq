import type {
  PinterestBoard,
  PinterestIntelligenceData,
} from "../pinterest";

const API_BASE = "https://api.pinterest.com/v5";
const REGION = "DE";
const FASHION_INTERESTS = ["mens_fashion", "womens_fashion"];

/**
 * Pinterest API v5 limitations (documented for Data Sources Center):
 * - Trending keywords come from GET /trends/keywords/{region}/top/{trend_type}
 *   (requires Trends API access; may need Pinterest Business/Ads approval).
 * - Boards and pins reflect the authenticated account only — not global Pinterest trends.
 * - No public API for board save counts; follower_count is used as a proxy.
 * - Color/aesthetic signals are derived from pin dominant_color on owned pins.
 * - trends.pinterest.com features (visual search, global moodboards) are not exposed via API.
 */
export const PINTEREST_API_LIMITATIONS =
  "Trends API returns DE fashion keywords only. Boards/pins are from your authenticated account — not global Pinterest. Save counts unavailable; follower_count used as proxy. Color signals from pin dominant_color on owned pins.";

interface TrendingKeyword {
  keyword: string;
  pct_growth_wow?: number;
  pct_growth_mom?: number;
  pct_growth_yoy?: number;
}

interface TrendingKeywordsResponse {
  trends?: TrendingKeyword[];
}

interface BoardItem {
  id: string;
  name: string;
  description?: string | null;
  pin_count?: number;
  follower_count?: number;
}

interface BoardsResponse {
  items?: BoardItem[];
}

interface PinItem {
  id: string;
  title?: string | null;
  description?: string | null;
  dominant_color?: string | null;
  board_id?: string;
}

interface PinsResponse {
  items?: PinItem[];
}

interface AccountResponse {
  username?: string;
  account_type?: string;
}

export function isPinterestLiveConfigured(): boolean {
  return Boolean(process.env.PINTEREST_ACCESS_TOKEN?.trim());
}

function getToken(): string {
  const token = process.env.PINTEREST_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("PINTEREST_ACCESS_TOKEN not configured");
  }
  return token;
}

async function pinterestApi<T>(
  path: string,
  params?: Record<string, string | string[]>,
): Promise<T> {
  const token = getToken();
  const url = new URL(`${API_BASE}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          url.searchParams.append(key, entry);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Pinterest API ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

function growthTrend(
  keyword: TrendingKeyword,
): PinterestBoard["trend"] {
  const growth = keyword.pct_growth_mom ?? keyword.pct_growth_wow ?? 0;
  if (growth >= 20) return "rising";
  if (growth <= -10) return "declining";
  return "stable";
}

function hexToColorLabel(hex: string): string {
  const normalized = hex.replace("#", "").toLowerCase();
  if (normalized.length !== 6) return hex;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if (r < 40 && g < 40 && b < 40) return "Obsidian Black";
  if (r > 220 && g > 220 && b > 220) return "Off White";
  if (r > g && r > b && g > 80) return "Earth Brown";
  if (g > r && g > b) return "Sage Green";
  if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) return "Concrete Grey";
  if (r > 180 && g > 120 && b < 100) return "Warm Sand";
  if (g > 150 && r < 120) return "Muted Olive";
  if (r > 150 && g < 100 && b < 80) return "Terracotta";

  return hex.toUpperCase();
}

function buildColorWorlds(pinColors: string[]): string[] {
  const labels = [...new Set(pinColors.map(hexToColorLabel))];
  const worlds: string[] = [];

  for (let i = 0; i < labels.length && worlds.length < 6; i++) {
    for (let j = i + 1; j < labels.length && worlds.length < 6; j++) {
      worlds.push(`${labels[i]} + ${labels[j]}`);
    }
  }

  if (worlds.length === 0 && labels.length > 0) {
    return labels.slice(0, 4);
  }

  return worlds.slice(0, 4);
}

function deriveAesthetics(
  trends: TrendingKeyword[],
  boards: BoardItem[],
): string[] {
  const fromBoards = boards
    .map((board) => board.name.trim())
    .filter((name) => name.length > 2);

  const fashionKeywords = trends
    .map((trend) => trend.keyword)
    .filter((keyword) =>
      /\b(fashion|streetwear|outfit|style|aesthetic|capsule|minimal|luxury|vintage)\b/i.test(
        keyword,
      ),
    )
    .map(
      (keyword) =>
        keyword
          .split(/\s+/)
          .slice(0, 3)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ") + " Aesthetic",
    );

  return [...new Set([...fromBoards, ...fashionKeywords])].slice(0, 8);
}

function mapBoards(
  boards: BoardItem[],
  trends: TrendingKeyword[],
  pinColorsByBoard: Map<string, string[]>,
): PinterestBoard[] {
  const trendKeywords = trends.map((trend) => trend.keyword.toLowerCase());

  return boards.slice(0, 8).map((board) => {
    const boardNameLower = board.name.toLowerCase();
    const matchedTrend = trends.find((trend) =>
      boardNameLower.includes(trend.keyword.toLowerCase()),
    );
    const colors =
      pinColorsByBoard.get(board.id) ??
      pinColorsByBoard
        .get("")
        ?.slice(0, 3) ??
      [];

    const hasTrendMatch = trendKeywords.some((keyword) =>
      boardNameLower.includes(keyword),
    );

    return {
      name: board.name,
      aesthetic: board.description?.trim() || board.name,
      colors: colors.length > 0 ? colors : ["—"],
      saves: board.follower_count ?? board.pin_count ?? 0,
      trend: matchedTrend
        ? growthTrend(matchedTrend)
        : hasTrendMatch
          ? "rising"
          : "stable",
    };
  });
}

function mapLiveData(
  growingTrends: TrendingKeyword[],
  monthlyTrends: TrendingKeyword[],
  boards: BoardItem[],
  pins: PinItem[],
): PinterestIntelligenceData {
  const allTrends = [...growingTrends, ...monthlyTrends];
  const uniqueTrends = [
    ...new Map(allTrends.map((trend) => [trend.keyword, trend])).values(),
  ];

  const pinColors = pins
    .map((pin) => pin.dominant_color?.trim())
    .filter((color): color is string => Boolean(color));

  const pinColorsByBoard = new Map<string, string[]>();
  for (const pin of pins) {
    if (!pin.dominant_color || !pin.board_id) continue;
    const existing = pinColorsByBoard.get(pin.board_id) ?? [];
    const label = hexToColorLabel(pin.dominant_color);
    if (!existing.includes(label)) {
      pinColorsByBoard.set(pin.board_id, [...existing, label]);
    }
  }

  const outfitTrends = [...growingTrends]
    .sort(
      (a, b) =>
        (b.pct_growth_mom ?? b.pct_growth_wow ?? 0) -
        (a.pct_growth_mom ?? a.pct_growth_wow ?? 0),
    )
    .slice(0, 6)
    .map((trend) => {
      const growth = trend.pct_growth_mom ?? trend.pct_growth_wow;
      return growth != null && growth > 0
        ? `${trend.keyword} (+${growth}% MoM)`
        : trend.keyword;
    });

  const capsuleTrends = [...growingTrends]
    .filter((trend) => (trend.pct_growth_wow ?? 0) >= 15)
    .slice(0, 4)
    .map((trend) => `${trend.keyword} capsule momentum`);

  if (capsuleTrends.length === 0) {
    capsuleTrends.push(
      ...monthlyTrends.slice(0, 4).map((trend) => `${trend.keyword} — high volume`),
    );
  }

  return {
    colorWorlds: buildColorWorlds(pinColors),
    aesthetics: deriveAesthetics(uniqueTrends, boards),
    outfitTrends,
    capsuleTrends: capsuleTrends.slice(0, 4),
    boards: mapBoards(boards, uniqueTrends, pinColorsByBoard),
  };
}

async function fetchTrendingKeywords(
  trendType: "growing" | "monthly",
  limit: number,
): Promise<TrendingKeyword[]> {
  const response = await pinterestApi<TrendingKeywordsResponse>(
    `/trends/keywords/${REGION}/top/${trendType}`,
    {
      limit: String(limit),
      interests: FASHION_INTERESTS,
    },
  );
  return response.trends ?? [];
}

async function fetchBoards(): Promise<BoardItem[]> {
  const response = await pinterestApi<BoardsResponse>("/boards", {
    page_size: "25",
  });
  return response.items ?? [];
}

async function fetchPins(boards: BoardItem[]): Promise<PinItem[]> {
  try {
    const response = await pinterestApi<PinsResponse>("/pins", {
      page_size: "25",
    });
    if (response.items && response.items.length > 0) {
      return response.items;
    }
  } catch {
    // pins:read scope may be missing — fall back to per-board fetch
  }

  const pins: PinItem[] = [];
  for (const board of boards.slice(0, 3)) {
    try {
      const response = await pinterestApi<PinsResponse>(
        `/boards/${board.id}/pins`,
        { page_size: "10" },
      );
      pins.push(...(response.items ?? []));
    } catch {
      // continue with other boards
    }
  }

  return pins;
}

/** Cheap health ping — verifies token and account access. */
export async function pingPinterestLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isPinterestLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "PINTEREST_ACCESS_TOKEN not configured",
    };
  }

  const started = Date.now();
  try {
    const account = await pinterestApi<AccountResponse>("/user_account");
    const latencyMs = Date.now() - started;
    return {
      ok: true,
      latencyMs,
      message: `Live · @${account.username ?? "account"} reachable`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "Pinterest health ping failed",
    };
  }
}

/** Fetch live Pinterest intelligence from API v5 endpoints. */
export async function fetchLivePinterest(): Promise<PinterestIntelligenceData> {
  if (!isPinterestLiveConfigured()) {
    throw new Error("PINTEREST_ACCESS_TOKEN not configured");
  }

  let growingTrends: TrendingKeyword[] = [];
  let monthlyTrends: TrendingKeyword[] = [];
  let trendsError: string | null = null;

  try {
    growingTrends = await fetchTrendingKeywords("growing", 25);
  } catch (error) {
    trendsError =
      error instanceof Error ? error.message : "Trends API unavailable";
  }

  try {
    monthlyTrends = await fetchTrendingKeywords("monthly", 15);
  } catch {
    // monthly trends are optional enrichment
  }

  let boards: BoardItem[] = [];
  let boardsError: string | null = null;

  try {
    boards = await fetchBoards();
  } catch (error) {
    boardsError =
      error instanceof Error ? error.message : "Boards API unavailable";
  }

  const pins = boards.length > 0 ? await fetchPins(boards) : [];

  const hasTrends = growingTrends.length > 0 || monthlyTrends.length > 0;
  const hasBoards = boards.length > 0;
  const hasPins = pins.length > 0;

  if (!hasTrends && !hasBoards && !hasPins) {
    const parts = [trendsError, boardsError].filter(Boolean);
    throw new Error(
      parts.length > 0
        ? `Pinterest API returned no data — ${parts.join("; ")}`
        : "Pinterest API returned no fashion trends, boards, or pins",
    );
  }

  return mapLiveData(growingTrends, monthlyTrends, boards, pins);
}
