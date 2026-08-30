import type { GarmentSegmentationProvider } from "@/lib/image/garment-segmentation/types";
import { FalSam3GarmentSegmentationProvider } from "@/lib/image/garment-segmentation/fal-sam3-adapter";
import { Sam3HttpGarmentSegmentationProvider } from "@/lib/image/garment-segmentation/sam3-http-adapter";

/**
 * fal is the default hosted provider. The previous private HTTP adapter stays
 * available as an explicit compatibility option and is never selected merely
 * because browser input suggests an endpoint.
 */
export function createGarmentSegmentationProviderFromEnvironment(): GarmentSegmentationProvider {
  const selected = process.env.NEXHQ_SAM3_PROVIDER?.trim().toLowerCase();
  if (selected === "generic-http") {
    return new Sam3HttpGarmentSegmentationProvider();
  }
  if (selected && selected !== "fal") {
    throw new Error(
      "NEXHQ_SAM3_PROVIDER must be either fal or generic-http.",
    );
  }

  // Backward compatibility: an existing complete generic endpoint remains
  // usable when fal was not selected/configured explicitly.
  if (
    !selected &&
    !process.env.FAL_KEY?.trim() &&
    process.env.NEXHQ_SAM3_SEGMENTATION_ENDPOINT?.trim() &&
    process.env.NEXHQ_SAM3_SEGMENTATION_API_KEY?.trim()
  ) {
    return new Sam3HttpGarmentSegmentationProvider();
  }
  return new FalSam3GarmentSegmentationProvider();
}
