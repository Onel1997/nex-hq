import "server-only";
import {
  isSafePrivateSvg,
  rasterizePrivateSvgCore,
  type PrivateSvgRasterOptions,
} from "@/lib/xeriano/svg-raster-core";

export { isSafePrivateSvg };
export type { PrivateSvgRasterOptions };

export async function rasterizePrivateSvg(
  bytes: Buffer,
  options: PrivateSvgRasterOptions = {},
): Promise<Buffer> {
  return rasterizePrivateSvgCore(bytes, options);
}
