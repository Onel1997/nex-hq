import type { BrainDomainContentMap } from "@/brain/domains";
import type { BrainDomain, BrainRecord } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { BrainContextSlice } from "./assembly";
import { formatBulletList, truncateText } from "./text-utils";
import { formatDesignCreativeBrief } from "@/lib/design/creative-brief";

const ANALYSIS_EXCERPT_CHARS = 900;
const NOTES_EXCERPT_CHARS = 400;

function getDomainLabels(locale: Locale): Record<string, string> {
  const dict = getDictionary(locale);
  return { ...dict.ceo.promptBuilder.domainLabels };
}

function getPromptLabels(locale: Locale) {
  return getDictionary(locale).ceo.promptBuilder;
}

function formatCompanyProfile(
  content: BrainDomainContentMap["company_profile"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).companyProfile;
  const lines = [
    `${labels.company}: ${content.companyName}`,
    `${labels.industry}: ${content.industry}`,
    `${labels.businessModel}: ${truncateText(content.businessModel, 400)}`,
    `${labels.targetAudience}: ${truncateText(content.targetAudience, 400)}`,
  ];

  if (content.goals.length) {
    lines.push(
      `${labels.goals}:\n${formatBulletList(content.goals, { maxItems: 6 })}`,
    );
  }

  if (content.kpis.length) {
    lines.push(
      `${labels.kpis}:\n${content.kpis
        .slice(0, 6)
        .map((k) => `  - ${k.name}: ${k.target}${k.current ? ` (${labels.current}: ${k.current})` : ""}`)
        .join("\n")}`,
    );
  }

  return lines.join("\n");
}

