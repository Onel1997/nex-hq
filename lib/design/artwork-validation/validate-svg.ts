import type { ArtworkFileMetadata, ArtworkValidationIssue } from "./types";

const MAX_CANVAS_DIMENSION = 10_000;
const MIN_FILE_BYTES = 500;

function parseViewBox(svg: Element): { width: number; height: number } | null {
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) return null;
  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { width: parts[2], height: parts[3] };
}

function parseNumericAttr(el: Element, attr: string): number | null {
  const raw = el.getAttribute(attr);
  if (!raw) return null;
  const value = parseFloat(raw.replace(/px|pt|mm|cm|in/gi, ""));
  return Number.isFinite(value) ? value : null;
}

function resolveSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = parseViewBox(svg);
  const attrW = parseNumericAttr(svg, "width");
  const attrH = parseNumericAttr(svg, "height");

  if (viewBox) return viewBox;
  if (attrW && attrH) return { width: attrW, height: attrH };
  return { width: 0, height: 0 };
}

function hasFullBackgroundRect(svg: SVGSVGElement, vbW: number, vbH: number): boolean {
  if (vbW <= 0 || vbH <= 0) return false;

  const rects = svg.querySelectorAll("rect");
  for (const rect of rects) {
    const x = parseFloat(rect.getAttribute("x") || "0");
    const y = parseFloat(rect.getAttribute("y") || "0");
    const w = parseFloat(rect.getAttribute("width") || "0");
    const h = parseFloat(rect.getAttribute("height") || "0");
    const fill = (rect.getAttribute("fill") || "").toLowerCase();
    const coversFull = x <= 1 && y <= 1 && w >= vbW * 0.98 && h >= vbH * 0.98;
    if (coversFull && fill && fill !== "none" && fill !== "transparent") {
      return true;
    }
  }
  return false;
}

function hasRasterEmbed(svg: SVGSVGElement): boolean {
  if (svg.querySelector("image")) return true;
  const html = svg.outerHTML;
  return /data:image\//i.test(html) || /<image[\s>]/i.test(html);
}

function formatAspectRatio(width: number, height: number): string {
  if (height <= 0) return "—";
  return `${(width / height).toFixed(2)}:1`;
}

export async function validateSvgFile(
  file: File,
  uploadedAt: string,
): Promise<{ metadata: ArtworkFileMetadata; issues: ArtworkValidationIssue[]; svgMarkup: string }> {
  const issues: ArtworkValidationIssue[] = [];
  let markup: string;

  try {
    markup = await file.text();
  } catch {
    throw new Error("Could not read SVG file.");
  }

  if (file.size < MIN_FILE_BYTES && markup.trim().length < 50) {
    issues.push({
      code: "file-too-small",
      message: "SVG file is unusually small.",
      severity: "warning",
    });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid SVG XML — file could not be parsed.");
  }

  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") {
    throw new Error("File does not contain a valid SVG root element.");
  }

  const { width, height } = resolveSvgDimensions(svg as unknown as SVGSVGElement);
  const hasViewBox = Boolean(svg.getAttribute("viewBox"));

  if (!hasViewBox) {
    issues.push({
      code: "missing-viewbox",
      message: "SVG is missing a viewBox — scaling may be unreliable.",
      severity: "warning",
    });
  }

  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    issues.push({
      code: "large-canvas",
      message: `Canvas dimensions (${Math.round(width)}×${Math.round(height)}) are extremely large.`,
      severity: "warning",
    });
  }

  if (hasFullBackgroundRect(svg as unknown as SVGSVGElement, width, height)) {
    issues.push({
      code: "background-rect",
      message: "Full-size background rectangle detected — artwork may not be transparent.",
      severity: "warning",
    });
  }

  if (hasRasterEmbed(svg as unknown as SVGSVGElement)) {
    issues.push({
      code: "raster-embed",
      message: "Embedded raster image detected — vector scalability may be limited.",
      severity: "warning",
    });
  }

  const metadata: ArtworkFileMetadata = {
    fileName: file.name,
    fileKind: "svg",
    mimeType: file.type || "image/svg+xml",
    fileSize: file.size,
    uploadedAt,
    previewSupported: true,
    width: width > 0 ? Math.round(width) : undefined,
    height: height > 0 ? Math.round(height) : undefined,
    dimensionsLabel:
      width > 0 && height > 0 ? `${Math.round(width)} × ${Math.round(height)}` : "Vector (scalable)",
    aspectRatio: width > 0 && height > 0 ? width / height : undefined,
    aspectRatioLabel: width > 0 && height > 0 ? formatAspectRatio(width, height) : "Scalable",
    hasTransparency: !hasFullBackgroundRect(svg as unknown as SVGSVGElement, width, height),
    estimatedDpi: undefined,
    printSizeAt300Dpi: "Scalable vector",
  };

  return { metadata, issues, svgMarkup: markup };
}
