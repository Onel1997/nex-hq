import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  LayoutDefinition,
  LayoutZones,
  TemplateDefinition,
  TypographyPlacement,
  TypographySystemDefinition,
  TypographySystemId,
} from "@/lib/design/design-library/types";
import { getTypographySystem } from "@/lib/design/design-library/typography/registry";
import { DESIGN_TOKENS } from "@/lib/design/vector-engine/tokens";
import {
  extractHeadline,
  formatCoordinates,
  toRomanNumeral,
} from "@/lib/design/vector-engine/typography";
import { snap } from "@/lib/design/vector-engine/tokens";

export function selectTypographySystem(style: DesignStyleDefinition): TypographySystemDefinition {
  const preferred = style.typographyPreference[0] as TypographySystemId | undefined;
  return getTypographySystem(preferred ?? "modern-sans");
}

export function buildTypographyPlacements(
  brief: DesignStudioBrief,
  style: DesignStyleDefinition,
  layout: LayoutDefinition,
  zones: LayoutZones,
  template: TemplateDefinition,
  typographySystem: TypographySystemDefinition,
  seed: number,
): TypographyPlacement[] {
  const placements: TypographyPlacement[] = [];
  const tokens = DESIGN_TOKENS.typography;
  const hierarchy = typographySystem.hierarchyPresets[0] ?? { headlineScale: 1, subheadlineScale: 1, decorScale: 1 };
  const tracking = typographySystem.trackingPresets[0]?.value ?? style.trackingNormal;
  const typeText = brief.typography.toLowerCase();
  const headline = extractHeadline(brief.title);

  const headlineScale =
    style.headlineScale *
    layout.scaling.typeScale *
    hierarchy.headlineScale *
    (style.preferredPrintScale === "micro" ? 0.82 : style.preferredPrintScale === "oversized" ? 1.06 : 1);

  const typeX = layout.alignment === "left" ? zones.typeZone.x : zones.anchors.type.x;
  const typeY = zones.anchors.type.y;
  const align = layout.alignment === "left" ? "start" : layout.alignment === "asymmetric" ? "middle" : "middle";

  if (!typeText.includes("no type") && !typeText.includes("graphic only")) {
    const words = headline.trim().split(/\s+/);
    const display =
      style.preferredPrintScale === "oversized" && words.length > 1
        ? words.slice(0, 2).join(" ")
        : words.length > 2
          ? words.slice(0, 2).join(" ")
          : headline;

    placements.push({
      id: "type-headline",
      role: template.hierarchy === "type-first" ? "stacked-headline" : "headline",
      text: display,
      x: snap(typeX),
      y: snap(typeY),
      size: tokens.headline.size * headlineScale,
      tracking: tracking + style.trackingWide * 0.2,
      lineHeight: tokens.headline.lineHeight,
      weight: style.hierarchy === "type-first" ? 500 : 450,
      align,
      rotation: 0,
      opacity: style.hierarchy === "type-first" ? 0.96 : 0.88,
      layer: "typography",
    });

    if (template.ornaments.includes("collection-numbers") || style.hierarchy !== "geometry-first") {
      const editionYear = String(2020 + (seed % 6));
      placements.push({
        id: "type-subheadline",
        role: "subheadline",
        text: `${brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO"} · ${editionYear}`,
        x: snap(typeX),
        y: snap(typeY + tokens.headline.size * headlineScale * 1.12),
        size: tokens.subHeadline.size * hierarchy.subheadlineScale,
        tracking: tracking + 0.12,
        lineHeight: tokens.subHeadline.lineHeight,
        weight: 400,
        align,
        rotation: 0,
        opacity: 0.52,
        layer: "typography",
      });
    }
  }

  if (template.ornaments.includes("coordinates") || typographySystem.supportedRoles.includes("coordinates")) {
    const positions = [
      { x: zones.safeZone.x + zones.safeZone.width * 0.12, y: zones.safeZone.y + zones.safeZone.height * 0.9, align: "start" as const },
      { x: zones.safeZone.x + zones.safeZone.width * 0.88, y: zones.safeZone.y + zones.safeZone.height * 0.9, align: "end" as const },
      { x: zones.safeZone.x + zones.safeZone.width * 0.88, y: zones.safeZone.y + zones.safeZone.height * 0.1, align: "end" as const },
    ];
    positions.forEach((pos, i) => {
      placements.push({
        id: `type-coord-${i}`,
        role: "coordinates",
        text: formatCoordinates(seed + i * 17).replace("° N", "°").replace("° W", ""),
        x: snap(pos.x),
        y: snap(pos.y),
        size: tokens.coordinates.size,
        tracking: tokens.coordinates.tracking,
        lineHeight: tokens.coordinates.lineHeight,
        weight: 400,
        align: pos.align,
        rotation: 0,
        opacity: 0.34,
        layer: "decorative",
      });
    });
  }

  if (template.ornaments.includes("roman-ids")) {
    placements.push({
      id: "type-roman",
      role: "roman-numeral",
      text: toRomanNumeral(seed),
      x: snap(zones.safeZone.x + zones.safeZone.width * 0.08),
      y: snap(zones.safeZone.y + zones.safeZone.height * 0.11),
      size: tokens.romanNumeral.size,
      tracking: tokens.romanNumeral.tracking,
      lineHeight: tokens.romanNumeral.lineHeight,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.38,
      layer: "decorative",
    });
  }

  if (template.ornaments.includes("tiny-capsules")) {
    placements.push({
      id: "type-capsule",
      role: "collection-code",
      text: `${toRomanNumeral(seed)} · ${String(2020 + (seed % 6)).slice(-2)}`,
      x: zones.anchors.focal.x,
      y: snap(zones.anchors.type.y + zones.safeZone.height * 0.14),
      size: tokens.caption.size,
      tracking: tokens.caption.tracking,
      lineHeight: tokens.caption.lineHeight,
      weight: 400,
      align: "middle",
      rotation: 0,
      opacity: 0.55,
      layer: "decorative",
    });
  }

  if (layout.id === "vertical-print" && typographySystem.supportedRoles.includes("vertical-text")) {
    const verticalWord =
      headline.split(" ").find((w) => w.length >= 4)?.slice(0, 5) ??
      headline.replace(/\s/g, "").slice(0, 4);
    placements.push({
      id: "type-vertical",
      role: "vertical-text",
      text: verticalWord,
      x: snap(zones.safeZone.x + zones.safeZone.width * 0.09),
      y: snap(zones.safeZone.y + zones.safeZone.height * 0.3),
      size: tokens.vertical.size,
      tracking: tokens.vertical.tracking,
      lineHeight: tokens.vertical.lineHeight,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.55,
      layer: "typography",
    });
  }

  return placements;
}
