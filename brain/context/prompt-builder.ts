import type { BrainDomainContentMap } from "@/brain/domains";
import type { BrainDomain } from "@/brain/types";
import type { BrainContextSlice } from "./assembly";

const DOMAIN_LABELS: Record<string, string> = {
  company_profile: "Company Profile",
  brand_vision: "Brand Vision",
  brand_rules: "Brand Rules",
  decisions: "Decisions",
};

function formatCompanyProfile(
  content: BrainDomainContentMap["company_profile"],
): string {
  const lines = [
    `Company: ${content.companyName}`,
    `Industry: ${content.industry}`,
    `Business Model: ${content.businessModel}`,
    `Target Audience: ${content.targetAudience}`,
  ];

  if (content.goals.length) {
    lines.push(`Goals:\n${content.goals.map((g) => `  - ${g}`).join("\n")}`);
  }

  if (content.kpis.length) {
    lines.push(
      `KPIs:\n${content.kpis.map((k) => `  - ${k.name}: ${k.target}${k.current ? ` (current: ${k.current})` : ""}`).join("\n")}`,
    );
  }

  return lines.join("\n");
}

function formatBrandVision(
  content: BrainDomainContentMap["brand_vision"],
): string {
  const lines: string[] = [];

  if (content.mission) lines.push(`Mission: ${content.mission}`);
  if (content.vision) lines.push(`Vision: ${content.vision}`);
  if (content.positioning) lines.push(`Positioning: ${content.positioning}`);
  if (content.northStar) lines.push(`North Star: ${content.northStar}`);
  if (content.voiceTone) lines.push(`Voice & Tone: ${content.voiceTone}`);
  if (content.culturalIdentity)
    lines.push(`Cultural Identity: ${content.culturalIdentity}`);

  if (content.pillars?.length) {
    lines.push(
      `Brand Pillars:\n${content.pillars.map((p) => `  - ${p.name}: ${p.description}`).join("\n")}`,
    );
  }

  if (content.audienceSegments?.length) {
    lines.push("Audience Segments:");
    for (const seg of content.audienceSegments) {
      lines.push(`  - ${seg.name}: ${seg.description}`);
      if (seg.demographics) lines.push(`    Demographics: ${seg.demographics}`);
      if (seg.psychographics)
        lines.push(`    Psychographics: ${seg.psychographics}`);
      if (seg.geography?.length)
        lines.push(`    Geography: ${seg.geography.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function formatBrandRules(
  content: BrainDomainContentMap["brand_rules"],
): string {
  const lines: string[] = [];

  if (content.globalConstraints?.length) {
    lines.push(
      `Global Constraints:\n${content.globalConstraints.map((c) => `  - ${c}`).join("\n")}`,
    );
  }

  if (content.rules.length) {
    lines.push("Rules:");
    for (const rule of content.rules) {
      lines.push(`  - [${rule.severity.toUpperCase()}] ${rule.rule}`);
      if (rule.examples?.good?.length) {
        lines.push(`    Good: ${rule.examples.good.join("; ")}`);
      }
      if (rule.examples?.bad?.length) {
        lines.push(`    Avoid: ${rule.examples.bad.join("; ")}`);
      }
    }
  }

  return lines.join("\n");
}

function formatDecisions(
  content: BrainDomainContentMap["decisions"],
): string {
  return [
    `Decision: ${content.question}`,
    `Rationale: ${content.rationale}`,
    `Status: ${content.status}`,
    content.outcome ? `Outcome: ${content.outcome}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRecordContent(domain: BrainDomain, content: unknown): string {
  const c = content as BrainDomainContentMap[BrainDomain];

  switch (domain) {
    case "company_profile":
      return formatCompanyProfile(c as BrainDomainContentMap["company_profile"]);
    case "brand_vision":
      return formatBrandVision(c as BrainDomainContentMap["brand_vision"]);
    case "brand_rules":
      return formatBrandRules(c as BrainDomainContentMap["brand_rules"]);
    case "decisions":
      return formatDecisions(c as BrainDomainContentMap["decisions"]);
    default:
      return JSON.stringify(content, null, 2);
  }
}

export function buildPromptContext(slices: BrainContextSlice[]): string {
  const sections: string[] = [];

  for (const slice of slices) {
    const label = DOMAIN_LABELS[slice.domain] ?? slice.domain;

    for (const record of slice.records) {
      const body = formatRecordContent(slice.domain, record.content);
      sections.push(
        `## ${label}: ${record.title}\n${record.summary ? `${record.summary}\n\n` : ""}${body}`,
      );
    }
  }

  return sections.join("\n\n---\n\n");
}
