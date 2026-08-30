import { z } from "zod";

import { contentShotById } from "@/lib/image/content-packs";

export const CREATIVE_DIRECTION_VERSION =
  "social-creative-direction-v1" as const;

export const imageContentModeSchema = z.enum([
  "SOCIAL_CONTENT",
  "SHOPIFY_MOCKUP",
]);
export type ImageContentMode = z.infer<typeof imageContentModeSchema>;

export const creativeSceneTypeSchema = z.enum([
  "STUDIO_CLEAN",
  "STUDIO_EDITORIAL",
  "URBAN_STREET",
  "PARKING_GARAGE",
  "CONCRETE_ARCHITECTURE",
  "STAIRCASE",
  "STADIUM",
  "MINIMAL_INTERIOR",
  "PREMIUM_INTERIOR",
  "SHOWROOM",
  "SPORTS_SETUP",
  "FURNITURE_STYLING",
  "RACK_SETUP",
  "HANGER_SETUP",
  "TABLETOP",
  "FLATLAY",
  "OUTDOOR_CITY",
  "SUNSET_OUTDOOR",
  "CUSTOM",
]);
export type CreativeSceneType = z.infer<typeof creativeSceneTypeSchema>;

export const creativeLocationTypeSchema = z.enum([
  "STUDIO",
  "STREET",
  "PARKING_GARAGE",
  "STADIUM",
  "STAIRCASE",
  "CONCRETE_ARCHITECTURE",
  "SHOWROOM",
  "MODERN_INTERIOR",
  "MINIMAL_ROOM",
  "OUTDOOR_CITY",
  "TABLETOP",
  "NOT_APPLICABLE",
  "CUSTOM",
]);
export type CreativeLocationType = z.infer<typeof creativeLocationTypeSchema>;

export const creativeLightingSchema = z.enum([
  "SOFT_STUDIO",
  "HARD_EDITORIAL",
  "DIRECTED_SIDE_LIGHT",
  "DIFFUSED_DAYLIGHT",
  "WARM_EVENING",
  "COOL_URBAN",
  "HIGH_CONTRAST",
  "CLEAN_ECOMMERCE",
  "CUSTOM",
]);
export type CreativeLighting = z.infer<typeof creativeLightingSchema>;

export const creativeCameraFramingSchema = z.enum([
  "FULL_BODY",
  "PORTRAIT",
  "WAIST_UP",
  "CLOSE_UP",
  "PRODUCT_CLOSE_UP",
  "OVERHEAD",
  "THREE_QUARTER",
  "PRODUCT_FULL_VIEW",
]);
export const creativeCameraAngleSchema = z.enum([
  "EYE_LEVEL",
  "LOW_ANGLE",
  "HIGH_ANGLE",
  "OVERHEAD",
  "THREE_QUARTER",
]);
export const creativeCompositionSchema = z.enum([
  "CENTERED",
  "OFF_CENTER",
  "NEGATIVE_SPACE",
  "EDITORIAL_CROP",
  "SYMMETRICAL",
  "LAYERED_PROPS",
]);
export type CreativeComposition = z.infer<typeof creativeCompositionSchema>;

export const creativeSubjectDirectionSchema = z.enum([
  "PRODUCT_ONLY",
  "STANDING_SUBTLE",
  "FRONTAL",
  "REAR_VIEW",
  "SEATED",
  "WALKING",
  "LEANING",
  "TURNING",
  "PRODUCT_FOCUSED_POSE",
]);
export const productPresentationSchema = z.enum([
  "WORN",
  "FLATLAY",
  "FOLDED",
  "HANGER",
  "RACK",
  "DRAPED",
  "CHAIR",
  "TABLETOP",
  "SPORTS_PROPS",
  "DETAIL",
]);
export type ProductPresentation = z.infer<typeof productPresentationSchema>;

export const creativeMoodSchema = z.enum([
  "CLEAN",
  "PREMIUM",
  "MINIMAL",
  "EDITORIAL",
  "URBAN",
  "CINEMATIC",
  "RELAXED",
  "SPORTY",
  "MOODY",
  "WARM",
  "HIGH_FASHION",
]);
export type CreativeMood = z.infer<typeof creativeMoodSchema>;

export const creativeChannelIntentSchema = z.enum([
  "SHOPIFY",
  "INSTAGRAM_FEED",
  "INSTAGRAM_STORY",
  "REEL_COVER",
  "CAROUSEL",
  "SOCIAL",
  "CAMPAIGN",
]);
export const creativeAspectIntentSchema = z.enum([
  "1:1",
  "4:5",
  "9:16",
  "SHOT_DEPENDENT",
]);

