const GSM_RE = /\b(\d{2,3})\s*gsm\b/gi;
const COMPOSITION_RE = /\b(\d{1,3})\s*%\s*(cotton|organic cotton|polyester|elastane)\b/gi;

const SHIPPING_NOISE_RE =
  /versand|dhl|liefer|lieferzeit|tolerance|toleranz|größentabelle|size chart|xs\s+s\s+m\s+l|schneller versand|working days|business days|html|<\/?[a-z]/i;

const ALLOWED_MATERIAL_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\borganic cotton\b/i, label: "Organic Cotton" },
  { pattern: /\bfrench terry\b/i, label: "French Terry" },
  { pattern: /\bheavyweight cotton\b/i, label: "Heavyweight Cotton" },
  { pattern: /\bpremium cotton\b/i, label: "Premium Cotton" },
  { pattern: /\bcotton\b/i, label: "Cotton" },
  { pattern: /\bheavyweight\b/i, label: "Heavyweight" },
  { pattern: /\bfleece\b/i, label: "Heavyweight Fleece" },
  { pattern: /\bembroidery[- ]ready\b/i, label: "Embroidery-ready" },
  { pattern: /\bscreen[- ]print(?:able| compatible)?\b/i, label: "Screen-print compatible" },
  { pattern: /\boversized\b/i, label: "Oversized" },
];

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractGsmValues(text: string): string[] {
  const matches = [...text.matchAll(GSM_RE)];
  return unique(
    matches
      .map((match) => Number.parseInt(match[1], 10))
      .filter((gsm) => gsm >= 180 && gsm <= 600)
      .map((gsm) => `${gsm} GSM`),
  );
}

function extractComposition(text: string): string[] {
  const results: string[] = [];
  for (const match of text.matchAll(COMPOSITION_RE)) {
    results.push(`${match[1]}% ${match[2].replace(/\b\w/g, (c) => c.toUpperCase())}`);
  }
  return results;
}

function extractKeywordMaterials(text: string): string[] {
  const hits: string[] = [];
  for (const { pattern, label } of ALLOWED_MATERIAL_KEYWORDS) {
    if (pattern.test(text)) hits.push(label);
  }
  return hits;
}

/**
 * Extracts structured material facts from Shopify fields.
 * Never returns raw descriptions, shipping copy, or size charts.
 */
export function parseStructuredMaterials(sources: string[]): string[] {
  const results: string[] = [];

  for (const raw of sources) {
    if (!raw?.trim()) continue;

    const gsm = extractGsmValues(raw);
    results.push(...gsm);

    if (raw.length > 80 || SHIPPING_NOISE_RE.test(raw)) {
      results.push(...extractComposition(raw));
      results.push(...extractKeywordMaterials(raw));
      continue;
    }

    if (SHIPPING_NOISE_RE.test(raw)) continue;

    results.push(...extractComposition(raw));
    results.push(...extractKeywordMaterials(raw));

    if (
      gsm.length === 0 &&
      !SHIPPING_NOISE_RE.test(raw) &&
      raw.length <= 40 &&
      /^[a-z0-9\s%-]+$/i.test(raw)
    ) {
      const keywordOnly = extractKeywordMaterials(raw);
      if (keywordOnly.length > 0) {
        results.push(...keywordOnly);
      }
    }
  }

  return unique(results).slice(0, 8);
}

export function isPollutedMaterialString(value: string): boolean {
  return value.length > 80 || SHIPPING_NOISE_RE.test(value);
}
