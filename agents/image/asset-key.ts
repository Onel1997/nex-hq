import type { ImageGenerationProvider } from "./types-generation";

export function buildImageAssetKey(
  section: string,
  assetIndex: number,
  provider: ImageGenerationProvider,
): string {
  return `${section}:${assetIndex}:${provider}`;
}