export const creativePresetIdSchema = z.enum([
  "SHOPIFY_STANDARD",
  "SHOPIFY_ALTERNATE",
  "SHOPIFY_DETAIL",
  "CLEAN_STUDIO",
  "EDITORIAL_STUDIO",
  "URBAN_STREET",
  "PARKING_GARAGE",
  "STADIUM",
  "MINIMAL_INTERIOR",
  "PREMIUM_INTERIOR",
  "RACK_SHOWROOM",
  "SPORTS_PROPS",
  "SOFT_FLATLAY",
  "EDITORIAL_FLATLAY",
  "SUNSET_LIFESTYLE",
]);
export type CreativePresetId = z.infer<typeof creativePresetIdSchema>;

export const socialCreativeDirectionV1Schema = z
  .object({
    contractVersion: z.literal(CREATIVE_DIRECTION_VERSION),
    contentMode: imageContentModeSchema,
    shotType: z.string().min(1),
    presetId: creativePresetIdSchema,
    sceneType: creativeSceneTypeSchema,
    locationType: creativeLocationTypeSchema,
    lighting: creativeLightingSchema,
    camera: z
      .object({
        framing: creativeCameraFramingSchema,
        angle: creativeCameraAngleSchema,
      })
      .strict(),
    composition: creativeCompositionSchema,
    subjectDirection: creativeSubjectDirectionSchema,
    productPresentation: productPresentationSchema,
    mood: creativeMoodSchema,
    channelIntent: creativeChannelIntentSchema,
    aspectIntent: creativeAspectIntentSchema,
    customDirection: z.string().trim().max(600).nullable(),
    source: z.enum(["SMART_DEFAULT", "OWNER_SELECTED", "OWNER_ADJUSTED"]),
  })
  .strict();

export type SocialCreativeDirectionV1 = z.infer<
  typeof socialCreativeDirectionV1Schema
>;

export interface CreativePresetDefinition {
  id: CreativePresetId;
  label: string;
  description: string;
  modes: ImageContentMode[];
  modelCompatibility: "MODEL" | "PRODUCT_ONLY" | "BOTH";
  direction: Omit<
    SocialCreativeDirectionV1,
    | "contractVersion"
    | "contentMode"
    | "shotType"
    | "presetId"
    | "channelIntent"
    | "aspectIntent"
    | "customDirection"
    | "source"
  >;
}

/**
 * Provider-facing art direction for the frozen preset. These instructions add
 * production quality, never Product, Persona, or Artwork authority.
 */
export const CREATIVE_PRESET_QUALITY_DIRECTION: Readonly<
  Record<CreativePresetId, string>
> = Object.freeze({
  SHOPIFY_STANDARD:
    "Premium commercial ecommerce photography on a refined seamless neutral background, clean product separation, accurate color, controlled soft shadows, no props, clutter, text, signage, or random logos.",
  SHOPIFY_ALTERNATE:
    "Premium commercial studio photography with the same restrained neutral background language, consistent color and lighting, deliberate three-quarter presentation, and no distracting set elements.",
  SHOPIFY_DETAIL:
    "Premium commercial garment-detail photography with refined material light, accurate construction detail, a clean neutral set, and no unrelated graphics, text, props, or clutter.",
  CLEAN_STUDIO:
    "Premium fashion studio photography with a refined seamless backdrop, soft controlled light, precise styling, believable garment presentation, and a calm uncluttered composition.",
  EDITORIAL_STUDIO:
    "High-end fashion editorial studio photography with an intentional premium backdrop, art-directed shadows, polished styling, and no cheap props, random set dressing, or accidental text.",
  URBAN_STREET:
    "Premium commercial fashion photography in a clean, well-maintained contemporary city setting with elegant architecture, refined materials, controlled depth, and an art-directed streetscape. No derelict surroundings, grime, graffiti, clutter, random signage, visible brand logos, or stereotyped cultural cues. The location must never be inferred from the model's identity or ethnicity.",
  PARKING_GARAGE:
    "Premium cinematic fashion photography in a clean modern architectural parking structure with elegant concrete geometry and controlled cool light. No grime, graffiti, random cars, unsafe atmosphere, signage, clutter, or low-grade utilitarian scenery.",
  STADIUM:
    "Premium campaign photography in a clean modern stadium or architectural seating environment with orderly geometry, refined daylight, and no crowds, sponsors, accidental text, litter, or visual clutter.",
  MINIMAL_INTERIOR:
    "Premium minimalist interior photography with refined architecture, clean lines, quality materials, intentional negative space, and no generic budget room, clutter, random decor, or accidental text.",
  PREMIUM_INTERIOR:
    "High-end commercial fashion photography in a tasteful contemporary premium interior with refined furniture and materials, controlled styling, coherent lighting, and no ostentatious, random, or cluttered decor.",
  RACK_SHOWROOM:
    "Premium showroom product photography with an elegant rack or hanger setup, clean spacing, refined materials, controlled styling, and no retail clutter, price tags, signage, or unrelated garments dominating the frame.",
  SPORTS_PROPS:
    "Premium art-directed fashion still life with a small coherent set of high-quality sports props, disciplined color harmony, deliberate spacing, and no random logos, text, clutter, or cheap equipment.",
  SOFT_FLATLAY:
    "Premium commercial flatlay with clean garment contour, refined surface materials, soft controlled daylight, precise spacing, and no distracting props, wrinkles, text, or clutter.",
  EDITORIAL_FLATLAY:
    "High-end editorial flatlay with intentional premium props, disciplined composition, controlled shadows, coherent color styling, and no random logos, accidental text, or visual clutter.",
  SUNSET_LIFESTYLE:
    "Premium campaign-quality lifestyle photography in a clean, visually appealing modern outdoor setting with controlled warm evening light, polished styling, elegant depth, and no random signage, clutter, or stereotyped location cues.",
});

