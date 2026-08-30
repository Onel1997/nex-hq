import type { ImageStudioAsset } from "@/agents/image/types";
import { CONTENT_SHOTS } from "@/lib/image/content-packs";

/**
 * Static, provider-free shot cards used while the durable report is staged.
 * IDs are exactly the canonical shot IDs. Once the report arrives, its assets
 * replace these planning views before Prepare can succeed.
 */
export function immediateContentPlanningAssets(): ImageStudioAsset[] {
  return CONTENT_SHOTS.map((shot) => ({
    id: shot.id,
    assetType: shot.assetType,
    outputCategory: shot.outputCategory,
    productName: "Ausgewähltes Produkt",
    collection: "Aktuelle Kollektion",
    color: "Ausgewählte Farbe",
    material: "Verifiziertes Produktmaterial",
    location: shot.location,
    lighting: shot.lighting,
    photographyStyle: shot.photographyStyle,
    cameraStyle: shot.cameraStyle,
    prompt: {
      openai: "Wird beim serverseitigen Produktionsplan autoritativ gebunden.",
      midjourney: "Wird beim serverseitigen Produktionsplan autoritativ gebunden.",
      flux: "Wird beim serverseitigen Produktionsplan autoritativ gebunden.",
    },
    priority:
      shot.id === "content:campaign-hero" ||
      shot.id === "content:social-hero-story"
        ? "hero"
        : "core",
    status: "pending",
    title: shot.label,
    platform: shot.intents.join(","),
    dimensions: shot.aspectIntents.join(" / "),
  }));
}
