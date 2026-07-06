import type { ArtworkFileKind } from "./types";

const EXT_TO_KIND: Record<string, ArtworkFileKind> = {
  png: "png",
  svg: "svg",
  pdf: "pdf",
  ai: "ai",
  eps: "eps",
};

const MIME_TO_KIND: Record<string, ArtworkFileKind> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/postscript": "eps",
  "application/illustrator": "ai",
  "image/x-eps": "eps",
  "application/eps": "eps",
};

export function resolveArtworkFileKind(file: File): ArtworkFileKind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext && EXT_TO_KIND[ext]) return EXT_TO_KIND[ext];
  if (file.type && MIME_TO_KIND[file.type]) return MIME_TO_KIND[file.type];
  return "unknown";
}

export function isAcceptedArtworkFile(file: File): boolean {
  return resolveArtworkFileKind(file) !== "unknown";
}

export function isPreviewableArtworkKind(kind: ArtworkFileKind): boolean {
  return kind === "png" || kind === "svg";
}

export function formatFileKindLabel(kind: ArtworkFileKind): string {
  if (kind === "unknown") return "Unknown";
  return kind.toUpperCase();
}