export const GLOBAL_CREATIVE_QUALITY_DIRECTION =
  "QUALITY CONTRACT: premium commercial fashion photography and product photography at campaign and high-end mockup quality, professionally art-directed, modern, desirable, visually coherent, believable, and immediately usable for brand, shop, and social publishing. Build a deliberate product-centric composition with refined lighting, clean geometry, beautiful material surfaces, coherent high-quality props, polished styling, and an intentional maintained contemporary environment. Avoid generic stock-photo staging, distracting clutter, accidental text or signage, random logos, malformed props, cheap-looking scenery, and cultural stereotypes. The environment must follow the selected creative preset and must never be inferred from the Brand Model's identity or ethnicity." as const;

export const CONTENT_SHOT_COMMERCIAL_DIRECTION: Readonly<
  Record<string, string>
> = Object.freeze({
  "content:lifestyle-with-model":
    "Create a premium campaign-ready fashion asset with a deliberate model pose, clear garment silhouette, strong but uncluttered composition, and enough calm fabric across the selected print zone for exact later print application.",
  "content:premium-flatlay":
    "Create an elevated product-led flatlay with immaculate garment contour, premium tactile surface materials, disciplined spacing, subtle coherent props only, and a fully readable blank print zone.",
  "content:hanger-or-rack":
    "Create a premium hanging-product hero with a high-quality hanger or architectural rack, controlled garment drape, refined showroom styling, clean separation, and no unrelated garments dominating the asset.",
  "content:social-hero-story":
    "Create a campaign-grade vertical social hero with a strong focal hierarchy, intentional negative space, premium prop or architectural choices, clean mobile-first framing, and unmistakable garment visibility.",
  "content:campaign-hero":
    "Create a polished fashion campaign key visual with refined art direction, a memorable but coherent composition, commercial lighting, and product-first storytelling rather than a generic lifestyle snapshot.",
  "content:product-highlight":
    "Create a premium product/social crossover image with construction, material, silhouette, and printable garment surface as the clear visual priority.",
});

function preset(
  definition: CreativePresetDefinition,
): CreativePresetDefinition {
  return definition;
}

