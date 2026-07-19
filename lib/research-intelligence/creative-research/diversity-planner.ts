/**
 * Run-level visual diversity planner for weekly design ideas.
 */

import type {
  DesignIdea,
  FrontBackConfiguration,
  TypographyFamily,
  VisualStructureId,
} from "./types";

export const VISUAL_STRUCTURES: VisualStructureId[] = [
  "typography_only",
  "editorial_archive",
  "symbolic_emblem",
  "architectural_line_art",
  "handwritten_annotation",
  "technical_diagram",
  "vertical_typography",
  "chest_only_minimal",
  "large_back_graphic",
  "sleeve_detail",
  "front_back_narrative",
  "asymmetric_placement",
  "badge_or_seal",
  "halftone_direction",
  "abstract_geometric",
];

export interface DiversityPlanSlot {
  visualStructure: VisualStructureId;
  typographyFamily: TypographyFamily;
  frontBack: FrontBackConfiguration;
  prefersNoBackPrint: boolean;
  requiresStrongVisualAnchor: boolean;
  productHint?: string;
}

export interface DiversityVerdict {
  passed: boolean;
  score: number;
  failures: string[];
}

/** Build a plan of distinct creative structures before filling ideas. */
export function planVisualDiversity(
  count: number,
  rotationSeed = 0,
): DiversityPlanSlot[] {
  const structures = rotate(VISUAL_STRUCTURES, rotationSeed);
  const typographyCycle: TypographyFamily[] = ["sans", "serif", "mono", "script", "mixed"];
  const products = [
    "Oversized T-Shirt",
    "Heavyweight Hoodie",
    "Crewneck",
    "Longsleeve",
    "Oversized T-Shirt",
  ];

  const slots: DiversityPlanSlot[] = [];
  let serifCount = 0;
  let smallFrontLargeBack = 0;

  for (let i = 0; i < count; i += 1) {
    const visualStructure = structures[i % structures.length];
    let typographyFamily = typographyCycle[i % typographyCycle.length];
    if (typographyFamily === "serif" && serifCount >= 2) {
      typographyFamily = "sans";
    }
    if (typographyFamily === "serif") serifCount += 1;

    const prefersNoBackPrint =
      i === 0 ||
      visualStructure === "chest_only_minimal" ||
      visualStructure === "typography_only" ||
      visualStructure === "sleeve_detail" ||
      visualStructure === "badge_or_seal";

    let frontBack: FrontBackConfiguration = prefersNoBackPrint
      ? visualStructure === "sleeve_detail"
        ? "front"
        : "front"
      : visualStructure === "large_back_graphic"
        ? "back"
        : visualStructure === "front_back_narrative"
          ? "front_and_back"
          : i % 3 === 0
            ? "front_and_back"
            : "front";

    if (frontBack === "front_and_back" && smallFrontLargeBack >= 2) {
      frontBack = "front";
    }
    if (frontBack === "front_and_back") smallFrontLargeBack += 1;

    slots.push({
      visualStructure,
      typographyFamily,
      frontBack,
      prefersNoBackPrint: frontBack === "front",
      requiresStrongVisualAnchor:
        visualStructure !== "typography_only" &&
        visualStructure !== "chest_only_minimal",
      productHint: products[i % products.length],
    });
  }

  // Guarantee at least one no-back-print idea
  if (!slots.some((slot) => slot.prefersNoBackPrint)) {
    slots[0] = {
      ...slots[0],
      frontBack: "front",
      prefersNoBackPrint: true,
      visualStructure: "chest_only_minimal",
    };
  }

  // Guarantee at least one stronger visual anchor
  if (!slots.some((slot) => slot.requiresStrongVisualAnchor)) {
    const idx = Math.min(1, slots.length - 1);
    slots[idx] = {
      ...slots[idx],
      visualStructure: "symbolic_emblem",
      requiresStrongVisualAnchor: true,
      frontBack: "front",
    };
  }

  return slots;
}

export function evaluateRunDiversity(ideas: DesignIdea[]): DiversityVerdict {
  const failures: string[] = [];
  let score = 100;

  const structures = ideas.map((idea) => idea.visualStructure);
  const uniqueStructures = new Set(structures);
  if (uniqueStructures.size < ideas.length) {
    failures.push("Gleiche Visual Structure mehrfach im Run");
    score -= 25 * (ideas.length - uniqueStructures.size);
  }

  const serifCount = ideas.filter((idea) => idea.typographyFamily === "serif").length;
  if (serifCount > 2) {
    failures.push(`Zu viele Serif-Ideen (${serifCount})`);
    score -= 20;
  }

  const smallFrontLargeBack = ideas.filter((idea) =>
    /brust.*klein|small.*chest|links brust.*rücken|front.*back/i.test(
      `${idea.placement} ${idea.frontBackConfiguration}`,
    ) && idea.frontBackConfiguration === "front_and_back",
  ).length;
  if (smallFrontLargeBack > 2) {
    failures.push("Zu viele Small-Front/Large-Back Layouts");
    score -= 20;
  }

  const themes = ideas.map((idea) => idea.emotionalTheme.toLowerCase());
  if (new Set(themes).size < ideas.length) {
    failures.push("Emotionale Themes wiederholen sich");
    score -= 15;
  }

  const noBack = ideas.some(
    (idea) =>
      idea.frontBackConfiguration === "front" ||
      idea.frontBackConfiguration === "open",
  );
  if (!noBack) {
    failures.push("Keine Idee ohne Rückenprint");
    score -= 20;
  }

  const strongAnchor = ideas.some(
    (idea) =>
      idea.visualStructure !== "typography_only" &&
      idea.visualStructure !== "chest_only_minimal" &&
      idea.graphicElements.some((el) => !/linie|line|leerraum|negative/i.test(el)),
  );
  if (!strongAnchor) {
    failures.push("Kein stärkerer visueller Anker außer Text+Linie");
    score -= 20;
  }

  const products = new Set(ideas.map((idea) => idea.recommendedProductType));
  if (products.size < Math.min(2, ideas.length)) {
    failures.push("Produkttypen zu einheitlich");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  return {
    passed: failures.length === 0 && score >= 70,
    score,
    failures,
  };
}

function rotate<T>(items: T[], seed: number): T[] {
  if (items.length === 0) return items;
  const offset = Math.abs(seed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}
