/** Luxury streetwear design tokens — spacing, rhythm, stroke, type scale. */
export const DESIGN_TOKENS = {
  /** Units per centimeter on artboard */
  cm: 36,

  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 20,
    lg: 32,
    xl: 48,
    xxl: 64,
  },

  margins: {
    print: 0.12,
    safe: 0.08,
    micro: 0.04,
  },

  grid: {
    columns: 12,
    gutter: 8,
    baseline: 4,
  },

  typography: {
    headline: { size: 28, tracking: 0.22, weight: 500, lineHeight: 1.05 },
    subHeadline: { size: 11, tracking: 0.38, weight: 400, lineHeight: 1.2 },
    caption: { size: 7.5, tracking: 0.42, weight: 400, lineHeight: 1.35 },
    coordinates: { size: 6.5, tracking: 0.5, weight: 400, lineHeight: 1.4 },
    romanNumeral: { size: 9, tracking: 0.3, weight: 400, lineHeight: 1.1 },
    quote: { size: 8, tracking: 0.28, weight: 300, lineHeight: 1.45 },
    minimalLabel: { size: 6, tracking: 0.55, weight: 400, lineHeight: 1.3 },
    vertical: { size: 7, tracking: 0.48, weight: 400, lineHeight: 1.2 },
  },

  stroke: {
    hairline: 0.35,
    thin: 0.6,
    regular: 1,
    medium: 1.5,
    bold: 2.25,
  },

  radius: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 8,
    pill: 999,
  },

  rhythm: {
    golden: 1.618,
    compact: 0.75,
    editorial: 1.35,
  },

  fonts: {
    sans: "Helvetica Neue, Helvetica, Arial, sans-serif",
    display: "Arial Narrow, Helvetica Neue, Helvetica, Arial, sans-serif",
  },
} as const;

export function snap(value: number, grid = DESIGN_TOKENS.grid.baseline): number {
  return Math.round(value / grid) * grid;
}

export function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}