export const CREATIVE_PRESETS: readonly CreativePresetDefinition[] = [
  preset({
    id: "SHOPIFY_STANDARD",
    label: "Shopify Standard",
    description: "Sauber, farbtreu und konsistent für den Shop.",
    modes: ["SHOPIFY_MOCKUP"],
    modelCompatibility: "BOTH",
    direction: {
      sceneType: "STUDIO_CLEAN",
      locationType: "STUDIO",
      lighting: "CLEAN_ECOMMERCE",
      camera: { framing: "PRODUCT_FULL_VIEW", angle: "EYE_LEVEL" },
      composition: "CENTERED",
      subjectDirection: "PRODUCT_ONLY",
      productPresentation: "WORN",
      mood: "CLEAN",
    },
  }),
  preset({
    id: "SHOPIFY_ALTERNATE",
    label: "Shopify Studio",
    description: "Ruhige zweite Studioansicht mit gleicher Bildlogik.",
    modes: ["SHOPIFY_MOCKUP"],
    modelCompatibility: "BOTH",
    direction: {
      sceneType: "STUDIO_CLEAN",
      locationType: "STUDIO",
      lighting: "SOFT_STUDIO",
      camera: { framing: "THREE_QUARTER", angle: "EYE_LEVEL" },
      composition: "CENTERED",
      subjectDirection: "STANDING_SUBTLE",
      productPresentation: "WORN",
      mood: "CLEAN",
    },
  }),
  preset({
    id: "SHOPIFY_DETAIL",
    label: "Shopify Detail",
    description: "Material, Konstruktion und Druckfläche im Fokus.",
    modes: ["SHOPIFY_MOCKUP"],
    modelCompatibility: "PRODUCT_ONLY",
    direction: {
      sceneType: "STUDIO_CLEAN",
      locationType: "STUDIO",
      lighting: "DIRECTED_SIDE_LIGHT",
      camera: { framing: "PRODUCT_CLOSE_UP", angle: "THREE_QUARTER" },
      composition: "CENTERED",
      subjectDirection: "PRODUCT_ONLY",
      productPresentation: "DETAIL",
      mood: "CLEAN",
    },
  }),
  preset({
    id: "CLEAN_STUDIO",
    label: "Clean Studio",
    description: "Ruhiger Studio-Look mit klarer Produktlesbarkeit.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "BOTH",
    direction: {
      sceneType: "STUDIO_CLEAN",
      locationType: "STUDIO",
      lighting: "SOFT_STUDIO",
      camera: { framing: "FULL_BODY", angle: "EYE_LEVEL" },
      composition: "CENTERED",
      subjectDirection: "STANDING_SUBTLE",
      productPresentation: "WORN",
      mood: "CLEAN",
    },
  }),
  preset({
    id: "EDITORIAL_STUDIO",
    label: "Editorial Studio",
    description: "Stärkeres Licht und modische Editorial-Komposition.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "MODEL",
    direction: {
      sceneType: "STUDIO_EDITORIAL",
      locationType: "STUDIO",
      lighting: "HARD_EDITORIAL",
      camera: { framing: "THREE_QUARTER", angle: "LOW_ANGLE" },
      composition: "EDITORIAL_CROP",
      subjectDirection: "PRODUCT_FOCUSED_POSE",
      productPresentation: "WORN",
      mood: "HIGH_FASHION",
    },
  }),
  preset({
    id: "URBAN_STREET",
    label: "Urban Street",
    description: "Premium-Stadtarchitektur mit natürlicher Bewegung.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "MODEL",
    direction: {
      sceneType: "URBAN_STREET",
      locationType: "STREET",
      lighting: "DIFFUSED_DAYLIGHT",
      camera: { framing: "FULL_BODY", angle: "EYE_LEVEL" },
      composition: "OFF_CENTER",
      subjectDirection: "WALKING",
      productPresentation: "WORN",
      mood: "URBAN",
    },
  }),
  preset({
    id: "PARKING_GARAGE",
    label: "Parkhaus",
    description: "Kühle Architektur und cineastischer Kontrast.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "MODEL",
    direction: {
      sceneType: "PARKING_GARAGE",
      locationType: "PARKING_GARAGE",
      lighting: "COOL_URBAN",
      camera: { framing: "FULL_BODY", angle: "LOW_ANGLE" },
      composition: "NEGATIVE_SPACE",
      subjectDirection: "LEANING",
      productPresentation: "WORN",
      mood: "CINEMATIC",
    },
  }),
  preset({
    id: "STADIUM",
    label: "Stadion",
    description: "Sportliche Sitz- oder Tribünenszene.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "MODEL",
    direction: {
      sceneType: "STADIUM",
      locationType: "STADIUM",
      lighting: "DIFFUSED_DAYLIGHT",
      camera: { framing: "FULL_BODY", angle: "EYE_LEVEL" },
      composition: "OFF_CENTER",
      subjectDirection: "SEATED",
      productPresentation: "WORN",
      mood: "SPORTY",
    },
  }),
  preset({
    id: "MINIMAL_INTERIOR",
    label: "Minimal Interior",
    description: "Reduzierter Raum mit ruhiger Premium-Wirkung.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "BOTH",
    direction: {
      sceneType: "MINIMAL_INTERIOR",
      locationType: "MINIMAL_ROOM",
      lighting: "DIFFUSED_DAYLIGHT",
      camera: { framing: "THREE_QUARTER", angle: "EYE_LEVEL" },
      composition: "NEGATIVE_SPACE",
      subjectDirection: "STANDING_SUBTLE",
      productPresentation: "DRAPED",
      mood: "MINIMAL",
    },
  }),
  preset({
    id: "PREMIUM_INTERIOR",
    label: "Premium Interior",
    description: "Hochwertiges Interior mit kontrolliertem Styling.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "BOTH",
    direction: {
      sceneType: "PREMIUM_INTERIOR",
      locationType: "MODERN_INTERIOR",
      lighting: "DIRECTED_SIDE_LIGHT",
      camera: { framing: "THREE_QUARTER", angle: "EYE_LEVEL" },
      composition: "OFF_CENTER",
      subjectDirection: "SEATED",
      productPresentation: "CHAIR",
      mood: "PREMIUM",
    },
  }),
  preset({
    id: "RACK_SHOWROOM",
    label: "Rack / Showroom",
    description: "Kleiderstange oder Bügel in einem klaren Showroom.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "PRODUCT_ONLY",
    direction: {
      sceneType: "RACK_SETUP",
      locationType: "SHOWROOM",
      lighting: "SOFT_STUDIO",
      camera: { framing: "PRODUCT_FULL_VIEW", angle: "EYE_LEVEL" },
      composition: "CENTERED",
      subjectDirection: "PRODUCT_ONLY",
      productPresentation: "RACK",
      mood: "PREMIUM",
    },
  }),
  preset({
    id: "SPORTS_PROPS",
    label: "Sports Props",
    description: "Kontrolliertes Styling mit sportlichen Requisiten.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "PRODUCT_ONLY",
    direction: {
      sceneType: "SPORTS_SETUP",
      locationType: "STUDIO",
      lighting: "HIGH_CONTRAST",
      camera: { framing: "PRODUCT_FULL_VIEW", angle: "HIGH_ANGLE" },
      composition: "LAYERED_PROPS",
      subjectDirection: "PRODUCT_ONLY",
      productPresentation: "SPORTS_PROPS",
      mood: "SPORTY",
    },
  }),
  preset({
    id: "SOFT_FLATLAY",
    label: "Soft Flatlay",
    description: "Weiche Draufsicht mit klarer Produktkontur.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "PRODUCT_ONLY",
    direction: {
      sceneType: "FLATLAY",
      locationType: "TABLETOP",
      lighting: "DIFFUSED_DAYLIGHT",
      camera: { framing: "PRODUCT_FULL_VIEW", angle: "OVERHEAD" },
      composition: "CENTERED",
      subjectDirection: "PRODUCT_ONLY",
      productPresentation: "FLATLAY",
      mood: "MINIMAL",
    },
  }),
  preset({
    id: "EDITORIAL_FLATLAY",
    label: "Editorial Flatlay",
    description: "Gestylte Draufsicht mit kontrollierten Requisiten.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "PRODUCT_ONLY",
    direction: {
      sceneType: "FLATLAY",
      locationType: "TABLETOP",
      lighting: "HARD_EDITORIAL",
      camera: { framing: "PRODUCT_FULL_VIEW", angle: "OVERHEAD" },
      composition: "LAYERED_PROPS",
      subjectDirection: "PRODUCT_ONLY",
      productPresentation: "FLATLAY",
      mood: "EDITORIAL",
    },
  }),
  preset({
    id: "SUNSET_LIFESTYLE",
    label: "Sunset Lifestyle",
    description: "Warme Outdoor-Szene für Social und Kampagne.",
    modes: ["SOCIAL_CONTENT"],
    modelCompatibility: "MODEL",
    direction: {
      sceneType: "SUNSET_OUTDOOR",
      locationType: "OUTDOOR_CITY",
      lighting: "WARM_EVENING",
      camera: { framing: "FULL_BODY", angle: "EYE_LEVEL" },
      composition: "NEGATIVE_SPACE",
      subjectDirection: "WALKING",
      productPresentation: "WORN",
      mood: "WARM",
    },
  }),
] as const;


