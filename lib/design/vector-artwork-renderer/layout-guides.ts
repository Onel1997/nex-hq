import { group, rect } from "@/lib/design/vector-engine/xml";
import type { LayoutSpec } from "@/lib/design/fashion-design-engine/types";
import type { PanelLayout } from "@/lib/design/fashion-design-engine/types";

/**
 * Render optional production layout guides — safe margins and bounding boxes.
 * Hidden from production export when includeLayoutGuides is false.
 */
export function renderLayoutGuides(
  layoutSpec: LayoutSpec,
  panel: PanelLayout,
  artboard: { widthMm: number; heightMm: number },
): string {
  const margin = panel.safeMarginMm;
  const bx = margin;
  const by = margin;
  const bw = artboard.widthMm - margin * 2;
  const bh = artboard.heightMm - margin * 2;

  const safeZone = rect(bx, by, bw, bh, {
    fill: "none",
    stroke: "#52c2c2",
    "stroke-width": "0.25mm",
    "stroke-dasharray": "2 2",
    opacity: 0.35,
  });

  const printArea = rect(
    panel.offsetFromCenterMm + panel.boundingBoxMm.width * 0.1,
    panel.offsetFromCollarMm * 0.5,
    panel.boundingBoxMm.width * 0.8,
    panel.boundingBoxMm.height * 0.85,
    {
      fill: "none",
      stroke: "#d9b46b",
      "stroke-width": "0.25mm",
      "stroke-dasharray": "4 3",
      opacity: 0.3,
    },
  );

  const label = `<text x="${bx + 2}" y="${by + 4}" font-size="2.5mm" fill="#52c2c2" opacity="0.5">SAFE ${margin}mm — ${layoutSpec.printArea}</text>`;

  return group("layout-guides", `${safeZone}${printArea}${label}`, {
    "data-production-guides": "true",
    "aria-hidden": "true",
  });
}
