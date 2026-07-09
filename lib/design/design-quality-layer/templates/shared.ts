import type { GraphicSpec } from "@/lib/design/fashion-design-engine/types";
import type { CompositionTemplateContext } from "../types";

export function cloneSpecs<T>(value: T): T {
  return structuredClone(value);
}

export function enrichGraphicSystems(
  graphicSpec: GraphicSpec,
  additions: {
    lineSystems?: GraphicSpec["lineSystems"];
    symbols?: GraphicSpec["symbols"];
    abstractElements?: GraphicSpec["abstractElements"];
    textures?: GraphicSpec["textures"];
  },
): GraphicSpec {
  const merged: GraphicSpec = {
    ...graphicSpec,
    lineSystems: [...graphicSpec.lineSystems],
    symbols: [...graphicSpec.symbols],
    abstractElements: [...graphicSpec.abstractElements],
    textures: [...graphicSpec.textures],
  };

  if (additions.lineSystems) {
    for (const system of additions.lineSystems) {
      if (!merged.lineSystems.some((s) => s.id === system.id)) {
        merged.lineSystems.push(system);
      }
    }
  }

  if (additions.symbols) {
    for (const symbol of additions.symbols) {
      if (!merged.symbols.some((s) => s.id === symbol.id)) {
        merged.symbols.push(symbol);
      }
    }
  }

  if (additions.abstractElements) {
    for (const element of additions.abstractElements) {
      if (!merged.abstractElements.some((e) => e.id === element.id)) {
        merged.abstractElements.push(element);
      }
    }
  }

  if (additions.textures) {
    for (const texture of additions.textures) {
      if (!merged.textures.some((t) => t.id === texture.id)) {
        merged.textures.push(texture);
      }
    }
  }

  return merged;
}

export function basePremiumGraphics(ctx: CompositionTemplateContext): GraphicSpec["lineSystems"] {
  return [
    {
      id: "quality-perimeter-frame",
      type: "perimeter",
      count: 1,
      strokeWidthMm: 0.8,
      spacingMm: 0,
      opacity: 0.55,
    },
    {
      id: "quality-registration-grid",
      type: "grid",
      count: 3,
      strokeWidthMm: 0.35,
      spacingMm: 18,
      opacity: 0.35,
    },
  ];
}

export function registrationSymbols(): GraphicSpec["symbols"] {
  return [
    {
      id: "reg-mark-tl",
      name: "registration-cross",
      abstraction: "geometric",
      meaning: "Print registration mark",
      strokeWidthMm: 0.5,
      dimensionsMm: { width: 6, height: 6 },
    },
    {
      id: "reg-mark-br",
      name: "registration-cross",
      abstraction: "geometric",
      meaning: "Print registration mark",
      strokeWidthMm: 0.5,
      dimensionsMm: { width: 6, height: 6 },
    },
  ];
}

export function concreteGrainTexture(): GraphicSpec["textures"] {
  return [
    {
      id: "concrete-grain",
      type: "grain",
      intensityPercent: 8,
      application: "Controlled concrete grain overlay — edges only",
    },
  ];
}

export function distressedTexture(): GraphicSpec["textures"] {
  return [
    {
      id: "controlled-distress",
      type: "distress",
      intensityPercent: 10,
      application: "Subtle distressed edge fade — never full-surface destruction",
    },
  ];
}

export function boostCompositionScore(
  compositionSpec: CompositionTemplateContext["engine"]["compositionSpec"],
  delta: number,
): CompositionTemplateContext["engine"]["compositionSpec"] {
  return {
    ...compositionSpec,
    score: Math.min(100, compositionSpec.score + delta),
    recommendations: [
      "Premium composition template applied — Kittl-level graphic balance",
      ...compositionSpec.recommendations,
    ].slice(0, 5),
  };
}
