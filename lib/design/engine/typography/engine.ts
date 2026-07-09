import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  CreativeComposition,
  DesignIntelligence,
  LayoutZones,
  StyleProfile,
  TypeElement,
  TypeRole,
} from "@/lib/design/engine/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function toRoman(seed: number): string {
  return ROMAN[seed % ROMAN.length]!;
}

function formatCoord(seed: number, index: number): string {
  const lat = (34 + ((seed + index * 17) % 12) + ((seed + index) % 100) / 100).toFixed(1);
  const lng = (118 + ((seed + index * 23) % 8) + ((seed + index * 3) % 100) / 100).toFixed(1);
  return `${lat}N ${lng}W`;
}

function headlineText(title: string): string {
  const words = title.trim().split(/\s+/);
  return words.length > 2 ? words.slice(0, 2).join(" ") : title;
}

function opticalX(
  x: number,
  align: TypeElement["align"],
  size: number,
  text: string,
): number {
  if (align === "middle") return x;
  const bias = text.length * size * 0.02;
  return align === "start" ? x + bias : x - bias;
}

function addBlock(
  blocks: TypeElement[],
  params: Omit<TypeElement, "id"> & { id?: string },
): void {
  blocks.push({ id: params.id ?? `type-${params.role}-${blocks.length}`, ...params });
}

/** Professional typography system — primary design element. */
export function buildTypographySystem(
  brief: DesignStudioBrief,
  composition: CreativeComposition,
  intelligence: DesignIntelligence,
  style: StyleProfile,
  layout: LayoutZones,
): TypeElement[] {
  const blocks: TypeElement[] = [];
  const seed = composition.seed;
  const typeText = brief.typography.toLowerCase();
  const hasType = !typeText.includes("no type") && !typeText.includes("graphic only");
  const cx = snap(layout.heroZone.x + layout.heroZone.width / 2);
  const typeBaseY = snap(layout.typeZone.y + layout.baselineGrid * 2);
  const grid = layout.baselineGrid;

  const headlineSize = 26 * style.headlineScale * composition.compositionRhythm;
  const subSize = 9.5;
  const microSize = 6;

  if (hasType && intelligence.typographyWeight > 0.3) {
    const headline = headlineText(brief.title);
    const isOversized =
      composition.layoutFamily.includes("oversized") ||
      style.family === "editorial-fashion" ||
      style.family === "swiss-typography";

    addBlock(blocks, {
      role: isOversized ? "oversized" : "headline",
      text: headline,
      x: opticalX(cx, "middle", headlineSize, headline),
      y: typeBaseY,
      size: isOversized ? headlineSize * 1.15 : headlineSize,
      weight: style.family === "swiss-typography" ? 600 : 500,
      tracking: style.trackingWide,
      lineHeight: 1.05,
      align: "middle",
      opacity: 0.94,
      rotation: 0,
      layer: "typography",
    });

    if (intelligence.typographyWeight > 0.45 && composition.streetwearCategory !== "graphic") {
      const edition = String(2020 + (seed % 6));
      addBlock(blocks, {
        role: "subheadline",
        text: `${brief.product.split(" ")[0]?.toUpperCase() ?? "MILAENE"} · ${edition}`,
        x: cx,
        y: snap(typeBaseY + headlineSize * 1.2),
        size: subSize,
        weight: 400,
        tracking: style.trackingNormal + 0.1,
        lineHeight: 1.25,
        align: "middle",
        opacity: 0.55,
        rotation: 0,
        layer: "typography",
      });
    }
  }

  if (composition.styleFamily === "faith" || typeText.includes("roman") || seed % 3 === 0) {
    addBlock(blocks, {
      role: "roman-numeral",
      text: toRoman(seed),
      x: snap(layout.safeZone.x + layout.safeZone.width * 0.07),
      y: snap(layout.safeZone.y + layout.marginTop),
      size: 8,
      weight: 400,
      tracking: style.trackingWide,
      lineHeight: 1.1,
      align: "start",
      opacity: 0.42,
      rotation: 0,
      layer: "decorative",
    });
  }

  const coordCount = 2 + (seed % 3);
  const coordAnchors = [
    { x: layout.safeZone.x + layout.safeZone.width * 0.1, y: layout.safeZone.y + layout.safeZone.height * 0.9, align: "start" as const },
    { x: layout.safeZone.x + layout.safeZone.width * 0.9, y: layout.safeZone.y + layout.safeZone.height * 0.9, align: "end" as const },
    { x: layout.safeZone.x + layout.safeZone.width * 0.9, y: layout.safeZone.y + layout.marginTop, align: "end" as const },
    { x: layout.safeZone.x + layout.safeZone.width * 0.1, y: layout.safeZone.y + layout.marginTop + grid * 2, align: "start" as const },
  ].slice(0, coordCount);

  coordAnchors.forEach((anchor, i) => {
    addBlock(blocks, {
      role: "coordinates",
      text: formatCoord(seed, i),
      x: snap(anchor.x),
      y: snap(anchor.y),
      size: microSize,
      weight: 400,
      tracking: style.trackingWide + 0.06,
      lineHeight: 1.4,
      align: anchor.align,
      opacity: 0.34 + range(seed, i + 300, 0, 0.12),
      rotation: 0,
      layer: "decorative",
    });
  });

  if (brief.campaignPotential || brief.role.includes("collection")) {
    addBlock(blocks, {
      role: "collection-tag",
      text: (brief.campaignPotential ?? brief.role).replace(/-/g, " ").slice(0, 24).toUpperCase(),
      x: cx,
      y: snap(typeBaseY - grid * 4),
      size: microSize,
      weight: 400,
      tracking: style.trackingNormal,
      lineHeight: 1.3,
      align: "middle",
      opacity: 0.38,
      rotation: 0,
      layer: "decorative",
    });
  }

  if (composition.layoutFamily === "vertical-layout") {
    const word = headlineText(brief.title).split(" ")[0]?.slice(0, 5) ?? "M";
    addBlock(blocks, {
      role: "vertical",
      text: word,
      x: snap(layout.safeZone.x + layout.safeZone.width * 0.08),
      y: snap(layout.heroZone.y + grid * 2),
      size: 7,
      weight: 400,
      tracking: style.trackingWide,
      lineHeight: 1.15,
      align: "start",
      opacity: 0.5,
      rotation: 0,
      layer: "typography",
    });
  }

  if (typeText.includes("curve") || composition.styleFamily === "editorial-fashion") {
    const quote = brief.visualConcept.split(".").find((s) => s.length > 8)?.trim().slice(0, 32) ?? "";
    if (quote && hasType) {
      addBlock(blocks, {
        role: "curved",
        text: quote,
        x: cx,
        y: snap(layout.heroZone.y - grid),
        size: 7,
        weight: 300,
        tracking: style.trackingNormal,
        lineHeight: 1.4,
        align: "middle",
        opacity: 0.4,
        rotation: 0,
        curved: true,
        curveRadius: layout.heroZone.width * 0.22,
        layer: "decorative",
      });
    }
  }

  addBlock(blocks, {
    role: "production-text",
    text: brief.productionMethod.split(" ").slice(0, 3).join(" ").toUpperCase(),
    x: snap(layout.safeZone.x + layout.safeZone.width * 0.5),
    y: snap(layout.safeZone.y + layout.safeZone.height - grid),
    size: 5.5,
    weight: 400,
    tracking: style.trackingTight,
    lineHeight: 1.2,
    align: "middle",
    opacity: 0.22,
    rotation: 0,
    layer: "decorative",
  });

  return blocks;
}