export const CREATIVE_LABELS = {
  scene: {
    STUDIO_CLEAN: "Clean Studio",
    STUDIO_EDITORIAL: "Editorial Studio",
    URBAN_STREET: "Urban Street",
    PARKING_GARAGE: "Parkhaus",
    CONCRETE_ARCHITECTURE: "Betonarchitektur",
    STAIRCASE: "Treppenhaus",
    STADIUM: "Stadion",
    MINIMAL_INTERIOR: "Minimal Interior",
    PREMIUM_INTERIOR: "Premium Interior",
    SHOWROOM: "Showroom",
    SPORTS_SETUP: "Sports Setup",
    FURNITURE_STYLING: "Möbel-Styling",
    RACK_SETUP: "Kleiderstange",
    HANGER_SETUP: "Kleiderbügel",
    TABLETOP: "Tischszene",
    FLATLAY: "Flatlay",
    OUTDOOR_CITY: "Outdoor City",
    SUNSET_OUTDOOR: "Outdoor bei Abendlicht",
    CUSTOM: "Eigene Szene",
  } satisfies Record<CreativeSceneType, string>,
  location: {
    STUDIO: "Studio",
    STREET: "Straße",
    PARKING_GARAGE: "Parkhaus",
    STADIUM: "Stadion",
    STAIRCASE: "Treppenhaus",
    CONCRETE_ARCHITECTURE: "Betonarchitektur",
    SHOWROOM: "Showroom",
    MODERN_INTERIOR: "Modernes Interior",
    MINIMAL_ROOM: "Minimalistischer Raum",
    OUTDOOR_CITY: "Outdoor City",
    TABLETOP: "Tisch / Fläche",
    NOT_APPLICABLE: "Nicht erforderlich",
    CUSTOM: "Eigener Ort",
  } satisfies Record<CreativeLocationType, string>,
  lighting: {
    SOFT_STUDIO: "Weiches Studio",
    HARD_EDITORIAL: "Hartes Editorial-Licht",
    DIRECTED_SIDE_LIGHT: "Gerichtetes Seitenlicht",
    DIFFUSED_DAYLIGHT: "Diffuses Tageslicht",
    WARM_EVENING: "Warmes Abendlicht",
    COOL_URBAN: "Kühles urbanes Licht",
    HIGH_CONTRAST: "Kontrastreich",
    CLEAN_ECOMMERCE: "Clean E-Commerce",
    CUSTOM: "Eigenes Licht",
  } satisfies Record<CreativeLighting, string>,
  cameraFraming: {
    FULL_BODY: "Ganzkörper",
    PORTRAIT: "Portrait",
    WAIST_UP: "Halbkörper",
    CLOSE_UP: "Close-up",
    PRODUCT_CLOSE_UP: "Produktdetail",
    OVERHEAD: "Draufsicht",
    THREE_QUARTER: "Dreiviertel",
    PRODUCT_FULL_VIEW: "Gesamtes Produkt",
  },
  composition: {
    CENTERED: "Zentriert",
    OFF_CENTER: "Außermittig",
    NEGATIVE_SPACE: "Mit Freiraum",
    EDITORIAL_CROP: "Editorial-Ausschnitt",
    SYMMETRICAL: "Symmetrisch",
    LAYERED_PROPS: "Mit Requisiten",
  } satisfies Record<CreativeComposition, string>,
  mood: {
    CLEAN: "Clean",
    PREMIUM: "Premium",
    MINIMAL: "Minimal",
    EDITORIAL: "Editorial",
    URBAN: "Urban",
    CINEMATIC: "Cineastisch",
    RELAXED: "Entspannt",
    SPORTY: "Sportlich",
    MOODY: "Atmosphärisch",
    WARM: "Warm",
    HIGH_FASHION: "High Fashion",
  } satisfies Record<CreativeMood, string>,
} as const;

