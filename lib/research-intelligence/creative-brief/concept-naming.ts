/**
 * Deterministic editorial concept naming for Research Creative Briefs.
 */

const CONCEPT_PATTERNS: Array<{ match: RegExp; name: string }> = [
  { match: /quiet\s*ascent|ascent|rise|climb/i, name: "RISE WITHOUT NOISE" },
  { match: /archive|heritage|vintage\s*premium/i, name: "HELD IN ARCHIVE" },
  { match: /monochrome|neutral|restraint|minimal/i, name: "QUIET CONFIDENCE" },
  { match: /embroidery|emblem|symbol/i, name: "MARK OF RESTRAINT" },
  { match: /heavyweight|gsm|fleece/i, name: "WEIGHT OF CALM" },
  { match: /oversized|boxy|drop\s*shoulder/i, name: "ROOM TO BREATHE" },
  { match: /luxury|premium|elevated/i, name: "STILL ELEVATED" },
  { match: /washed|fade|patina/i, name: "FADED HOUR" },
  { match: /streetwear|urban/i, name: "STREET IN SILENCE" },
  { match: /shadow|depth|conceal/i, name: "HELD IN SHADOW" },
];

function toEditorialTitle(text: string): string {
  const cleaned = text
    .replace(/[^a-z0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "STILL HERE";
  const words = cleaned.split(" ").slice(0, 4);
  return words.join(" ").toUpperCase();
}

export function deriveConceptName(corpus: string, fallbackTitle?: string): string {
  const joined = corpus.toLowerCase();
  for (const pattern of CONCEPT_PATTERNS) {
    if (pattern.match.test(joined)) {
      return pattern.name;
    }
  }
  if (fallbackTitle) {
    const editorial = toEditorialTitle(fallbackTitle);
    if (editorial.length >= 6) return editorial;
  }
  return "STILL HERE";
}
