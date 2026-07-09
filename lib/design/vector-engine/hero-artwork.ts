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

function renderBrokenCircleMark(
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  sw: number,
  opacity: number,
  rotation: number,
): string {
  const gap = 28;
  const seg = (start: number, sweep: number) => {
    const s = rotatePoint(cx + r, cy, cx, cy, start);
    const e = rotatePoint(cx + r, cy, cx, cy, start + sweep);
    return `M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(e.x)} ${fmt(e.y)}`;
  };
  const attrs = { fill: "none", stroke, "stroke-width": sw, opacity, "stroke-linecap": "round" };
  return [
    path(seg(rotation, 85), attrs),
    path(seg(rotation + 120 + gap, 85), attrs),
    path(seg(rotation + 240 + gap, 85), { ...attrs, "stroke-width": sw * 0.7, opacity: opacity * 0.7 }),
  ].join("");
}

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

function renderArchitecturalFrame(
  cx: number,
  cy: number,
  span: number,
  stroke: string,
  sw: number,
  opacity: number,
): string {
  const w = span * 0.55;
  const h = span * 0.68;
  const inset = sw * 2.5;
  return [
    rect(cx - w / 2, cy - h / 2, w, h, { fill: "none", stroke, "stroke-width": sw, opacity: opacity * 0.7 }),
    rect(cx - w / 2 + inset, cy - h / 2 + inset, w - inset * 2, h - inset * 2, {
      fill: "none",
      stroke,
      "stroke-width": sw * 0.55,
      opacity: opacity * 0.4,
    }),
  ].join("");
}

function renderMicroLines(
  cx: number,
  cy: number,
  span: number,
  stroke: string,
  sw: number,
  seed: number,
  count: number,
): string {
  const widths = [0.42, 0.28, 0.55, 0.18, 0.36, 0.24];
  const lines: string[] = [];
  const startY = cy + span * 0.08;

  widths.slice(0, count).forEach((ratio, i) => {
    const w = span * ratio;
    const y = startY + i * (sw * 3.2);
    const op = 0.28 + range(seed, i + 90, 0, 0.22);
    lines.push(
      line(cx - w / 2, y, cx + w / 2, y, {
        stroke,
        "stroke-width": sw * (i === 1 ? 0.35 : 0.5),
        opacity: op,
        "stroke-linecap": "round",
      }),
    );
  });

  return lines.join("");
}

