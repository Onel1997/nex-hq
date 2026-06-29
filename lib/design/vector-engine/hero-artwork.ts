import { range } from "@/lib/design/vector-engine/hash";
import type { ColorScheme, DesignSpec, Point } from "@/lib/design/vector-engine/types";
import { DESIGN_TOKENS, fmt, snap } from "@/lib/design/vector-engine/tokens";
import { toRomanNumeral } from "@/lib/design/vector-engine/typography";
import { circle, escapeXml, group, line, path, rect } from "@/lib/design/vector-engine/xml";

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function arcSegment(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = rotatePoint(cx + r, cy, cx, cy, startDeg);
  const end = rotatePoint(cx + r, cy, cx, cy, endDeg);
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  return `M ${fmt(start.x)} ${fmt(start.y)} A ${fmt(r)} ${fmt(r)} 0 ${large} 1 ${fmt(end.x)} ${fmt(end.y)}`;
}

/** Twin interrupted arcs — signature premium mark with east/west gaps. */
function renderDualInterruptedArcs(
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  sw: number,
  opacity: number,
  rotation: number,
): string {
  const gap = 34;
  const upper = arcSegment(cx, cy, r, rotation - 145 + gap / 2, rotation - 35 - gap / 2);
  const lower = arcSegment(cx, cy, r, rotation + 35 + gap / 2, rotation + 145 - gap / 2);
  const innerR = r * 0.72;
  const innerUpper = arcSegment(cx, cy, innerR, rotation - 140 + gap / 2, rotation - 40 - gap / 2);
  const innerLower = arcSegment(cx, cy, innerR, rotation + 40 + gap / 2, rotation + 140 - gap / 2);

  const strokeAttrs = {
    fill: "none",
    stroke,
    "stroke-width": sw,
    opacity,
    "stroke-linecap": "round",
  };

  return [
    path(upper, strokeAttrs),
    path(lower, strokeAttrs),
    path(innerUpper, { ...strokeAttrs, "stroke-width": sw * 0.55, opacity: opacity * 0.55 }),
    path(innerLower, { ...strokeAttrs, "stroke-width": sw * 0.55, opacity: opacity * 0.55 }),
  ].join("");
}

/** Missing-center void — inward corner brackets + hollow inner ring. */
function renderMissingCenter(
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  sw: number,
  opacity: number,
): string {
  const voidR = r * 0.2;
  const bracket = r * 0.14;
  const arm = bracket * 0.55;
  const parts: string[] = [];

  parts.push(
    circle(cx, cy, voidR, {
      fill: "none",
      stroke,
      "stroke-width": sw * 0.45,
      opacity: opacity * 0.65,
    }),
  );

  const corners: Array<[number, number, number, number]> = [
    [cx - bracket, cy - bracket, arm, 0],
    [cx + bracket - arm, cy - bracket, arm, 0],
    [cx - bracket, cy + bracket, 0, -arm],
    [cx + bracket - arm, cy + bracket, 0, -arm],
  ];
  for (const [x, y, dx, dy] of corners) {
    parts.push(
      line(x, y, x + dx, y, { stroke, "stroke-width": sw * 0.5, opacity: opacity * 0.7, "stroke-linecap": "round" }),
      line(x, y, x, y + dy, { stroke, "stroke-width": sw * 0.5, opacity: opacity * 0.7, "stroke-linecap": "round" }),
    );
  }

  const tick = r * 0.08;
  for (const deg of [0, 90, 180, 270]) {
    const p1 = rotatePoint(cx, cy - voidR - tick, cx, cy, deg);
    const p2 = rotatePoint(cx, cy - voidR + tick * 0.3, cx, cy, deg);
    parts.push(line(p1.x, p1.y, p2.x, p2.y, { stroke, "stroke-width": sw * 0.35, opacity: opacity * 0.5, "stroke-linecap": "round" }));
  }

  return parts.join("");
}

