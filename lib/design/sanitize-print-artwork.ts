/** Detect dark/solid fills used as full-canvas backgrounds in print artwork SVG. */
const DARK_FILL_PATTERN =
  /fill=["'](#(?:000|000000|111|111111|0a0a0a|0f0f0f|141414|1a1a1a|1a1f2e|0f1218)|black|rgb\(\s*0\s*,\s*0\s*,\s*0)/i;

const TRANSPARENT_FILL_PATTERN = /fill=["'](?:none|transparent)["']/i;

export interface SanitizePrintArtworkSvgResult {
  svg: string;
  removedBackground: boolean;
  warnings: string[];
}

export interface PrintArtworkSvgValidation {
  valid: boolean;
  reason?: string;
}

function parseViewBox(svgMarkup: string): { width: number; height: number } | null {
  const viewBox = svgMarkup.match(/viewBox=["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2]!, height: parts[3]! };
    }
  }

  const width = Number(svgMarkup.match(/\bwidth=["'](\d+(?:\.\d+)?)/i)?.[1]);
  const height = Number(svgMarkup.match(/\bheight=["'](\d+(?:\.\d+)?)/i)?.[1]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  return null;
}

function parseNumeric(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isLargeBackgroundRect(tag: string, viewBox: { width: number; height: number } | null): boolean {
  if (TRANSPARENT_FILL_PATTERN.test(tag)) return false;
  if (!/fill=/i.test(tag)) return false;

  const widthMatch = tag.match(/\bwidth=["']([^"']+)["']/i)?.[1];
  const heightMatch = tag.match(/\bheight=["']([^"']+)["']/i)?.[1];

  if (widthMatch === "100%" && heightMatch === "100%") return true;

  if (!viewBox) return DARK_FILL_PATTERN.test(tag);

  const width = parseNumeric(widthMatch, 0);
  const height = parseNumeric(heightMatch, 0);
  const coversWidth = width >= viewBox.width * 0.85;
  const coversHeight = height >= viewBox.height * 0.85;

  if (coversWidth && coversHeight) return true;
  if (coversWidth && coversHeight && DARK_FILL_PATTERN.test(tag)) return true;

  return false;
}

/** Strip full-canvas background rects and poster-style fills from print artwork SVG. */
export function sanitizePrintArtworkSvg(svgMarkup: string): SanitizePrintArtworkSvgResult {
  const warnings: string[] = [];
  let removedBackground = false;
  const viewBox = parseViewBox(svgMarkup);

  let svg = svgMarkup
    .replace(/\sstyle=["'][^"']*background(?:-color)?:[^"']*["']/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  svg = svg.replace(/<rect\b[^>]*\/?>/gi, (tag) => {
    if (isLargeBackgroundRect(tag, viewBox)) {
      removedBackground = true;
      warnings.push("Removed large background rectangle from artwork SVG");
      return "";
    }
    return tag;
  });

  return { svg: svg.trim(), removedBackground, warnings };
}

export function validatePrintArtworkSvg(svgMarkup: string): PrintArtworkSvgValidation {
  const viewBox = parseViewBox(svgMarkup);
  const rects = svgMarkup.match(/<rect\b[^>]*\/?>/gi) ?? [];

  for (const tag of rects) {
    if (isLargeBackgroundRect(tag, viewBox)) {
      return {
        valid: false,
        reason: "Artwork contains background — regenerate transparent artwork.",
      };
    }
  }

  if (/\bbackground(?:-color)?\s*:\s*(?:#(?:000|111|0a0a0a|1a1f2e)|black)/i.test(svgMarkup)) {
    return {
      valid: false,
      reason: "Artwork contains background — regenerate transparent artwork.",
    };
  }

  return { valid: true };
}

export const TRANSPARENT_ARTWORK_BACKGROUND_WARNING =
  "Artwork contains background — regenerate transparent artwork.";