export const CREATIVE_CHANNEL_LABELS: Record<
  z.infer<typeof creativeChannelIntentSchema>,
  string
> = {
  SHOPIFY: "Shopify",
  INSTAGRAM_FEED: "Instagram Beitrag",
  INSTAGRAM_STORY: "Instagram Story",
  REEL_COVER: "Reel Cover",
  CAROUSEL: "Carousel",
  SOCIAL: "Social",
  CAMPAIGN: "Kampagne",
};

function modelKind(shotId: string): "MODEL" | "PRODUCT_ONLY" {
  return contentShotById(shotId)?.requiresBrandModel ? "MODEL" : "PRODUCT_ONLY";
}

export function creativePresetsForShot(
  shotId: string,
  mode: ImageContentMode,
): CreativePresetDefinition[] {
  const kind = modelKind(shotId);
  return CREATIVE_PRESETS.filter(
    (item) =>
      item.modes.includes(mode) &&
      (item.modelCompatibility === "BOTH" || item.modelCompatibility === kind),
  );
}

function defaultChannel(shotId: string, mode: ImageContentMode) {
  const shot = contentShotById(shotId);
  if (mode === "SHOPIFY_MOCKUP") return "SHOPIFY" as const;
  return (
    shot?.intents.find((intent) => intent !== "SHOPIFY") ?? "SOCIAL"
  );
}

