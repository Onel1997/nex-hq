import type { BrainDomainContentMap } from "@/brain/domains";
import type { BrainDomain } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { BrainContextSlice } from "./assembly";

function getDomainLabels(locale: Locale): Record<string, string> {
  const dict = getDictionary(locale);
  return { ...dict.ceo.promptBuilder.domainLabels };
}

function formatCompanyProfile(
  content: BrainDomainContentMap["company_profile"],
  locale: Locale,
): string {
  const labels = getDictionary(locale).ceo.promptBuilder.companyProfile;
  const lines = [
    `${labels.company}: ${content.companyName}`,
    `${labels.industry}: ${content.industry}`,
    `${labels.businessModel}: ${content.businessModel}`,
    `${labels.targetAudience}: ${content.targetAudience}`,
  ];

  if (content.goals.length) {
    lines.push(
      `${labels.goals}:\n${content.goals.map((g) => `  - ${g}`).join("\n")}`,
    );
  }

  if (content.kpis.length) {
    lines.push(
      `${labels.kpis}:\n${content.kpis.map((k) => `  - ${k.name}: ${k.target}${k.current ? ` (${labels.current}: ${k.current})` : ""}`).join("\n")}`,
    );
  }

  return lines.join("\n");
}

function formatBrandVision(
  content: BrainDomainContentMap["brand_vision"],
  locale: Locale,
): string {
  const labels = getDictionary(locale).ceo.promptBuilder.brandVision;
  const lines: string[] = [];

  if (content.mission) lines.push(`${labels.mission}: ${content.mission}`);
  if (content.vision) lines.push(`${labels.vision}: ${content.vision}`);
  if (content.positioning)
    lines.push(`${labels.positioning}: ${content.positioning}`);
  if (content.northStar) lines.push(`${labels.northStar}: ${content.northStar}`);
  if (content.voiceTone)
    lines.push(`${labels.voiceTone}: ${content.voiceTone}`);
  if (content.culturalIdentity)
    lines.push(`${labels.culturalIdentity}: ${content.culturalIdentity}`);

  if (content.pillars?.length) {
    lines.push(
      `${labels.brandPillars}:\n${content.pillars.map((p) => `  - ${p.name}: ${p.description}`).join("\n")}`,
    );
  }

  if (content.audienceSegments?.length) {
    lines.push(labels.audienceSegments + ":");
    for (const seg of content.audienceSegments) {
      lines.push(`  - ${seg.name}: ${seg.description}`);
      if (seg.demographics)
        lines.push(`    ${labels.demographics}: ${seg.demographics}`);
      if (seg.psychographics)
        lines.push(`    ${labels.psychographics}: ${seg.psychographics}`);
      if (seg.geography?.length)
        lines.push(`    ${labels.geography}: ${seg.geography.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function formatBrandRules(
  content: BrainDomainContentMap["brand_rules"],
  locale: Locale,
): string {
  const labels = getDictionary(locale).ceo.promptBuilder.brandRules;
  const lines: string[] = [];

  if (content.globalConstraints?.length) {
    lines.push(
      `${labels.globalConstraints}:\n${content.globalConstraints.map((c) => `  - ${c}`).join("\n")}`,
    );
  }

  if (content.rules.length) {
    lines.push(labels.rules + ":");
    for (const rule of content.rules) {
      lines.push(`  - [${rule.severity.toUpperCase()}] ${rule.rule}`);
      if (rule.examples?.good?.length) {
        lines.push(`    ${labels.good}: ${rule.examples.good.join("; ")}`);
      }
      if (rule.examples?.bad?.length) {
        lines.push(`    ${labels.avoid}: ${rule.examples.bad.join("; ")}`);
      }
    }
  }

  return lines.join("\n");
}

function formatDecisions(
  content: BrainDomainContentMap["decisions"],
  locale: Locale,
): string {
  const labels = getDictionary(locale).ceo.promptBuilder.decisions;
  return [
    `${labels.decision}: ${content.question}`,
    `${labels.rationale}: ${content.rationale}`,
    `${labels.status}: ${content.status}`,
    content.outcome ? `${labels.outcome}: ${content.outcome}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRecordContent(
  domain: BrainDomain,
  content: unknown,
  locale: Locale,
): string {
  const c = content as BrainDomainContentMap[BrainDomain];

  switch (domain) {
    case "company_profile":
      return formatCompanyProfile(
        c as BrainDomainContentMap["company_profile"],
        locale,
      );
    case "brand_vision":
      return formatBrandVision(c as BrainDomainContentMap["brand_vision"], locale);
    case "brand_rules":
      return formatBrandRules(c as BrainDomainContentMap["brand_rules"], locale);
    case "decisions":
      return formatDecisions(c as BrainDomainContentMap["decisions"], locale);
    default:
      return JSON.stringify(content, null, 2);
  }
}

export function buildPromptContext(
  slices: BrainContextSlice[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const domainLabels = getDomainLabels(locale);
  const sections: string[] = [];

  for (const slice of slices) {
    const label = domainLabels[slice.domain] ?? slice.domain;

    for (const record of slice.records) {
      const body = formatRecordContent(slice.domain, record.content, locale);
      sections.push(
        `## ${label}: ${record.title}\n${record.summary ? `${record.summary}\n\n` : ""}${body}`,
      );
    }
  }

  return sections.join("\n\n---\n\n");
}
