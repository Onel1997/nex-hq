/**
 * Stricter phrase-quality evaluation for garment-ready creative directions.
 */

import { PHRASE_QUALITY_THRESHOLD, type PhraseQualityScores } from "./types";

export const GENERIC_PHRASE_BLACKLIST = [
  "never give up",
  "stay strong",
  "dream big",
  "dream bigger",
  "be yourself",
  "no pain no gain",
  "believe in yourself",
  "hustle hard",
  "work hard play hard",
  "live laugh love",
  "good vibes only",
  "trust the process",
  "rise and grind",
  "make it happen",
  "follow your dreams",
  "keep going",
  "you got this",
  "silence wins",
  "built different",
  "never settle",
  "heavy soft",
  "light for one",
  "stay hungry",
  "no excuses",
  "boss mode",
  "level up",
  "nie aufgeben",
  "sei du selbst",
  "träume groß",
  "bleib stark",
] as const;

/** Two-word aesthetic fragments that lack wearable meaning unless strongly constructed. */
const WEAK_FRAGMENT_PATTERNS = [
  /^(heavy|soft|light|dark|quiet|loud|cold|warm|raw|pure)\s+(soft|hard|one|night|day|mode|energy|vibes?)\.?$/i,
  /^(built|made|born|stay|keep|be)\s+(different|strong|quiet|soft|hard|real)\.?$/i,
];

export function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizePhrase(text)
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

export function phraseSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection += 1;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isGenericPhrase(phrase: string): boolean {
  const normalized = normalizePhrase(phrase);
  return GENERIC_PHRASE_BLACKLIST.some((banned) => {
    const bannedNorm = normalizePhrase(banned);
    if (normalized === bannedNorm) return true;
    if (normalized.includes(bannedNorm) && normalized.length < bannedNorm.length + 12) {
      return true;
    }
    return phraseSimilarity(normalized, bannedNorm) >= 0.82;
  });
}