function defaultAspect(shotId: string) {
  return contentShotById(shotId)?.aspectIntents[0] ?? "SHOT_DEPENDENT";
}

export function smartDefaultPresetId(
  shotId: string,
  mode: ImageContentMode,
): CreativePresetId {
  if (mode === "SHOPIFY_MOCKUP") {
    return /detail/i.test(shotId) ? "SHOPIFY_DETAIL" : "SHOPIFY_STANDARD";
  }
  if (/flatlay/i.test(shotId)) return "SOFT_FLATLAY";
  if (/hanger|rack|clothing-rack/i.test(shotId)) return "RACK_SHOWROOM";
  if (/social-hero|story|campaign-hero/i.test(shotId)) return "PARKING_GARAGE";
  if (modelKind(shotId) === "MODEL") return "URBAN_STREET";
  return "MINIMAL_INTERIOR";
}

export function createCreativeDirection(input: {
  shotId: string;
  contentMode: ImageContentMode;
  presetId?: CreativePresetId;
  source?: SocialCreativeDirectionV1["source"];
}): SocialCreativeDirectionV1 {
  const available = creativePresetsForShot(input.shotId, input.contentMode);
  const requestedId =
    input.presetId ?? smartDefaultPresetId(input.shotId, input.contentMode);
  const selected =
    available.find((item) => item.id === requestedId) ?? available[0];
  if (!selected)
    throw new Error("No compatible creative preset exists for this shot.");
  const kind = modelKind(input.shotId);
  const productOnlyPresentation: ProductPresentation = /flatlay/i.test(
    input.shotId,
  )
    ? "FLATLAY"
    : /hanger/i.test(input.shotId)
      ? "HANGER"
      : /rack/i.test(input.shotId)
        ? "RACK"
        : /folded/i.test(input.shotId)
          ? "FOLDED"
          : /detail/i.test(input.shotId)
            ? "DETAIL"
            : selected.direction.productPresentation === "SPORTS_PROPS"
              ? "SPORTS_PROPS"
              : selected.direction.productPresentation === "CHAIR" ||
                  selected.direction.productPresentation === "DRAPED"
                ? selected.direction.productPresentation
                : "TABLETOP";
  const normalizedDirection =
    kind === "PRODUCT_ONLY"
      ? {
          ...selected.direction,
          subjectDirection: "PRODUCT_ONLY" as const,
          productPresentation: productOnlyPresentation,
          camera: {
            ...selected.direction.camera,
            framing:
              selected.direction.camera.framing === "PRODUCT_CLOSE_UP"
                ? ("PRODUCT_CLOSE_UP" as const)
                : ("PRODUCT_FULL_VIEW" as const),
          },
        }
      : {
          ...selected.direction,
          subjectDirection:
            selected.direction.subjectDirection === "PRODUCT_ONLY"
              ? ("STANDING_SUBTLE" as const)
              : selected.direction.subjectDirection,
          productPresentation: "WORN" as const,
        };
  return socialCreativeDirectionV1Schema.parse({
    contractVersion: CREATIVE_DIRECTION_VERSION,
    contentMode: input.contentMode,
    shotType: input.shotId,
    presetId: selected.id,
    ...normalizedDirection,
    channelIntent: defaultChannel(input.shotId, input.contentMode),
    aspectIntent: defaultAspect(input.shotId),
    customDirection: null,
    source: input.source ?? "SMART_DEFAULT",
  });
}

export function updateCreativeDirection(
  current: SocialCreativeDirectionV1,
  patch: Partial<
    Pick<
      SocialCreativeDirectionV1,
      | "sceneType"
      | "locationType"
      | "lighting"
      | "camera"
      | "composition"
      | "subjectDirection"
      | "productPresentation"
      | "mood"
      | "channelIntent"
      | "aspectIntent"
      | "customDirection"
    >
  >,
): SocialCreativeDirectionV1 {
  return socialCreativeDirectionV1Schema.parse({
    ...current,
    ...patch,
    source: "OWNER_ADJUSTED",
  });
}