/** Hairline micro-lines beneath the hero mark. */
function renderMicroLines(
  cx: number,
  cy: number,
  span: number,
  stroke: string,
  sw: number,
  seed: number,
): string {
  const widths = [0.42, 0.28, 0.55, 0.18];
  const lines: string[] = [];
  const startY = cy + span * 0.08;

  widths.forEach((ratio, i) => {
    const w = span * ratio;
    const y = startY + i * (sw * 3.2);
    const x1 = cx - w / 2;
    const x2 = cx + w / 2;
    const op = 0.28 + range(seed, i + 90, 0, 0.22);
    lines.push(
      line(x1, y, x2, y, {
        stroke,
        "stroke-width": sw * (i === 1 ? 0.35 : 0.5),
        opacity: op,
        "stroke-linecap": "round",
      }),
    );
  });

  return lines.join("");
}

/** Tiny geometric coordinate marks — crosses, not text labels. */
function renderCoordinateMarks(
  safeZone: { x: number; y: number; width: number; height: number },
  stroke: string,
  sw: number,
  seed: number,
): string {
  const inset = safeZone.width * 0.06;
  const arm = sw * 2.2;
  const anchors = [
    { x: safeZone.x + inset, y: safeZone.y + inset },
    { x: safeZone.x + safeZone.width - inset, y: safeZone.y + inset },
    { x: safeZone.x + inset, y: safeZone.y + safeZone.height - inset },
    { x: safeZone.x + safeZone.width - inset, y: safeZone.y + safeZone.height - inset },
  ].slice(0, 2 + (seed % 3));

  return anchors
    .map((p, i) => {
      const op = 0.32 + range(seed, i + 200, 0, 0.18);
      return [
        line(p.x - arm, p.y, p.x + arm, p.y, { stroke, "stroke-width": sw * 0.4, opacity: op, "stroke-linecap": "round" }),
        line(p.x, p.y - arm, p.x, p.y + arm, { stroke, "stroke-width": sw * 0.4, opacity: op, "stroke-linecap": "round" }),
        circle(p.x, p.y, sw * 0.35, { fill: stroke, opacity: op * 0.8 }),
      ].join("");
    })
    .join("");
}

/** Capsule code pill — roman numeral + edition code. */
function renderCapsuleCode(
  cx: number,
  cy: number,
  text: string,
  stroke: string,
  fill: string,
  sw: number,
): string {
  const padX = 14;
  const padY = 5;
  const charW = 5.2;
  const w = text.length * charW + padX * 2;
  const h = 11 + padY * 2;
  const x = cx - w / 2;
  const y = cy - h / 2;

  return [
    rect(x, y, w, h, {
      fill: "none",
      stroke,
      "stroke-width": sw * 0.45,
      rx: h / 2,
      opacity: 0.55,
    }),
    `<text x="${fmt(cx)}" y="${fmt(cy + 3.5)}" fill="${fill}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="6.5" font-weight="400" letter-spacing="2.8" text-anchor="middle" opacity="0.62">${escapeXml(text)}</text>`,
  ].join("");
}

function renderAccentFromBrief(
  cx: number,
  cy: number,
  size: number,
  stroke: string,
  sw: number,
  opacity: number,
  index: number,
): string {
  const offsetX = (index % 2 === 0 ? -1 : 1) * size * 0.38;
  const offsetY = size * 0.12 * index;
  const x = cx + offsetX;
  const y = cy + offsetY;

  if (index % 3 === 0) {
    const arm = size * 0.06;
    return [
      line(x - arm, y, x + arm, y, { stroke, "stroke-width": sw * 0.45, opacity, "stroke-linecap": "round" }),
      line(x, y - arm, x, y + arm, { stroke, "stroke-width": sw * 0.45, opacity, "stroke-linecap": "round" }),
    ].join("");
  }
  if (index % 3 === 1) {
    return circle(x, y, sw * 0.7, { fill: stroke, opacity: opacity * 0.85 });
  }
  const len = size * 0.1;
  return line(x - len / 2, y, x + len / 2, y, { stroke, "stroke-width": sw * 0.4, opacity, "stroke-linecap": "round" });
}

export interface HeroArtwork {
  defs: string;
  base: string;
  secondary: string;
  decorative: string;
}

