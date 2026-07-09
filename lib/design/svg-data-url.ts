import { extractGeneratedSvg } from "@/lib/design/generation-response";

/** Encode SVG markup as a data URL for canvas preview and download. */
export function svgMarkupToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export interface GenerateSvgApiResponse {
  ok?: boolean;
  error?: string;
  svg?: string;
  designId?: string;
  timestamp?: string;
  result?: {
    svg?: string;
    content?: string;
    url?: string;
    output?: string;
  };
  output?: string | { svg?: string };
}

/** @deprecated Use extractGeneratedSvg from generation-response.ts */
export function parseGenerateSvgResponse(data: GenerateSvgApiResponse | null | undefined): string {
  return extractGeneratedSvg(data);
}

export { extractGeneratedSvg, extractGeneratedImageUrl, readGenerationPayload } from "@/lib/design/generation-response";
