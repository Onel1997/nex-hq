import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";
import type { CreativeThinkingVerdict, DesignPatternTemplate } from "../types";

const PREMIUM_PRICE_EUR = 55;

export interface CreativeThinkingInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  engine: FashionDesignEngineResult;
  pattern: DesignPatternTemplate;
  rankingOverall: number;
}

/**
 * Senior Creative Director gate — five questions before export.
 * Is this beautiful? Wearable? Premium? Milaene? Worth €55?
 */
export function evaluateCreativeThinking(input: CreativeThinkingInput): CreativeThinkingVerdict {
  const { brief, concept, engine, pattern, rankingOverall } = input;
  const reasoning: string[] = [];

  const beautiful = evaluateBeauty(engine, pattern, reasoning);
  const wearable = evaluateWearability(brief, concept, engine, pattern, reasoning);
  const premium = evaluatePremium(engine, pattern, rankingOverall, reasoning);
  const fitsMilaene = evaluateMilaeneFit(engine, concept, brief, reasoning);
  const worthPremiumPrice = evaluatePriceTest(rankingOverall, premium, fitsMilaene, reasoning);

  const passed = beautiful && wearable && premium && fitsMilaene && worthPremiumPrice;

  if (!passed) {
    reasoning.push("Creative gate failed — regenerate with different pattern or adjust composition");
  } else {
    reasoning.push("Creative gate passed — design meets Senior Streetwear Creative Director standard");
  }

  return {
    beautiful,
    wearable,
    premium,
    fitsMilaene,
    worthPremiumPrice,
    passed,
    reasoning,
  };
}

function evaluateBeauty(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
  reasoning: string[],
): boolean {
  const composition = engine.compositionSpec;
  const graphicCount =
    engine.graphicSpec.symbols.length +
    engine.graphicSpec.lineSystems.length +
    engine.graphicSpec.abstractElements.length;

  let score = composition.score;
  if (graphicCount >= 3) score += 5;
  if (composition.proportions.negativeSpaceShare >= 55) score += 5;
  if (pattern.commercialScore >= 90) score += 3;

  const pass = score >= 78 && graphicCount >= 2 && composition.issues.length <= 2;
  reasoning.push(
    pass
      ? `Beautiful: composition ${score}, graphic systems ${graphicCount}, pattern ${pattern.name}`
      : `Not beautiful enough: composition ${score}, issues: ${composition.issues.slice(0, 2).join("; ") || "none"}`,
  );
  return pass;
}

function evaluateWearability(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
  reasoning: string[],
): boolean {
  const textBlocks = engine.typographySpec.blocks.length;
  const area = engine.layoutSpec.printArea;
  const density = textBlocks + engine.graphicSpec.symbols.length;

  let pass = true;
  if (density > 8) pass = false;
  if (area === "left-chest" && textBlocks > 2) pass = false;
  if (concept.fashionLanguage.antiPatterns.some((p) => p.includes("costume"))) pass = false;
  if (pattern.garmentCompatibility.length === 0) pass = false;

  reasoning.push(
    pass
      ? `Wearable: ${area} placement, ${textBlocks} text blocks, ${brief.product}`
      : `Wearability risk: density ${density} too high for ${brief.product}`,
  );
  return pass;
}

function evaluatePremium(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
  rankingOverall: number,
  reasoning: string[],
): boolean {
  const hero = engine.typographySpec.blocks.find((b) => b.role === "hero");
  const tracking = hero?.letterSpacingMm ?? 0;
  const voidShare = engine.compositionSpec.proportions.negativeSpaceShare;
  const pass =
    rankingOverall >= 82 &&
    voidShare >= 48 &&
    tracking >= 1.8 &&
    pattern.commercialScore >= 85;

  reasoning.push(
    pass
      ? `Premium: ranking ${rankingOverall}, void ${voidShare}%, tracking ${tracking}mm`
      : `Premium perception insufficient: ranking ${rankingOverall}, void ${voidShare}%`,
  );
  return pass;
}

function evaluateMilaeneFit(
  engine: FashionDesignEngineResult,
  concept: DesignConcept,
  brief: DesignStudioBrief,
  reasoning: string[],
): boolean {
  const dna = engine.creativeBrief.brandDnaValidation;
  const antiPatterns = [
    ...engine.creativeBrief.antiPatterns,
    ...concept.fashionLanguage.antiPatterns,
  ];

  const pass =
    dna.passed &&
    dna.conflicts.length === 0 &&
    antiPatterns.length <= 8 &&
    (brief.dnaScore ?? 70) >= 60;

  reasoning.push(
    pass
      ? `Milaene fit: DNA ${dna.score}%, ${dna.matches.slice(0, 2).join(", ")}`
      : `Milaene conflicts: ${dna.conflicts.join(", ") || "DNA gate failed"}`,
  );
  return pass;
}

function evaluatePriceTest(
  rankingOverall: number,
  premium: boolean,
  fitsMilaene: boolean,
  reasoning: string[],
): boolean {
  const pass = rankingOverall >= 88 && premium && fitsMilaene;
  reasoning.push(
    pass
      ? `€${PREMIUM_PRICE_EUR} test passed — ranking ${rankingOverall}`
      : `€${PREMIUM_PRICE_EUR} test failed — ranking ${rankingOverall} below premium threshold`,
  );
  return pass;
}