/** Premium hero composition — dual arcs, missing center, micro-detail. */
export function renderHeroArtwork(spec: DesignSpec, colors: ColorScheme): HeroArtwork {
  const { focalPoint, safeZone, seed, composition, primaryShape } = spec;
  const sw =
    composition === "minimal"
      ? DESIGN_TOKENS.stroke.hairline
      : composition.includes("oversized")
        ? DESIGN_TOKENS.stroke.medium
        : primaryShape.strokeWidth || DESIGN_TOKENS.stroke.thin;
  const cx = focalPoint.x;
  const cy = snap(focalPoint.y - safeZone.height * 0.04);
  const heroScale = safeZone.width * (composition.includes("oversized") ? 0.62 : 0.56);
  const r = heroScale * 0.42;
  const rotation = range(seed, 7, -4, 4);

  const primary = colors.primary;
  const inkSecondary = colors.secondary;
  const accent = colors.accent;

  const dualArcs = group(
    "hero-dual-arcs",
    renderDualInterruptedArcs(cx, cy, r, primary, sw, 0.92, rotation),
  );

  const missingCenter = group(
    "hero-missing-center",
    renderMissingCenter(cx, cy, r, primary, sw, 0.88),
  );

  const outerFrame = group(
    "hero-outer-frame",
    circle(cx, cy, r * 1.06, {
      fill: "none",
      stroke: inkSecondary,
      "stroke-width": sw * 0.3,
      opacity: 0.22,
      "stroke-dasharray": "2 5",
    }),
  );

  const base = group("mark-hero", [outerFrame, dualArcs, missingCenter].join(""));

  const microLines = group(
    "hero-micro-lines",
    renderMicroLines(cx, cy + r * 0.55, heroScale, inkSecondary, sw, seed),
  );

  const briefAccents = spec.secondaryShapes
    .slice(0, 3)
    .map((_, i) =>
      group(
        `hero-accent-${i}`,
        renderAccentFromBrief(
          cx,
          cy + r * 0.35,
          heroScale,
          accent,
          sw,
          0.45 + range(seed, i + 50, 0, 0.25),
          i,
        ),
      ),
    )
    .join("");

  const flankingLines = group(
    "hero-flank-lines",
    [
      line(cx - r * 1.2, cy, cx - r * 0.62, cy, { stroke: inkSecondary, "stroke-width": sw * 0.35, opacity: 0.3, "stroke-linecap": "round" }),
      line(cx + r * 0.62, cy, cx + r * 1.2, cy, { stroke: inkSecondary, "stroke-width": sw * 0.35, opacity: 0.3, "stroke-linecap": "round" }),
    ].join(""),
  );

  const secondaryLayer = group("hero-secondary", [flankingLines, microLines, briefAccents].join(""));

  const coordMarks = group(
    "hero-coordinate-marks",
    renderCoordinateMarks(safeZone, inkSecondary, sw, seed),
  );

  const roman = toRomanNumeral(seed);
  const editionCode = `${roman} · ${String(2020 + (seed % 6)).slice(-2)}`;
  const capsule = group(
    "hero-capsule-code",
    renderCapsuleCode(
      cx,
      cy + r * 0.68,
      editionCode,
      inkSecondary,
      colors.ink,
      sw,
    ),
  );

  const sideRoman = group(
    "hero-roman-mark",
  `<text x="${fmt(safeZone.x + safeZone.width * 0.07)}" y="${fmt(safeZone.y + safeZone.height * 0.1)}" fill="${inkSecondary}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="8" font-weight="400" letter-spacing="3.2" opacity="0.4">${escapeXml(roman)}</text>`,
  );

  const verticalRules = group(
    "hero-vertical-rules",
    [
      line(safeZone.x + safeZone.width * 0.12, safeZone.y + safeZone.height * 0.18, safeZone.x + safeZone.width * 0.12, safeZone.y + safeZone.height * 0.32, {
        stroke: inkSecondary,
        "stroke-width": sw * 0.3,
        opacity: 0.22,
      }),
      line(safeZone.x + safeZone.width * 0.88, safeZone.y + safeZone.height * 0.68, safeZone.x + safeZone.width * 0.88, safeZone.y + safeZone.height * 0.82, {
        stroke: inkSecondary,
        "stroke-width": sw * 0.3,
        opacity: 0.22,
      }),
    ].join(""),
  );

  const decorative = group(
    "hero-decorative",
    [coordMarks, capsule, sideRoman, verticalRules].join(""),
  );

  return { defs: "", base, secondary: secondaryLayer, decorative };
}