export const socialVariationPlanV1Schema = z
  .object({
    contractVersion: z.literal("social-variation-plan-v1"),
    shotId: z.string().min(1),
    entries: z.array(socialCreativeDirectionV1Schema).max(12),
    executionPolicy: z.literal("MANUAL_SINGLE_ASSET_ONLY"),
    automaticJobCount: z.literal(0),
  })
  .strict();
export type SocialVariationPlanV1 = z.infer<
  typeof socialVariationPlanV1Schema
>;

export function createSocialVariationPlan(
  shotId: string,
  directions: SocialCreativeDirectionV1[],
): SocialVariationPlanV1 {
  return socialVariationPlanV1Schema.parse({
    contractVersion: "social-variation-plan-v1",
    shotId,
    entries: directions.filter((item) => item.shotType === shotId),
    executionPolicy: "MANUAL_SINGLE_ASSET_ONLY",
    automaticJobCount: 0,
  });
}

/** Lightweight anti-repetition suggestion seam. It reads planning history only. */
export function suggestControlledVariations(input: {
  shotId: string;
  recent: SocialCreativeDirectionV1[];
  limit?: number;
}): CreativePresetDefinition[] {
  const recentScenes = new Set(input.recent.map((item) => item.sceneType));
  const recentLocations = new Set(input.recent.map((item) => item.locationType));
  return creativePresetsForShot(input.shotId, "SOCIAL_CONTENT")
    .map((item) => ({
      item,
      score:
        Number(!recentScenes.has(item.direction.sceneType)) * 2 +
        Number(!recentLocations.has(item.direction.locationType)),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? 5)
    .map(({ item }) => item);
}

/** Provider adapter input derived from structured, frozen direction. */
export function creativeDirectionPromptLines(
  direction: SocialCreativeDirectionV1,
): string[] {
  return [
    GLOBAL_CREATIVE_QUALITY_DIRECTION,
    `SELECTED PRESET QUALITY: ${CREATIVE_PRESET_QUALITY_DIRECTION[direction.presetId]}`,
    CONTENT_SHOT_COMMERCIAL_DIRECTION[direction.shotType]
      ? `SHOT QUALITY: ${CONTENT_SHOT_COMMERCIAL_DIRECTION[direction.shotType]}`
      : "SHOT QUALITY: keep the Product visually dominant, commercially useful, and intentionally composed.",
    `Content intent: ${direction.contentMode}; channel: ${direction.channelIntent}; aspect intent: ${direction.aspectIntent}.`,
    `Scene: ${direction.sceneType}; location: ${direction.locationType}; mood: ${direction.mood}.`,
    `Lighting: ${direction.lighting}.`,
    `Camera framing: ${direction.camera.framing}; angle: ${direction.camera.angle}; composition: ${direction.composition}.`,
    `Subject direction: ${direction.subjectDirection}; product presentation: ${direction.productPresentation}.`,
    direction.customDirection
      ? `Additional owner direction: ${direction.customDirection}.`
      : "",
  ].filter(Boolean);
}

export function creativeDirectionPlanningKey(
  direction: SocialCreativeDirectionV1 | null | undefined,
): string | null {
  if (!direction) return null;
  const value = socialCreativeDirectionV1Schema.parse(direction);
  return [
    value.contractVersion,
    value.contentMode,
    value.shotType,
    value.presetId,
    value.sceneType,
    value.locationType,
    value.lighting,
    value.camera.framing,
    value.camera.angle,
    value.composition,
    value.subjectDirection,
    value.productPresentation,
    value.mood,
    value.channelIntent,
    value.aspectIntent,
    value.customDirection ?? "",
  ].join("|");
}

/**
 * Resolve a complete direction synchronously for the current canonical shot.
 * The owner UI uses this during render, so shot changes never produce an
 * intermediate empty direction card while a post-paint effect catches up.
 */
export function creativeDirectionForSelection(input: {
  direction: SocialCreativeDirectionV1 | null;
  shotId: string | null;
  contentMode: ImageContentMode;
}): SocialCreativeDirectionV1 | null {
  if (!input.shotId) return null;
  if (
    input.direction?.shotType === input.shotId &&
    input.direction.contentMode === input.contentMode
  )
    return input.direction;
  return createCreativeDirection({
    shotId: input.shotId,
    contentMode: input.contentMode,
  });
}
