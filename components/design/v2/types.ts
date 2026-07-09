export const ACCEPTED_ARTWORK_TYPES = [
  "image/svg+xml",
  "image/png",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
  "image/x-eps",
  ".svg",
  ".png",
  ".pdf",
  ".ai",
  ".eps",
] as const;

export const ACCEPTED_ARTWORK_EXTENSIONS = ["SVG", "PNG", "PDF", "AI", "EPS"] as const;

export type ArtworkWorkflowStep =
  | "upload"
  | "analysis"
  | "commercial-review"
  | "approve"
  | "image-studio";

export const ARTWORK_WORKFLOW_STEPS: Array<{
  id: ArtworkWorkflowStep;
  label: string;
}> = [
  { id: "upload", label: "Upload" },
  { id: "analysis", label: "Analysis" },
  { id: "commercial-review", label: "Commercial Review" },
  { id: "approve", label: "Approve" },
  { id: "image-studio", label: "Image Studio" },
];

export type SidebarSectionId =
  | "master-artwork"
  | "versions"
  | "collections"
  | "brand-library"
  | "history"
  | "recent-uploads";

import type { ArtworkFileKind } from "@/lib/design/artwork-validation";

export interface LocalArtworkUpload {
  file: File;
  objectUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  isPreviewable: boolean;
  fileKind: ArtworkFileKind;
}

export interface ArtworkPreviewSource {
  imageUrl?: string;
  svgMarkup?: string;
  fileName?: string;
  mimeType?: string;
  source: "upload" | "mission";
}