function formatBrandVision(
  content: BrainDomainContentMap["brand_vision"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).brandVision;
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
      `${labels.brandPillars}:\n${content.pillars
        .slice(0, 6)
        .map((p) => `  - ${p.name}: ${truncateText(p.description, 200)}`)
        .join("\n")}`,
    );
  }

  if (content.audienceSegments?.length) {
    lines.push(labels.audienceSegments + ":");
    for (const seg of content.audienceSegments.slice(0, 4)) {
      lines.push(`  - ${seg.name}: ${truncateText(seg.description, 200)}`);
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
  const labels = getPromptLabels(locale).brandRules;
  const lines: string[] = [];

  if (content.globalConstraints?.length) {
    lines.push(
      `${labels.globalConstraints}:\n${formatBulletList(content.globalConstraints, { maxItems: 8 })}`,
    );
  }

  if (content.rules.length) {
    lines.push(labels.rules + ":");
    for (const rule of content.rules.slice(0, 10)) {
      lines.push(`  - [${rule.severity.toUpperCase()}] ${truncateText(rule.rule, 220)}`);
    }
  }

  return lines.join("\n");
}

function formatDecisions(
  content: BrainDomainContentMap["decisions"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).decisions;
  return [
    `${labels.decision}: ${content.question}`,
    `${labels.rationale}: ${truncateText(content.rationale, 400)}`,
    `${labels.status}: ${content.status}`,
    content.outcome ? `${labels.outcome}: ${content.outcome}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatReports(
  content: BrainDomainContentMap["reports"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).reports;
  const lines: string[] = [
    `${labels.agent}: ${content.agentId}`,
    `${labels.confidence}: ${Math.round(content.confidence * 100)}%`,
    `${labels.summary}: ${truncateText(content.summary, 500)}`,
  ];

  if (content.keyFindings?.length) {
    lines.push(
      `${labels.findings}:\n${formatBulletList(content.keyFindings, { maxItems: 8 })}`,
    );
  }

  if (content.designSections) {
    lines.push(
      `${labels.analysisExcerpt} (Design Creative Brief):\n${formatDesignCreativeBrief(content.designSections)}`,
    );
  } else {
    const markdownArtifact = content.artifacts?.find(
      (a) => a.type === "markdown" || a.type === "text",
    );
    if (markdownArtifact?.content) {
      lines.push(
        `${labels.analysisExcerpt}:\n${truncateText(markdownArtifact.content, ANALYSIS_EXCERPT_CHARS)}`,
      );
    }
  }

  if (content.notes) {
    lines.push(`${labels.notes}: ${truncateText(content.notes, NOTES_EXCERPT_CHARS)}`);
  }

  return lines.join("\n");
}

function formatCompetitorIntelligence(
  content: BrainDomainContentMap["competitor_intelligence"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).competitorIntelligence;
  const lines: string[] = [];

  if (content.analysisSummary) {
    lines.push(
      `${labels.analysisSummary}: ${truncateText(content.analysisSummary, 500)}`,
    );
  }

  if (content.competitors?.length) {
    lines.push(labels.competitors + ":");
    for (const competitor of content.competitors.slice(0, 6)) {
      lines.push(`  - ${competitor.name} (${labels.tier}: ${competitor.tier})`);
      if (competitor.positioning) {
        lines.push(
          `    ${labels.positioning}: ${truncateText(competitor.positioning, 200)}`,
        );
      }
      if (competitor.strengths?.length) {
        lines.push(
          `    ${labels.strengths}: ${competitor.strengths.slice(0, 4).join("; ")}`,
        );
      }
      if (competitor.weaknesses?.length) {
        lines.push(
          `    ${labels.weaknesses}: ${competitor.weaknesses.slice(0, 4).join("; ")}`,
        );
      }
      if (competitor.dropCadence) {
        lines.push(`    ${labels.dropCadence}: ${competitor.dropCadence}`);
      }
    }
  }

  if (content.competitiveEdge) {
    lines.push(
      `${labels.competitiveEdge}: ${truncateText(content.competitiveEdge, 300)}`,
    );
  }

  if (content.recommendedActions?.length) {
    lines.push(
      `${labels.recommendations}:\n${formatBulletList(content.recommendedActions, { maxItems: 6 })}`,
    );
  }

  if (content.marketSignals?.length) {
    lines.push(labels.marketSignals + ":");
    for (const signal of content.marketSignals.slice(0, 5)) {
      lines.push(
        `  - [${signal.relevance}] ${truncateText(signal.signal, 180)}`,
      );
    }
  }

  return lines.join("\n");
}

function formatDesignMemory(
  content: BrainDomainContentMap["design_memory"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).designMemory;
  const lines: string[] = [];

  if (content.dropVisualDirection) {
    lines.push(
      `${labels.dropVisualDirection}: ${truncateText(content.dropVisualDirection, 300)}`,
    );
  }
  if (content.moodKeywords?.length) {
    lines.push(`${labels.moodKeywords}: ${content.moodKeywords.slice(0, 8).join(", ")}`);
  }
  if (content.silhouettes?.length) {
    lines.push(
      `${labels.silhouettes}:\n${formatBulletList(content.silhouettes, { maxItems: 6 })}`,
    );
  }
  if (content.graphicTreatment) {
    lines.push(
      `${labels.graphicTreatment}: ${truncateText(content.graphicTreatment, 250)}`,
    );
  }
  if (content.colorPalette?.length) {
    lines.push(
      `${labels.colorPalette}: ${content.colorPalette
        .slice(0, 5)
        .map((c) => `${c.name} (${c.hex})`)
        .join(", ")}`,
    );
  }

  return lines.join("\n") || labels.empty;
}

function formatMarketingMemory(
  content: BrainDomainContentMap["marketing_memory"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).marketingMemory;
  const lines: string[] = [
    `${labels.name}: ${content.name}`,
    `${labels.status}: ${content.status}`,
  ];

  if (content.objective) {
    lines.push(`${labels.objective}: ${truncateText(content.objective, 300)}`);
  }
  if (content.notes) {
    lines.push(`${labels.notes}: ${truncateText(content.notes, 400)}`);
  }
  if (content.launchSequence?.length) {
    lines.push(
      `${labels.launchSequence}:\n${formatBulletList(content.launchSequence, { maxItems: 6 })}`,
    );
  }
  if (content.channelMix?.length) {
    lines.push(
      `${labels.channelMix}: ${content.channelMix
        .slice(0, 5)
        .map((c) => `${c.channel} (${c.role})`)
        .join("; ")}`,
    );
  }
  if (content.kpis?.length) {
    lines.push(
      `${labels.kpis}:\n${content.kpis
        .slice(0, 5)
        .map((k) => `  - ${k.metric}: ${k.target}`)
        .join("\n")}`,
    );
  }

  return lines.join("\n");
}

function formatProductMemory(
  content: BrainDomainContentMap["product_memory"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).productMemory;
  const lines: string[] = [
    `${labels.name}: ${content.name}`,
    `${labels.status}: ${content.status}`,
  ];

  if (content.description) {
    lines.push(`${labels.description}: ${truncateText(content.description, 300)}`);
  }
  if (content.category) {
    lines.push(`${labels.category}: ${content.category}`);
  }
  if (content.drop) {
    lines.push(
      `${labels.drop}: ${content.drop.name}${content.drop.launchDate ? ` (${content.drop.launchDate})` : ""}`,
    );
    if (content.drop.narrative) {
      lines.push(
        `  ${labels.narrative}: ${truncateText(content.drop.narrative, 200)}`,
      );
    }
  }
  if (content.tags?.length) {
    lines.push(`${labels.tags}: ${content.tags.slice(0, 8).join(", ")}`);
  }

  return lines.join("\n");
}

function formatContentMemory(
  content: BrainDomainContentMap["content_memory"],
  locale: Locale,
): string {
  const labels = getPromptLabels(locale).contentMemory;
  const lines: string[] = [
    `${labels.format}: ${content.format}`,
  ];

  if (content.channel) {
    lines.push(`${labels.channel}: ${content.channel}`);
  }
  if (content.narrativeArc) {
    lines.push(
      `${labels.narrativeArc}: ${truncateText(content.narrativeArc, 300)}`,
    );
  }
  if (content.copyRules?.length) {
    lines.push(
      `${labels.copyRules}:\n${formatBulletList(content.copyRules, { maxItems: 5 })}`,
    );
  }
  if (content.blocks?.length) {
    lines.push(labels.blocks + ":");
    for (const block of content.blocks.slice(0, 3)) {
      lines.push(
        `  - [${block.format}] ${truncateText(block.body, 220)}`,
      );
    }
  }

  return lines.join("\n");
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
    case "reports":
      return formatReports(c as BrainDomainContentMap["reports"], locale);
    case "competitor_intelligence":
      return formatCompetitorIntelligence(
        c as BrainDomainContentMap["competitor_intelligence"],
        locale,
      );
    case "design_memory":
      return formatDesignMemory(c as BrainDomainContentMap["design_memory"], locale);
    case "marketing_memory":
      return formatMarketingMemory(
        c as BrainDomainContentMap["marketing_memory"],
        locale,
      );
    case "product_memory":
      return formatProductMemory(c as BrainDomainContentMap["product_memory"], locale);
    case "content_memory":
      return formatContentMemory(c as BrainDomainContentMap["content_memory"], locale);
    default:
      return truncateText(JSON.stringify(content, null, 2), 800);
  }
}

function formatRecordSection(
  record: BrainRecord,
  domain: BrainDomain,
  locale: Locale,
): string {
  const domainLabels = getDomainLabels(locale);
  const label = domainLabels[domain] ?? domain;
  const labels = getPromptLabels(locale);
  const body = formatRecordContent(domain, record.content, locale);

  const header = [
    `## ${label}: ${record.title}`,
    `${labels.recordMeta.status}: ${record.status}`,
    record.summary ? `${labels.recordMeta.summary}: ${truncateText(record.summary, 400)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n\n${body}`;
}

export function buildPromptContext(
  slices: BrainContextSlice[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const sections: string[] = [];

  for (const slice of slices) {
    for (const record of slice.records) {
      sections.push(formatRecordSection(record, slice.domain, locale));
    }
  }

  return sections.join("\n\n---\n\n");
}
