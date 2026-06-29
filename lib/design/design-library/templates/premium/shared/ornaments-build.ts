import type { OrnamentId } from "@/lib/design/design-library/types";
import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { renderOrnament } from "@/lib/design/design-library/ornaments/render";
import {
  capsuleText,
  renderCapsuleCode,
  renderCoordinateMarks,
  renderVerticalRules,
} from "@/lib/design/engine/assets/library";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";
import { circle, group, line } from "@/lib/design/vector-engine/xml";

export interface OrnamentLayerBuild {
  ornamentLayer: string;
  editorialLayer: string;
  microLayer: string;
  groupCount: number;
}

export function buildOrnamentLayers(
  c: PremiumRenderContext,
  ornamentSets: OrnamentId[][],
): OrnamentLayerBuild {
  const { focal, heroScale, seed, colors, strokeWidth, safeZone } = c;
  const ornamentCtx = { colors, strokeWidth, seed, safeZone };

  const ornamentGroups: string[] = [];
  ornamentSets.forEach((set, setIdx) => {
    const parts: string[] = [];
    set.forEach((ornamentId, i) => {
      parts.push(
        renderOrnament({
          ...ornamentCtx,
          placement: {
            id: `premium-ornament-${setIdx}-${i}`,
            ornamentId,
            cx: snap(focal.x + range(seed, 200 + setIdx * 10 + i, -heroScale * 0.3, heroScale * 0.3)),
            cy: snap(focal.y + range(seed, 210 + setIdx * 10 + i, -heroScale * 0.25, heroScale * 0.35)),
            scale: heroScale * range(seed, 220 + i, 0.2, 0.36),
            rotation: range(seed, 230 + i, -5, 5),
            opacity: range(seed, 240 + i, 0.28, 0.5),
          },
        }),
      );
    });
    ornamentGroups.push(group(`premium-orn-group-${setIdx}`, parts.join("")));
  });

  const coordMarks = renderCoordinateMarks({
    cx: focal.x,
    cy: focal.y,
    scale: heroScale * 0.85,
    rotation: 0,
    opacity: 0.42,
    colors,
    strokeWidth,
    seed,
    safeZone,
  });

  const capsule = renderCapsuleCode(
    { cx: focal.x, cy: focal.y + heroScale * 0.42, scale: heroScale * 0.3, rotation: 0, opacity: 0.55, colors, strokeWidth, seed, safeZone },
    capsuleText(seed),
  );

  const editorialRules = renderVerticalRules({
    cx: focal.x,
    cy: focal.y,
    scale: heroScale,
    rotation: 0,
    opacity: 0.34,
    colors,
    strokeWidth,
    seed,
    safeZone,
  });

  const editorialLayer = group(
    "premium-editorial-layer",
    [
      group("premium-ornament-coordinates", coordMarks),
      group("premium-ornament-capsule", capsule),
      group("premium-ornament-rules", editorialRules),
      group(
        "premium-ornament-back-rule",
        line(
          safeZone.x + safeZone.width * 0.07,
          safeZone.y + safeZone.height * 0.14,
          safeZone.x + safeZone.width * 0.93,
          safeZone.y + safeZone.height * 0.14,
          { stroke: colors.secondary, "stroke-width": strokeWidth * 0.26, opacity: 0.16, "stroke-linecap": "round" },
        ),
      ),
    ].join(""),
  );

  const microParts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const x = snap(safeZone.x + safeZone.width * range(seed, 300 + i, 0.1 + i * 0.03, 0.2 + i * 0.04));
    const y = snap(safeZone.y + safeZone.height * range(seed, 310 + i, 0.15 + i * 0.05, 0.3 + i * 0.06));
  microParts.push(
      group(
        `premium-micro-${i}`,
        i % 3 === 0
          ? circle(x, y, strokeWidth * 0.45, { fill: colors.accent, opacity: 0.28 + range(seed, 320 + i, 0, 0.15) })
          : line(x - heroScale * 0.03, y, x + heroScale * 0.03, y, {
              stroke: colors.accent,
              "stroke-width": strokeWidth * 0.35,
              opacity: 0.32,
              "stroke-linecap": "round",
            }),
      ),
    );
  }

  const microLayer = group("premium-micro-layer", microParts.join(""));

  return {
    ornamentLayer: group("premium-ornament-layer", ornamentGroups.join("")),
    editorialLayer,
    microLayer,
    groupCount: ornamentGroups.length + 2,
  };
}
