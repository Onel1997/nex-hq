/** Encode SVG markup as a data URL for canvas preview and download. */
export function svgMarkupToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}
