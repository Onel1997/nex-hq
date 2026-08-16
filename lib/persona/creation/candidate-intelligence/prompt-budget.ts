/**
 * Phase 2.5B.1 — OpenAI discovery prompt length budget.
 *
 * Hard max matches OpenAI Images prompt limit (32_000).
 * Target leaves headroom so we never send near-limit prompts.
 * Compaction is deterministic and preserves P0 casting identity.
 */

import { PersonaDomainError } from "@/lib/persona/domain/errors";

/** OpenAI Images hard character limit for `prompt`. */
export const MAX_PROVIDER_PROMPT_LENGTH = 32_000;

/** Soft target — never intentionally send near the hard max. */
export const TARGET_PROVIDER_PROMPT_LENGTH = 28_000;

export type PromptBudgetReport = {
  provider: string;
  candidateSlot: string | null;
  promptLength: number;
  promptBudget: typeof MAX_PROVIDER_PROMPT_LENGTH;
  targetLength: typeof TARGET_PROVIDER_PROMPT_LENGTH;
  compacted: boolean;
};

export type EnforcePromptBudgetInput = {
  prompt: string;
  provider: string;
  candidateSlot?: string | null;
  /** When true, apply deterministic compaction if over target. Default true. */
  allowCompaction?: boolean;
};

export type EnforcePromptBudgetResult = {
  prompt: string;
  report: PromptBudgetReport;
};

/** Compact OBF discovery negatives — critical exclusions only (P0/P1). */
export const OBF_DISCOVERY_NEGATIVE_COMPACT = [
  "AI generated, CGI, 3D, 3d render, Midjourney fashion, Midjourney aesthetic, Instagram AI model,",
  "hyper-polished fashion avatar, excessive cinematic glow, orange teal grading,",
  "plastic skin, wax skin, beauty filter, airbrushed, perfect symmetry, perfect jawlines, glassy eyes,",
  "child, minor, underage, wrong gender, multiple people, watermark, text, logo,",
  "cloned faces, four brothers, same haircut silhouette across candidates,",
  "hyper masculine, hyper-masculine, bodybuilder, heavy full beard, perfume campaign, luxury runway,",
  "aggressive stare, gangster styling, passport photo, LinkedIn headshot,",
  "cinematic hero lighting, orange cast, over-smoothed dark skin, plastic AI skin,",
  "identical haircut silhouette across A/B/C/D,",
  "looking older than 26, visually 27+, mature 30+, finished advertising campaign look,",
  "street cafe scene, clothing rack set, invented product, third-party branding, jewelry focus",
].join(" ");

/**
 * Deterministic compaction for oversized OBF provider prompts.
 * Removes duplicated explanatory prose / repeated avoid lists while
 * keeping L3 identity, slot locks, age/ethnicity, and framing.
 */
export function compactOfficialBrandFaceProviderPrompt(prompt: string): string {
  let next = prompt;

  // Collapse excessive blank lines.
  next = next.replace(/\n{3,}/g, "\n\n");

  // Drop duplicated Mediterranean fashion-presence essay if it survived composition.
  next = next.replace(
    /PRIMARY BRAND FACE — CLEANER YOUNGER SOFT-MASCULINE STREETWEAR CASTING[\s\S]*?(?=\n\n[A-Z]|\n\nAvoid:|$)/i,
    "",
  );

  // Compress long photography director essays into a short shared rule.
  next = next.replace(
    /PREMIUM CASTING PHOTOGRAPHY — Official Brand Face A1[\s\S]*?(?=\n\nA1 PREMIUM CASTING SET|\n\nCAMERA DIRECTION|\n\n[A-Z]|\n\nAvoid:|$)/i,
    [
      "CASTING PHOTOGRAPHY — soft natural daylight, soft even shadows, real camera.",
      "Neutral plaster/concrete casting wall. No cinematic grade, no perfume lighting.",
      "Real pores and skin texture — never plastic AI skin.",
      "",
    ].join("\n"),
  );

  // Compress long presence essay if still present.
  next = next.replace(
    /CASTING PRESENCE — CALM FRIENDLY QUIET CONFIDENCE[\s\S]*?(?=\n\n[A-Z]|\n\nAvoid:|$)/i,
    [
      "CASTING PRESENCE — approachable confident natural, quiet youthful confidence.",
      "Never hyper-masculine, aggressive, perfume-campaign, or runway-extreme.",
      "",
    ].join("\n"),
  );

  // If Avoid: section is huge, replace with compact critical exclusions.
  next = next.replace(
    /\n\nAvoid:\s*[\s\S]*$/i,
    `\n\nAvoid: ${OBF_DISCOVERY_NEGATIVE_COMPACT}`,
  );

  next = next.replace(/\n{3,}/g, "\n\n").trim();
  return next;
}

export function logPromptBudgetReport(report: PromptBudgetReport): void {
  // Observability only — never log secrets or full prompt text.
  console.info(
    `[persona-prompt-budget] Provider: ${report.provider} | Candidate: ${report.candidateSlot ?? "?"} | Prompt length: ${report.promptLength.toLocaleString("en-US")} / ${report.promptBudget.toLocaleString("en-US")} | Compacted: ${report.compacted}`,
  );
}

/**
 * Enforce OpenAI discovery prompt budget before provider call.
 * Compacts deterministically when over target; fails closed if still over hard max.
 */
export function enforceOpenAiDiscoveryPromptBudget(
  input: EnforcePromptBudgetInput,
): EnforcePromptBudgetResult {
  const allowCompaction = input.allowCompaction !== false;
  let prompt = input.prompt;
  let compacted = false;

  if (allowCompaction && prompt.length > TARGET_PROVIDER_PROMPT_LENGTH) {
    const before = prompt;
    prompt = compactOfficialBrandFaceProviderPrompt(prompt);
    compacted = prompt !== before || prompt.length < before.length;
  }

  if (prompt.length > MAX_PROVIDER_PROMPT_LENGTH) {
    throw new PersonaDomainError(
      `Official Brand Face discovery prompt exceeds OpenAI limit (${prompt.length} > ${MAX_PROVIDER_PROMPT_LENGTH}) after compaction`,
      "PROMPT_TOO_LONG",
      {
        provider: input.provider,
        candidateSlot: input.candidateSlot ?? null,
        promptLength: prompt.length,
        promptBudget: MAX_PROVIDER_PROMPT_LENGTH,
        targetLength: TARGET_PROVIDER_PROMPT_LENGTH,
        compacted,
      },
    );
  }

  const report: PromptBudgetReport = {
    provider: input.provider,
    candidateSlot: input.candidateSlot ?? null,
    promptLength: prompt.length,
    promptBudget: MAX_PROVIDER_PROMPT_LENGTH,
    targetLength: TARGET_PROVIDER_PROMPT_LENGTH,
    compacted,
  };

  return { prompt, report };
}
