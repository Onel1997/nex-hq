function parseViewBoxParts(svgMarkup: string): [number, number, number, number] | null {
  const viewBox = svgMarkup.match(/viewBox=["']([^"']+)["']/i)?.[1];
  if (!viewBox) return null;

  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
}

function normalizeViewBox(svgMarkup: string): string {
  const parts = parseViewBoxParts(svgMarkup);
  if (!parts) return svgMarkup;

  const [minX, minY, width, height] = parts;
  if (width <= 0 || height <= 0) return svgMarkup;

  if (minX === 0 && minY === 0) return svgMarkup;

  const normalizedViewBox = `0 0 ${width} ${height}`;
  const translateWrapper = `<g transform="translate(${-minX}, ${-minY})">`;
  const closingIndex = svgMarkup.lastIndexOf("</svg>");
  if (closingIndex === -1) return svgMarkup;

  const openTag = svgMarkup.match(/<svg\b[^>]*>/i)?.[0] ?? "<svg>";
  const inner = svgMarkup.slice(openTag.length, closingIndex);

  return svgMarkup.replace(
    /<svg\b[^>]*>[\s\S]*<\/svg>/i,
    `${openTag.replace(/viewBox=["'][^"']*["']/i, `viewBox="${normalizedViewBox}"`)}${translateWrapper}${inner}</g></svg>`,
  );
}

/**
 * Normalize vector SVG for in-canvas preview only.
 * Strips print mm dimensions so the browser does not anchor oversized artwork top-left.
 */
export function prepareMasterArtworkPreviewSvg(svgMarkup: string): string {
  const normalized = normalizeViewBox(svgMarkup);

  return normalized.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const cleaned = attrs
      .replace(/\s(width|height)=["'][^"']*["']/gi, "")
      .replace(/\sstyle=["'][^"']*["']/gi, "")
      .replace(/\spreserveAspectRatio=["'][^"']*["']/gi, "");

    return `<svg${cleaned} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
  });
}
