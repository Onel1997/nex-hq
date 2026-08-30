import type { ImageStudioAsset } from "@/agents/image/types";

export type ContentPackId = "BASE" | "WINNING_EXPANSION" | "CUSTOM";
export type ContentIntent =
  | "SHOPIFY"
  | "INSTAGRAM_FEED"
  | "INSTAGRAM_STORY"
  | "REEL_COVER"
  | "CAROUSEL"
  | "SOCIAL"
  | "CAMPAIGN";
export type ContentShotSideIntent = "FRONT" | "BACK" | "OWNER_SELECTABLE";
export type ProductShotKind =
  | "TSHIRT"
  | "HOODIE"
  | "ZIP_HOODIE"
  | "JOGGER"
  | "HEADWEAR"
  | "PANTS"
  | "JACKET"
  | "GENERIC";

export interface ContentShotDefinition {
  id: string;
  label: string;
  description: string;
  intents: ContentIntent[];
  aspectIntents: Array<"1:1" | "4:5" | "9:16" | "SHOT_DEPENDENT">;
  requiresBrandModel: boolean;
  compatibleProductKinds: ProductShotKind[];
  assetType: ImageStudioAsset["assetType"];
  outputCategory: ImageStudioAsset["outputCategory"];
  location: string;
  lighting: string;
  photographyStyle: string;
  cameraStyle: string;
  sideIntent: ContentShotSideIntent;
  supportedSides: Array<"FRONT" | "BACK">;
}

const ALL_APPAREL: ProductShotKind[] = [
  "TSHIRT",
  "HOODIE",
  "ZIP_HOODIE",
  "JOGGER",
  "PANTS",
  "JACKET",
];
const ALL_PRODUCTS: ProductShotKind[] = [...ALL_APPAREL, "HEADWEAR", "GENERIC"];
const UPPER_BODY: ProductShotKind[] = [
  "TSHIRT",
  "HOODIE",
  "ZIP_HOODIE",
  "JACKET",
];

function shot(
  definition: Omit<
    ContentShotDefinition,
    "id" | "sideIntent" | "supportedSides"
  > & {
    id: string;
    sideIntent?: ContentShotSideIntent;
    supportedSides?: Array<"FRONT" | "BACK">;
  },
): ContentShotDefinition {
  return {
    ...definition,
    sideIntent: definition.sideIntent ?? "OWNER_SELECTABLE",
    supportedSides: definition.supportedSides ?? ["FRONT", "BACK"],
  };
}