export function isWeakPhraseFragment(phrase: string): boolean {
  const trimmed = phrase.trim();
  const words = normalizePhrase(trimmed).split(" ").filter(Boolean);
  if (words.length <= 1) return true;
  if (words.length === 2 && WEAK_FRAGMENT_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  // Two vague adjectives / nouns with no verb or relational structure
  if (
    words.length === 2 &&
    !/\b(in|on|under|without|before|after|for|from|into|with|still|never|already)\b/i.test(
      trimmed,
    ) &&
    !/[.!?]/.test(trimmed.slice(0, -1))
  ) {
    // Allow deliberate constructions with clear tension (checked via clarity later)
    const vaguePair =
      /^(heavy|soft|light|dark|quiet|raw|pure|cold|warm)\s+(soft|hard|one|night|mass|heat|mode)$/i;
    if (vaguePair.test(trimmed)) return true;
  }
  return false;
}

export function isNearDuplicatePhrase(a: string, b: string, threshold = 0.55): boolean {
  return phraseSimilarity(a, b) >= threshold;
}

export function evaluatePhraseQuality(
  phrase: string,
  options: {
    meaning?: string;
    recentPhrases?: string[];
    alternatives?: string[];
  } = {},
): PhraseQualityScores {
  const rejectionReasons: string[] = [];
  const trimmed = phrase.trim();
  const words = normalizePhrase(trimmed).split(" ").filter(Boolean);

  let phraseStrengthScore = 72;
  let originalityScore = 78;
  let memorabilityScore = 70;
  let semanticClarityScore = 75;
  let campaignPotentialScore = 68;

  if (isGenericPhrase(trimmed)) {
    originalityScore = 12;
    phraseStrengthScore = 18;
    campaignPotentialScore = 15;
    rejectionReasons.push("Generischer Motivations- oder Streetwear-Klischee-Spruch");
  }

  if (isWeakPhraseFragment(trimmed)) {
    phraseStrengthScore = Math.min(phraseStrengthScore, 28);
    semanticClarityScore = Math.min(semanticClarityScore, 30);
    memorabilityScore = Math.min(memorabilityScore, 32);
    rejectionReasons.push("Zu schwaches Phrasen-Fragment ohne tragfähige Bedeutung");
  }

  if (words.length === 2 && trimmed.length < 14) {
    phraseStrengthScore -= 18;
    memorabilityScore -= 10;
    if (!/[.!?]/.test(trimmed) && !/\b(in|without|under|before)\b/i.test(trimmed)) {
      rejectionReasons.push("Zwei vage Wörter ohne merkbare Konstruktion");
    }
  }

  if (words.length >= 3 && words.length <= 7) {
    phraseStrengthScore += 10;
    memorabilityScore += 8;
    campaignPotentialScore += 8;
  }

  if (/\b(in|without|under|before|after|still|never|already|only|between)\b/i.test(trimmed)) {
    semanticClarityScore += 8;
    phraseStrengthScore += 6;
  }

  if (/[.!?]$/.test(trimmed) && words.length >= 3) {
    campaignPotentialScore += 6;
    memorabilityScore += 4;
  }

  const meaning = options.meaning?.trim() ?? "";
  if (meaning.length >= 40) {
    semanticClarityScore += 8;
  } else if (meaning.length < 20) {
    semanticClarityScore -= 15;
    rejectionReasons.push("Bedeutung zu unklar für ein eigenständiges Garment-Design");
  }

  for (const recent of options.recentPhrases ?? []) {
    if (isNearDuplicatePhrase(trimmed, recent, 0.5)) {
      originalityScore = Math.min(originalityScore, 25);
      rejectionReasons.push(`Zu ähnlich zu kürzlich verwendetem Spruch: „${recent}“`);
    }
  }

  const alternatives = options.alternatives ?? [];
  if (alternatives.length > 0) {
    const altNorm = alternatives.map(normalizePhrase);
    const primaryNorm = normalizePhrase(trimmed);
    const tooSimilarAlts = altNorm.filter(
      (alt) => phraseSimilarity(primaryNorm, alt) >= 0.7 || alt.split(" ").every((w) => primaryNorm.includes(w)),
    );
    if (tooSimilarAlts.length >= alternatives.length) {
      originalityScore -= 10;
      rejectionReasons.push("Alternativen variieren nur im Wording, nicht in der Struktur");
    }
  }

  phraseStrengthScore = clamp(phraseStrengthScore);
  originalityScore = clamp(originalityScore);
  memorabilityScore = clamp(memorabilityScore);
  semanticClarityScore = clamp(semanticClarityScore);
  campaignPotentialScore = clamp(campaignPotentialScore);

  const average =
    (phraseStrengthScore +
      originalityScore +
      memorabilityScore +
      semanticClarityScore +
      campaignPotentialScore) /
    5;

  const passed =
    average >= PHRASE_QUALITY_THRESHOLD &&
    !rejectionReasons.some((reason) =>
      /Klischee|Fragment|kürzlich verwendet|zu unklar/i.test(reason),
    ) &&
    phraseStrengthScore >= 50 &&
    originalityScore >= 45 &&
    semanticClarityScore >= 50;

  return {
    phraseStrengthScore,
    originalityScore,
    memorabilityScore,
    semanticClarityScore,
    campaignPotentialScore,
    rejectionReasons: passed ? rejectionReasons.filter((r) => !/Klischee|Fragment/i.test(r)) : rejectionReasons,
    passed,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function alternativesHaveStructuralVariety(
  primary: string,
  alternatives: string[],
): boolean {
  if (alternatives.length < 3) return false;
  const structures = new Set(
    [primary, ...alternatives].map((phrase) => {
      const words = normalizePhrase(phrase).split(" ").filter(Boolean);
      if (words.length <= 2) return "short";
      if (/^(do|keep|hold|leave|walk|wear|stay|never|still)\b/i.test(phrase)) return "imperative";
      if (/\b(in|under|without|before|after|between)\b/i.test(phrase)) return "prepositional";
      if (/,|;|—|–/.test(phrase)) return "compound";
      if (words.length >= 5) return "sentence";
      return "clause";
    }),
  );
  return structures.size >= 3;
}