function renderCoordinateMarks(
  safeZone: { x: number; y: number; width: number; height: number },
  stroke: string,
  sw: number,
  seed: number,
  count: number,
): string {
  const inset = safeZone.width * 0.06;
  const arm = sw * 2.2;
  const anchors = [
    { x: safeZone.x + inset, y: safeZone.y + inset },
    { x: safeZone.x + safeZone.width - inset, y: safeZone.y + inset },
    { x: safeZone.x + inset, y: safeZone.y + safeZone.height - inset },
    { x: safeZone.x + safeZone.width - inset, y: safeZone.y + safeZone.height - inset },
  ].slice(0, count);

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

function renderMicroAccent(
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

export function renderHeroArtwork(spec: DesignSpec, colors: ColorScheme): HeroArtwork {
  const { safeZone, seed, composition, primaryShape, compositionCandidate } = spec;
  const geo = compositionCandidate.geometrySystem;
  const details = compositionCandidate.detailSystem;
  const sw =
    composition === "minimal" || compositionCandidate.printScale === "micro"
      ? DESIGN_TOKENS.stroke.hairline
      : composition.includes("oversized") || compositionCandidate.printScale === "oversized"
        ? DESIGN_TOKENS.stroke.medium
        : primaryShape.strokeWidth || DESIGN_TOKENS.stroke.thin;

  const cx = primaryShape.cx;
  const cy = primaryShape.cy;
  const heroScale = primaryShape.scale;
  const r = heroScale * 0.42;
  const rotation = range(seed, 7, -4, 4);

  const primary = colors.primary;
  const inkSecondary = colors.secondary;
  const accent = colors.accent;

  const baseParts: string[] = [];

  if (geo.includeOuterFrame) {
    baseParts.push(
      group(
        "hero-outer-frame",
        circle(cx, cy, r * 1.06, {
          fill: "none",
          stroke: inkSecondary,
          "stroke-width": sw * 0.3,
          opacity: 0.22,
          "stroke-dasharray": "2 5",
        }),
      ),
    );
  }

  if (geo.includeDualArcs) {
    baseParts.push(
      group("hero-dual-arcs", renderDualInterruptedArcs(cx, cy, r, primary, sw, 0.92, rotation)),
    );
  }

  if (geo.includeBrokenCircle) {
    baseParts.push(
      group("hero-broken-circle", renderBrokenCircleMark(cx, cy, r * 0.95, primary, sw, 0.9, rotation)),
    );
  }

  if (geo.includeMissingCenter) {
    baseParts.push(group("hero-missing-center", renderMissingCenter(cx, cy, r, primary, sw, 0.88)));
  }

  if (geo.primaryKind === "frame") {
    baseParts.push(
      group("hero-architectural-frame", renderArchitecturalFrame(cx, cy, heroScale, inkSecondary, sw, 0.75)),
    );
  }

  if (!geo.includeDualArcs && !geo.includeBrokenCircle && geo.primaryKind !== "frame") {
    baseParts.push(
      group(
        "hero-primary-mark",
        circle(cx, cy, r, {
          fill: "none",
          stroke: primary,
          "stroke-width": sw,
          opacity: 0.85,
        }),
      ),
    );
  }

  const base = group("mark-hero", baseParts.join(""));

  const secondaryParts: string[] = [];

  if (details.includeFlankLines) {
    secondaryParts.push(
      group(
        "hero-flank-lines",
        [
          line(cx - r * 1.2, cy, cx - r * 0.62, cy, { stroke: inkSecondary, "stroke-width": sw * 0.35, opacity: 0.3, "stroke-linecap": "round" }),
          line(cx + r * 0.62, cy, cx + r * 1.2, cy, { stroke: inkSecondary, "stroke-width": sw * 0.35, opacity: 0.3, "stroke-linecap": "round" }),
        ].join(""),
      ),
    );
  }

  if (details.includeMicroLines) {
    secondaryParts.push(
      group(
        "hero-micro-lines",
        renderMicroLines(cx, cy + r * 0.55, heroScale, inkSecondary, sw, seed, details.microDetailCount - 2),
      ),
    );
  }

  const accentCount = Math.min(details.microDetailCount, spec.secondaryShapes.length + 2);
  for (let i = 0; i < accentCount; i++) {
    secondaryParts.push(
      group(
        `hero-accent-${i}`,
        renderMicroAccent(
          cx,
          cy + r * 0.35,
          heroScale,
          accent,
          sw,
          0.45 + range(seed, i + 50, 0, 0.25),
          i,
        ),
      ),
    );
  }

  const secondaryLayer = group("hero-secondary", secondaryParts.join(""));

  const decorativeParts: string[] = [];

  if (details.includeCoordinateMarks) {
    decorativeParts.push(
      group(
        "hero-coordinate-marks",
        renderCoordinateMarks(safeZone, inkSecondary, sw, seed, Math.min(4, details.microDetailCount)),
      ),
    );
  }

  const roman = toRomanNumeral(seed);

  if (details.includeCapsuleCode) {
    const editionCode = `${roman} · ${String(2020 + (seed % 6)).slice(-2)}`;
    decorativeParts.push(
      group(
        "hero-capsule-code",
        renderCapsuleCode(cx, cy + r * 0.68, editionCode, inkSecondary, colors.ink, sw),
      ),
    );
  }

  if (details.includeSideRoman) {
    decorativeParts.push(
      group(
        "hero-roman-mark",
        `<text x="${fmt(safeZone.x + safeZone.width * 0.07)}" y="${fmt(safeZone.y + safeZone.height * 0.1)}" fill="${inkSecondary}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="8" font-weight="400" letter-spacing="3.2" opacity="0.4">${escapeXml(roman)}</text>`,
      ),
    );
  }

  if (details.includeVerticalRules) {
    decorativeParts.push(
      group(
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
      ),
    );
  }

  const decorative = group("hero-decorative", decorativeParts.join(""));

  return { defs: "", base, secondary: secondaryLayer, decorative };
}