export const CONTENT_SHOTS: readonly ContentShotDefinition[] = [
  shot({
    id: "content:shopify-product-image",
    label: "Shopify Produktbild",
    description: "Klare, produktorientierte Hauptansicht für Shop und Katalog.",
    intents: ["SHOPIFY"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutraler, nahtloser E-Commerce-Studiohintergrund",
    lighting: "Gleichmäßiges farbtreues Softbox-Licht",
    photographyStyle:
      "Saubere kommerzielle Produktfotografie mit sichtbarer Konstruktion",
    cameraStyle: "Gerade produktorientierte Ansicht mit ruhigem Beschnitt",
    sideIntent: "FRONT",
    supportedSides: ["FRONT"],
  }),
  shot({
    id: "content:lifestyle-with-model",
    label: "Lifestyle mit Model",
    description: "Markenmodel in einer glaubwürdigen Alltagsszene.",
    intents: ["INSTAGRAM_FEED", "SOCIAL", "CAMPAIGN"],
    aspectIntents: ["4:5", "SHOT_DEPENDENT"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "editorial_streetwear",
    outputCategory: "editorial_campaign",
    location: "Glaubwürdige, markengerechte Lifestyle-Umgebung",
    lighting: "Natürliches gerichtetes Licht mit kontrolliertem Kontrast",
    photographyStyle: "Realistische Premium-Lifestyle-Fotografie",
    cameraStyle: "Ganz- oder Dreiviertelkörper mit klar sichtbarem Produkt",
    sideIntent: "FRONT",
  }),
  shot({
    id: "content:premium-flatlay",
    label: "Premium Flatlay",
    description: "Hochwertige Produktanordnung von oben.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Kontrollierte Premium-Flatlay-Fläche",
    lighting: "Weiches Oberlicht mit sichtbarer Materialstruktur",
    photographyStyle: "Hochwertige Flatlay-Produktfotografie",
    cameraStyle: "Exakte Draufsicht mit vollständiger Produktkontur",
    sideIntent: "FRONT",
  }),
  shot({
    id: "content:hanger-or-rack",
    label: "Kleiderbügel / Kleiderstange",
    description: "Produkt sauber hängend für Shop und Social.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: UPPER_BODY,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Reduzierte Studio-Kleiderstange",
    lighting: "Weiches seitliches Licht mit sauberer Kontur",
    photographyStyle:
      "Premium-Produktfotografie eines hängenden Kleidungsstücks",
    cameraStyle: "Gerade Ansicht auf Bügel oder Kleiderstange",
    sideIntent: "FRONT",
  }),
  shot({
    id: "content:social-hero-story",
    label: "Social Hero / Story",
    description: "Vertikaler Hero für Story, Reel-Cover und Social.",
    intents: ["INSTAGRAM_STORY", "REEL_COVER", "SOCIAL", "CAMPAIGN"],
    aspectIntents: ["9:16"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "story_slide",
    outputCategory: "social_media",
    location: "Markengerechte Hero-Umgebung mit vertikalem Freiraum",
    lighting: "Cineastisches Hero-Licht mit kontrollierten Highlights",
    photographyStyle: "Premium Social Key Visual",
    cameraStyle:
      "Vertikale Komposition mit klarer Produkt- und Artwork-Sichtbarkeit",
    sideIntent: "FRONT",
  }),

  shot({
    id: "content:clean-front",
    label: "Clean Front",
    description: "Saubere Vorderansicht des Produkts.",
    intents: ["SHOPIFY"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutraler E-Commerce-Hintergrund",
    lighting: "Farbrichtiges, gleichmäßiges Studiolicht",
    photographyStyle: "Saubere Katalogfotografie",
    cameraStyle: "Exakte Vorderansicht",
    sideIntent: "FRONT",
    supportedSides: ["FRONT"],
  }),
  shot({
    id: "content:clean-back",
    label: "Clean Back",
    description: "Saubere Rückansicht des Produkts.",
    intents: ["SHOPIFY"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_APPAREL,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutraler E-Commerce-Hintergrund",
    lighting: "Farbrichtiges, gleichmäßiges Studiolicht",
    photographyStyle: "Saubere Katalogfotografie",
    cameraStyle: "Exakte Rückansicht",
    sideIntent: "BACK",
    supportedSides: ["BACK"],
  }),
  shot({
    id: "content:styled-flatlay",
    label: "Styled Flatlay",
    description: "Gestylte Produktanordnung für Social und Kampagne.",
    intents: ["INSTAGRAM_FEED", "SOCIAL", "CAMPAIGN"],
    aspectIntents: ["4:5", "SHOT_DEPENDENT"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "editorial_luxury",
    outputCategory: "editorial_campaign",
    location: "Kuratiertes markengerechtes Flatlay-Set",
    lighting: "Weiches Editorial-Licht mit Materialtiefe",
    photographyStyle: "Editorial gestylte Flatlay-Fotografie",
    cameraStyle: "Draufsicht mit kontrollierter Requisitenhierarchie",
  }),
  shot({
    id: "content:hanger",
    label: "Kleiderbügel",
    description: "Einzelnes Produkt auf einem Bügel.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED"],
    aspectIntents: ["4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: UPPER_BODY,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Reduziertes Studio mit einzelnem Kleiderbügel",
    lighting: "Weiches Konturlicht",
    photographyStyle: "Premium-Produktfotografie",
    cameraStyle: "Gerade Einzelproduktansicht",
  }),
  shot({
    id: "content:clothing-rack",
    label: "Kleiderstange",
    description: "Produkt in einer kontrollierten Rack-Szene.",
    intents: ["INSTAGRAM_FEED", "SOCIAL", "CAMPAIGN"],
    aspectIntents: ["4:5", "SHOT_DEPENDENT"],
    requiresBrandModel: false,
    compatibleProductKinds: UPPER_BODY,
    assetType: "editorial_luxury",
    outputCategory: "editorial_campaign",
    location: "Minimalistische Kleiderstange im Studio",
    lighting: "Weiches räumliches Studiolicht",
    photographyStyle: "Premium Retail Editorial",
    cameraStyle: "Ruhige frontale Rack-Komposition",
  }),
  shot({
    id: "content:folded-product",
    label: "Gefaltetes Produkt",
    description: "Sauber gefaltetes Produkt für Detail und Shop.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_APPAREL,
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutrale Produktfläche",
    lighting: "Weiches Licht mit sichtbarer Stoffstruktur",
    photographyStyle: "Saubere Produktdetail-Fotografie",
    cameraStyle: "Leicht erhöhte Ansicht des gefalteten Produkts",
  }),
  shot({
    id: "content:detail",
    label: "Detailaufnahme",
    description: "Material, Print oder Konstruktion im Fokus.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "detail_shot",
    outputCategory: "product_photography",
    location: "Kontrolliertes Detail-Studio",
    lighting: "Streiflicht für Material- und Konstruktionsdetails",
    photographyStyle: "Hochauflösende Produktdetail-Fotografie",
    cameraStyle: "Enger Ausschnitt auf den gewählten Produktbereich",
  }),
  shot({
    id: "content:lifestyle-portrait",
    label: "Lifestyle Portrait",
    description: "Portraitorientierte Markenmodel-Aufnahme.",
    intents: ["INSTAGRAM_FEED", "SOCIAL", "CAMPAIGN"],
    aspectIntents: ["4:5"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "editorial_streetwear",
    outputCategory: "editorial_campaign",
    location: "Markengerechte Lifestyle-Umgebung",
    lighting: "Natürliches Portraitlicht",
    photographyStyle: "Premium Fashion Portrait",
    cameraStyle: "Portrait- oder Dreiviertelrahmung mit sichtbarem Produkt",
  }),
  shot({
    id: "content:lifestyle-full-body",
    label: "Lifestyle Ganzkörper",
    description: "Ganzkörper-Lifestyle mit klarer Silhouette.",
    intents: ["INSTAGRAM_FEED", "SOCIAL", "CAMPAIGN"],
    aspectIntents: ["4:5", "SHOT_DEPENDENT"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "lookbook_outfit",
    outputCategory: "lookbook",
    location: "Glaubwürdige urbane oder architektonische Umgebung",
    lighting: "Natürliches Licht mit kontrollierter Richtung",
    photographyStyle: "Ganzkörper Fashion Lifestyle",
    cameraStyle: "Ganzkörper mit klarer Produkt-Silhouette",
  }),
  shot({
    id: "content:campaign-hero",
    label: "Campaign Hero",
    description: "Zentrales Key Visual für eine Kampagne.",
    intents: ["CAMPAIGN", "SOCIAL"],
    aspectIntents: ["SHOT_DEPENDENT"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "hero_image",
    outputCategory: "launch_assets",
    location: "Kampagnen-Hero-Umgebung mit nutzbarem Freiraum",
    lighting: "Cineastisches Hero-Licht",
    photographyStyle: "Premium Fashion Campaign Key Visual",
    cameraStyle: "Dynamische Hero-Komposition mit anpassbarem Beschnitt",
  }),
  shot({
    id: "content:feed-post",
    label: "Feed Post",
    description: "4:5-Komposition für Instagram Feed.",
    intents: ["INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["4:5"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "instagram_post",
    outputCategory: "social_media",
    location: "Social-taugliche markengerechte Szene",
    lighting: "Klares, mobiles Feed-Licht",
    photographyStyle: "Premium Instagram Fashion Visual",
    cameraStyle: "Vertikale 4:5-Komposition",
  }),
  shot({
    id: "content:story-vertical",
    label: "Story Vertical",
    description: "9:16-Komposition für Story und Reel-Cover.",
    intents: ["INSTAGRAM_STORY", "REEL_COVER", "SOCIAL"],
    aspectIntents: ["9:16"],
    requiresBrandModel: true,
    compatibleProductKinds: [...ALL_APPAREL, "HEADWEAR"],
    assetType: "story_slide",
    outputCategory: "social_media",
    location: "Vertikale Social-Szene mit Textfreiraum",
    lighting: "Klares vertikales Hero-Licht",
    photographyStyle: "Mobile-first Fashion Visual",
    cameraStyle: "9:16-Komposition mit sicherem Zentrum",
  }),
  shot({
    id: "content:carousel-cover",
    label: "Carousel Cover",
    description: "Starker Einstieg für einen Carousel-Post.",
    intents: ["CAROUSEL", "INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "carousel_image",
    outputCategory: "social_media",
    location: "Reduzierte Social-Hero-Szene",
    lighting: "Kontrastreiches, kontrolliertes Cover-Licht",
    photographyStyle: "Klares Carousel Key Visual",
    cameraStyle: "4:5-Cover mit eindeutiger visueller Hierarchie",
  }),
  shot({
    id: "content:product-highlight",
    label: "Product Highlight",
    description: "Produktzentrierte Social-Aufnahme.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ALL_PRODUCTS,
    assetType: "hero_image",
    outputCategory: "launch_assets",
    location: "Premium Produkt-Hero-Set",
    lighting: "Kontrolliertes Highlight-Licht auf Material und Artwork",
    photographyStyle: "Produktzentriertes Premium Key Visual",
    cameraStyle: "4:5 Hero mit klarer Produktdominanz",
  }),

  shot({
    id: "content:hood-detail",
    label: "Kapuzendetail",
    description: "Kapuze, Kordeln und Konstruktion im Fokus.",
    intents: ["SHOPIFY", "SOCIAL"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ["HOODIE", "ZIP_HOODIE"],
    assetType: "detail_shot",
    outputCategory: "product_photography",
    location: "Kontrolliertes Detail-Studio",
    lighting: "Streiflicht auf Kapuzenkonstruktion",
    photographyStyle: "Technisch klare Produktdetail-Fotografie",
    cameraStyle: "Enger Ausschnitt auf die verifizierte Kapuze",
  }),
  shot({
    id: "content:zip-open-front",
    label: "Zip Hoodie offen",
    description:
      "Offene Vorderansicht, nur wenn ein Reißverschluss verifiziert ist.",
    intents: ["SHOPIFY"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ["ZIP_HOODIE"],
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutraler E-Commerce-Hintergrund",
    lighting: "Gleichmäßiges Produktlicht",
    photographyStyle: "Katalogansicht eines offenen Zip Hoodies",
    cameraStyle: "Exakte offene Vorderansicht",
    sideIntent: "FRONT",
    supportedSides: ["FRONT"],
  }),
  shot({
    id: "content:zip-closed-front",
    label: "Zip Hoodie geschlossen",
    description:
      "Geschlossene Vorderansicht, nur wenn ein Reißverschluss verifiziert ist.",
    intents: ["SHOPIFY"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ["ZIP_HOODIE"],
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutraler E-Commerce-Hintergrund",
    lighting: "Gleichmäßiges Produktlicht",
    photographyStyle: "Katalogansicht eines geschlossenen Zip Hoodies",
    cameraStyle: "Exakte geschlossene Vorderansicht",
    sideIntent: "FRONT",
    supportedSides: ["FRONT"],
  }),
  shot({
    id: "content:zipper-detail",
    label: "Reißverschlussdetail",
    description: "Reißverschluss und Vorderkonstruktion im Fokus.",
    intents: ["SHOPIFY", "SOCIAL"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ["ZIP_HOODIE", "JACKET"],
    assetType: "detail_shot",
    outputCategory: "product_photography",
    location: "Kontrolliertes Detail-Studio",
    lighting: "Materialbetontes Streiflicht",
    photographyStyle: "Konstruktionsdetail-Fotografie",
    cameraStyle: "Nahaufnahme des verifizierten Reißverschlusses",
  }),
  shot({
    id: "content:jogger-leg-detail",
    label: "Bein-Detail",
    description: "Bein, Printfläche oder Saum im Fokus.",
    intents: ["SHOPIFY", "SOCIAL"],
    aspectIntents: ["4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ["JOGGER", "PANTS"],
    assetType: "detail_shot",
    outputCategory: "product_photography",
    location: "Kontrolliertes Hosen-Detail-Studio",
    lighting: "Streiflicht auf Stoff und Naht",
    photographyStyle: "Klares Bein- und Konstruktionsdetail",
    cameraStyle:
      "Enger vertikaler Ausschnitt auf den verifizierten Beinbereich",
  }),
  shot({
    id: "content:headwear-worn",
    label: "Headwear getragen",
    description: "Getragene Produktansicht mit freigegebenem Markenmodel.",
    intents: ["INSTAGRAM_FEED", "SOCIAL"],
    aspectIntents: ["4:5"],
    requiresBrandModel: true,
    compatibleProductKinds: ["HEADWEAR"],
    assetType: "editorial_streetwear",
    outputCategory: "editorial_campaign",
    location: "Reduzierte Lifestyle-Umgebung",
    lighting: "Weiches Portraitlicht",
    photographyStyle: "Getragene Headwear-Fotografie",
    cameraStyle: "Portrait mit klar sichtbarem Produkt",
  }),
  shot({
    id: "content:headwear-tabletop",
    label: "Headwear Tabletop",
    description: "Saubere Tischansicht für Form und Details.",
    intents: ["SHOPIFY", "INSTAGRAM_FEED"],
    aspectIntents: ["1:1", "4:5"],
    requiresBrandModel: false,
    compatibleProductKinds: ["HEADWEAR"],
    assetType: "ecommerce_image",
    outputCategory: "product_photography",
    location: "Neutrale Tabletop-Fläche",
    lighting: "Weiches Formlicht",
    photographyStyle: "Saubere Headwear-Produktfotografie",
    cameraStyle: "Leicht erhöhte Produktansicht",
  }),
] as const;

const BY_ID = new Map(CONTENT_SHOTS.map((item) => [item.id, item]));

export const CONTENT_PACKS: Readonly<
  Record<
    Exclude<ContentPackId, "CUSTOM">,
    { label: string; description: string; shotIds: readonly string[] }
  >
> = {
  BASE: {
    label: "Basis-Pack",
    description:
      "Fünf praktische Start-Assets für Shop, Feed, Story und Kampagne.",
    shotIds: [
      "content:shopify-product-image",
      "content:lifestyle-with-model",
      "content:premium-flatlay",
      "content:hanger-or-rack",
      "content:social-hero-story",
    ],
  },
  WINNING_EXPANSION: {
    label: "Winning Design Expansion",
    description:
      "Manuell ausgelöste Erweiterung für ein bereits validiertes Artwork.",
    shotIds: [
      "content:clean-front",
      "content:clean-back",
      "content:premium-flatlay",
      "content:styled-flatlay",
      "content:hanger",
      "content:clothing-rack",
      "content:folded-product",
      "content:detail",
      "content:lifestyle-portrait",
      "content:lifestyle-full-body",
      "content:campaign-hero",
      "content:feed-post",
      "content:story-vertical",
      "content:carousel-cover",
      "content:product-highlight",
    ],
  },
};

export function contentShotById(id: string): ContentShotDefinition | null {
  return BY_ID.get(id) ?? null;
}

export function normalizeProductShotKind(
  productType: string | null | undefined,
): ProductShotKind {
  const value = productType?.trim().toLocaleLowerCase("de-DE") ?? "";
  if (
    /zip[ _-]?hood|zipper[ _-]?hood|reißverschluss.*hood|reissverschluss.*hood/.test(
      value,
    )
  )
    return "ZIP_HOODIE";
  if (/hood|kapuzen/.test(value)) return "HOODIE";
  if (/jogger|sweatpant/.test(value)) return "JOGGER";
  if (/t[ -]?shirt|tee\b/.test(value)) return "TSHIRT";
  if (/cap\b|hat\b|headwear|mütze|beanie/.test(value)) return "HEADWEAR";
  if (/pants|trouser|hose\b/.test(value)) return "PANTS";
  if (/jacket|jacke|blouson/.test(value)) return "JACKET";
  return "GENERIC";
}

export function isShotCompatible(
  shotId: string,
  productType: string | null | undefined,
): boolean {
  const definition = contentShotById(shotId);
  if (!definition) return true; // Existing custom plan remains available.
  return definition.compatibleProductKinds.includes(
    normalizeProductShotKind(productType),
  );
}

export function contentPackShots(
  packId: Exclude<ContentPackId, "CUSTOM">,
  productType?: string | null,
) {
  return CONTENT_PACKS[packId].shotIds
    .map(contentShotById)
    .filter((value): value is ContentShotDefinition => Boolean(value))
    .map((definition) => ({
      definition,
      compatible: isShotCompatible(definition.id, productType),
    }));
}

const SIDE_COUNTERPART_SHOTS: Readonly<
  Record<string, Partial<Record<"FRONT" | "BACK", string>>>
> = {
  "content:clean-front": { BACK: "content:clean-back" },
  "content:clean-back": { FRONT: "content:clean-front" },
  "content:shopify-product-image": { BACK: "content:clean-back" },
  "content:zip-open-front": { BACK: "content:clean-back" },
  "content:zip-closed-front": { BACK: "content:clean-back" },
};

/** Resolve one canonical shot for one side; never creates a second job. */
export function resolveContentShotForSide(
  shotId: string,
  side: "FRONT" | "BACK",
): ContentShotDefinition | null {
  const selected = contentShotById(shotId);
  if (!selected) return null;
  if (selected.supportedSides.includes(side)) return selected;
  const counterpartId = SIDE_COUNTERPART_SHOTS[shotId]?.[side];
  const counterpart = counterpartId ? contentShotById(counterpartId) : null;
  return counterpart?.supportedSides.includes(side) ? counterpart : null;
}

export function shotSupportsPrintSide(
  shotId: string,
  side: "FRONT" | "BACK",
): boolean {
  return resolveContentShotForSide(shotId, side) !== null;
}

export type ContentPackProgressStatus =
  "NOT_CREATED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
export interface ContentPackLineage {
  shotId: string;
  artworkId: string;
  artworkVersion: string;
  artworkChecksum: string;
  productProfileId: string;
  productProfileVersion: number;
  variantId: string | null;
  brandModelId: string;
  reviewStatus: "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | null;
}
export interface ContentPackProgressAuthority {
  artworkId: string;
  artworkVersion: string;
  artworkChecksum: string;
  productProfileId: string;
  productProfileVersion: number;
  variantId: string | null;
  brandModelId: string | null;
}

export function contentPackProgress(
  packId: Exclude<ContentPackId, "CUSTOM">,
  authority: ContentPackProgressAuthority | null,
  runs: ContentPackLineage[],
): Array<{ shot: ContentShotDefinition; status: ContentPackProgressStatus }> {
  return contentPackShots(packId).map(({ definition }) => {
    if (!authority) return { shot: definition, status: "NOT_CREATED" as const };
    const matching = runs.filter(
      (run) =>
        run.shotId === definition.id &&
        run.artworkId === authority.artworkId &&
        run.artworkVersion === authority.artworkVersion &&
        run.artworkChecksum === authority.artworkChecksum &&
        run.productProfileId === authority.productProfileId &&
        run.productProfileVersion === authority.productProfileVersion &&
        run.variantId === authority.variantId &&
        (!definition.requiresBrandModel ||
          run.brandModelId === authority.brandModelId),
    );
    const status = matching.some((run) => run.reviewStatus === "APPROVED")
      ? "APPROVED"
      : matching.some((run) => run.reviewStatus === "REVIEW_REQUIRED")
        ? "IN_REVIEW"
        : matching.some((run) => run.reviewStatus === "REJECTED")
          ? "REJECTED"
          : "NOT_CREATED";
    return { shot: definition, status };
  });
}

export const CONTENT_PACK_PROGRESS_LABELS: Record<
  ContentPackProgressStatus,
  string
> = {
  NOT_CREATED: "Nicht erstellt",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
};
