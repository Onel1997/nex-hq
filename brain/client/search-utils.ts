const MAX_SEARCH_TERM_LENGTH = 50;
const MAX_KEYWORDS = 8;

const BRIEFING_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "from",
  "using",
  "all",
  "our",
  "we",
  "should",
  "based",
  "on",
  "into",
  "that",
  "this",
  "first",
  "next",
  "develop",
  "create",
  "design",
  "use",
  "report",
  "reports",
  "trend",
  "trends",
  "ceo",
  "competitor",
  "pricing",
  "der",
  "die",
  "das",
  "und",
  "oder",
  "für",
  "mit",
  "aus",
  "alle",
  "ein",
  "eine",
  "erstelle",
  "entwickle",
  "basierend",
]);

/** Remove characters that break PostgREST ilike / or-filter parsing. */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[\n\r"':,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_TERM_LENGTH);
}

/**
 * Extract short, safe keywords from a briefing for Brain text search.
 * Never returns the raw briefing — only sanitized tokens.
 */
export function extractBriefingKeywords(brief: string): string[] {
  const sanitized = sanitizeSearchTerm(brief);
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  const keywords: string[] = [];

  for (const token of tokens) {
    const cleaned = token.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "");
    if (!cleaned || cleaned.length < 2) continue;

    const lower = cleaned.toLowerCase();
    if (BRIEFING_STOP_WORDS.has(lower)) continue;

    if (/^[A-Z]{2}\d{2}$/i.test(cleaned)) {
      keywords.push(cleaned.toUpperCase());
      continue;
    }

    if (/^[A-Z]/.test(cleaned) && cleaned.length >= 3) {
      keywords.push(cleaned);
      continue;
    }

    if (cleaned.length >= 4) {
      keywords.push(cleaned);
    }
  }

  return [...new Set(keywords.map(sanitizeSearchTerm).filter(Boolean))].slice(
    0,
    MAX_KEYWORDS,
  );
}
