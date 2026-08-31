import { loadImage } from "canvas";

export async function readRasterDimensions(bytes: Buffer): Promise<{ width: number; height: number }> {
  const image = await loadImage(bytes);
  const width = Math.round(image.width);
  const height = Math.round(image.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("RASTER_DIMENSIONS_INVALID");
  }
  return { width, height };
}
