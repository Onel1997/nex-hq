export type CreativeModelAvailability = "LIVE" | "READY_TO_CONNECT" | "PLANNED";

export type CreativeModelDefinition = {
  id: string;
  providerId: string;
  name: string;
  description: string;
  character: string;
  badge: string | null;
  accent: "VIOLET" | "BLUE" | "AMBER" | "ROSE" | "MINT" | "LIME";
  availability: CreativeModelAvailability;
  supportsReferences: boolean;
  maximumReferences: number;
  supportedQualities: readonly ("1K" | "2K" | "4K")[];
  supportedAspectRatios: readonly (
    | "AUTO"
    | "1:1"
    | "3:4"
    | "4:3"
    | "2:3"
    | "3:2"
    | "9:16"
    | "16:9"
    | "5:4"
    | "4:5"
    | "21:9"
  )[];
  providerModelId: string | null;
};

const ALL_CREATIVE_ASPECT_RATIOS = [
  "AUTO",
  "1:1",
  "3:4",
  "4:3",
  "2:3",
  "3:2",
  "9:16",
  "16:9",
  "5:4",
  "4:5",
  "21:9",
] as const;

export const CREATIVE_MODEL_REGISTRY: readonly CreativeModelDefinition[] =
  Object.freeze([
    {
      id: "gpt-image",
      providerId: "openai",
      name: "GPT Image",
      description: "Starke Prompt-Treue und flexible Bildbearbeitung.",
      character: "Vielseitig",
      badge: "Vorbereitet",
      accent: "VIOLET",
      availability: "READY_TO_CONNECT",
      supportsReferences: true,
      maximumReferences: 14,
      supportedQualities: ["1K", "2K"],
      supportedAspectRatios: ALL_CREATIVE_ASPECT_RATIOS,
      providerModelId: null,
    },
    {
      id: "higgsfield-soul",
      providerId: "higgsfield",
      name: "Higgsfield Soul",
      description: "Mode, Charakter und moderne Social-Ästhetik.",
      character: "Mode",
      badge: "Demnächst",
      accent: "ROSE",
      availability: "PLANNED",
      supportsReferences: true,
      maximumReferences: 8,
      supportedQualities: ["1K", "2K"],
      supportedAspectRatios: ALL_CREATIVE_ASPECT_RATIOS,
      providerModelId: null,
    },
    {
      id: "higgsfield-soul-cinema",
      providerId: "higgsfield",
      name: "Higgsfield Soul Cinema",
      description: "Filmische Szenen mit starkem Licht und Tiefe.",
      character: "Filmisch",
      badge: "Demnächst",
      accent: "AMBER",
      availability: "PLANNED",
      supportsReferences: true,
      maximumReferences: 8,
      supportedQualities: ["1K", "2K", "4K"],
      supportedAspectRatios: ALL_CREATIVE_ASPECT_RATIOS,
      providerModelId: null,
    },
    {
      id: "seedream",
      providerId: "bytedance",
      name: "Seedream",
      description: "Detailreiche Kampagnen- und Produktbilder.",
      character: "Detailreich",
      badge: null,
      accent: "BLUE",
      availability: "PLANNED",
      supportsReferences: true,
      maximumReferences: 10,
      supportedQualities: ["1K", "2K", "4K"],
      supportedAspectRatios: ALL_CREATIVE_ASPECT_RATIOS,
      providerModelId: null,
    },
    {
      id: "recraft",
      providerId: "recraft",
      name: "Recraft",
      description: "Kontrollierte Markenbilder und Design-Assets.",
      character: "Marke",
      badge: null,
      accent: "MINT",
      availability: "PLANNED",
      supportsReferences: true,
      maximumReferences: 6,
      supportedQualities: ["1K", "2K", "4K"],
      supportedAspectRatios: ALL_CREATIVE_ASPECT_RATIOS,
      providerModelId: null,
    },
    {
      id: "nano-banana-pro",
      providerId: "fal",
      name: "Nano Banana Pro",
      description: "Starke Multi-Referenz-Bilder mit hoher Prompt- und Motivtreue.",
      character: "Referenzstark",
      badge: "Verbunden",
      accent: "LIME",
      availability: "LIVE",
      supportsReferences: true,
      maximumReferences: 14,
      supportedQualities: ["1K", "2K", "4K"],
      supportedAspectRatios: ALL_CREATIVE_ASPECT_RATIOS,
      providerModelId: "fal-ai/nano-banana-pro/edit",
    },
  ]);

export const DEFAULT_CREATIVE_MODEL_ID = "nano-banana-pro";

export function creativeModelById(
  modelId: string,
): CreativeModelDefinition | null {
  if (modelId === "nano-banana") {
    return (
      CREATIVE_MODEL_REGISTRY.find((model) => model.id === "nano-banana-pro") ??
      null
    );
  }
  return CREATIVE_MODEL_REGISTRY.find((model) => model.id === modelId) ?? null;
}

export function creativeModelAvailabilityLabel(
  availability: CreativeModelAvailability,
): string {
  if (availability === "LIVE") return "Live";
  if (availability === "READY_TO_CONNECT") return "Verbindung vorbereitet";
  return "Geplant";
}
