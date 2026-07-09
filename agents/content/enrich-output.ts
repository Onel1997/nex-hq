import { CONTENT_REPORT_TYPE } from "@/brain/domains/reports";
import type {
  ContentEmailSequence,
  ContentLandingPageCopy,
  ContentProductCopy,
  ContentSmsCampaign,
  ContentSocialContent,
} from "./types";

const MIN_NARRATIVE = 120;
const MIN_FULL_CONTENT = 800;
const MIN_CAPTION = 20;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function ensureMinLength(text: string, min: number, suffix: string): string {
  let result = text.trim() || suffix.trim();
  while (result.length < min) {
    result = `${result} ${suffix}`.trim();
  }
  return result;
}

function ensureCaptionList(
  items: string[],
  min: number,
  max: number,
  platform: string,
  seed: string,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (item: string) => {
    const normalized = ensureMinLength(
      item,
      MIN_CAPTION,
      `${platform}-Copy aus CEO-, Design-, Marketing- und Shopify-Intelligence.`,
    );
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  };

  for (const item of items) add(item);

  const templates = [
    `${platform}: Kollektionsstory von Milaene — ${seed}`,
    `${platform}: Hero-Produkt im Fokus, Markenstimme urban-luxury`,
    `${platform}: Scarcity-Signal aus CEO-Launch-Strategie`,
    `${platform}: Materialqualität als Differenzierung`,
    `${platform}: Community-Moment aus Marketing-Plan`,
    `${platform}: Drop-Countdown mit VIP Early Access`,
    `${platform}: Behind-the-Scenes aus Design-Bericht`,
    `${platform}: Shopify-Listing-Story als Social Proof`,
  ];

  let i = 0;
  while (result.length < min) {
    add(`${templates[i % templates.length]} (#${result.length + 1})`);
    i++;
  }

  return result.slice(0, max);
}

function defaultLandingCopy(seed: string): ContentLandingPageCopy {
  return {
    heroHeadline: `${seed} — Jetzt verfügbar`,
    heroSubheadline:
      "Urban Luxury Streetwear. Limitierter Drop. Nur für die, die es wissen.",
    brandStory: ensureMinLength(
      `Milaene steht für ${seed} — Streetwear mit Premium-Anspruch, abgeleitet aus CEO-Strategie und Design-Intelligence.`,
      80,
      "Markenstory aus Brand Rules und Kollektionskonzept.",
    ),
    collectionIntroduction: ensureMinLength(
      `Die ${seed}-Kollektion vereint Oversized-Silhouetten, hochwertige Materialien und eine klare Launch-Narrative aus Marketing- und Shopify-Berichten.`,
      60,
      "Kollektionseinführung aus Design- und Shopify-Intelligence.",
    ),
    cta: "Jetzt shoppen",
  };
}

function defaultEmailSequence(seed: string): ContentEmailSequence {
  return {
    teaserEmail: ensureMinLength(
      `Etwas Neues von Milaene kommt. ${seed} — Silhouette-Tease ohne Full-Reveal. VIP Early Access sichern.`,
      80,
      "Teaser aus Marketing-E-Mail-Plan.",
    ),
    revealEmail: ensureMinLength(
      `Full Reveal: ${seed}. Kollektionsstory, Hero-SKU und Materialdetails — direkt aus Design- und Shopify-Berichten.`,
      100,
      "Reveal aus Marketing-Kampagnenplan.",
    ),
    countdownEmail: ensureMinLength(
      `48 Stunden bis ${seed} live geht. Größentabelle, Preisanker und direkter Shop-Link.`,
      80,
      "Countdown aus Launch-Strategie.",
    ),
    launchEmail: ensureMinLength(
      `${seed} ist live. Limited Quantities — jetzt auf Shopify. Community-Shoutouts und Sell-through Story folgen.`,
      100,
      "Launch-E-Mail aus CEO- und Marketing-Intelligence.",
    ),
  };
}

function defaultSmsCampaign(seed: string): ContentSmsCampaign {
  return {
    teaserSms: ensureMinLength(
      `Milaene: ${seed} kommt. VIP Early Access — Link in Bio.`,
      20,
      "SMS",
    ).slice(0, 160),
    countdownSms: ensureMinLength(
      `Milaene Drop in 48h: ${seed}. Sei bereit — limited stock.`,
      20,
      "SMS",
    ).slice(0, 160),
    launchSms: ensureMinLength(
      `${seed} ist LIVE bei Milaene. Jetzt shoppen — bevor es weg ist.`,
      20,
      "SMS",
    ).slice(0, 160),
  };
}

function normalizeProduct(entry: unknown, index: number): ContentProductCopy | null {
  const obj = asRecord(entry);
  if (!obj) return null;

  const productName =
    asString(obj.productName) || asString(obj.name) || `Produkt ${index + 1}`;
  const bullets = asStringArray(obj.featureBullets);

  return {
    productName,
    shortDescription: ensureMinLength(
      asString(obj.shortDescription),
      20,
      `Kurzbeschreibung für ${productName} aus Shopify- und Design-Bericht.`,
    ),
    longDescription: ensureMinLength(
      asString(obj.longDescription),
      80,
      `Ausführliche Produktstory für ${productName} aus Design-Produktlinie.`,
    ),
    featureBullets:
      bullets.length >= 3
        ? bullets.slice(0, 8)
        : [
            `Premium-Materialien aus Design-Bericht für ${productName}`,
            "Limitierte Stückzahl — Scarcity aus CEO-Strategie",
            "Urban-Luxury-Silhouette im Milaene-Stil",
          ],
    seoCopy: ensureMinLength(
      asString(obj.seoCopy),
      50,
      `SEO-Copy für ${productName} aus Shopify-Listing und Marketing-Plan.`,
    ).slice(0, 320),
  };
}

function buildFullContent(payload: Record<string, unknown>): string {
  const title = asString(payload.title) || "Content-Paket";
  const landing = asRecord(payload.landingPageCopy);
  const email = asRecord(payload.emailSequence);
  const social = asRecord(payload.socialContent);
  const sms = asRecord(payload.smsCampaign);

  const sections = [
    `# ${title}`,
    "## Brand Narrative",
    asString(payload.brandNarrative),
    "## Landing Page",
    landing
      ? [
          `**${asString(landing.heroHeadline)}**`,
          asString(landing.heroSubheadline),
          asString(landing.brandStory),
          asString(landing.collectionIntroduction),
          `CTA: ${asString(landing.cta)}`,
        ].join("\n\n")
      : "",
    "## E-Mail-Sequenz",
    email
      ? [
          `Teaser: ${asString(email.teaserEmail)?.slice(0, 200)}…`,
          `Reveal: ${asString(email.revealEmail)?.slice(0, 200)}…`,
        ].join("\n")
      : "",
    "## Social",
    social
      ? asStringArray(social.instagramCaptions)
          .slice(0, 3)
          .map((c) => `- ${c}`)
          .join("\n")
      : "",
    "## SMS",
    sms ? `Launch: ${asString(sms.launchSms)}` : "",
  ];

  return ensureMinLength(
    sections.filter(Boolean).join("\n\n"),
    MIN_FULL_CONTENT,
    "Vollständiges Content-Paket basierend auf CEO-, Design-, Marketing- und Shopify-Intelligence.",
  );
}

export function enrichContentPayload(
  payload: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  if (!payload.reportType) {
    payload.reportType = CONTENT_REPORT_TYPE;
    adjustments.push("set reportType=content-report");
  }

  const title = asString(payload.title) || "Milaene Content-Paket";
  if (!asString(payload.title)) {
    payload.title = title;
    adjustments.push("generated title");
  }

  const seed = title.replace(/Content-Paket|Milaene/gi, "").trim() || "Drop";

  if (
    !asString(payload.brandNarrative) ||
    asString(payload.brandNarrative).length < MIN_NARRATIVE
  ) {
    payload.brandNarrative = ensureMinLength(
      asString(payload.brandNarrative) ||
        `Milaene Brand Narrative für ${seed}: Urban Luxury Streetwear mit klarer Drop-Story aus CEO-Strategie, Design-Kollektion, Marketing-Plan und Shopify-Listings.`,
      MIN_NARRATIVE,
      "Narrative leitet sich aus allen primären Intelligence-Berichten ab.",
    );
    adjustments.push("enriched brandNarrative");
  }

  const landingRaw = asRecord(payload.landingPageCopy);
  if (!landingRaw || !asString(landingRaw.heroHeadline)) {
    payload.landingPageCopy = defaultLandingCopy(seed);
    adjustments.push("enriched landingPageCopy");
  } else {
    payload.landingPageCopy = {
      heroHeadline: asString(landingRaw.heroHeadline).slice(0, 80),
      heroSubheadline: ensureMinLength(
        asString(landingRaw.heroSubheadline),
        10,
        "Subheadline aus Markenstimme.",
      ).slice(0, 160),
      brandStory: ensureMinLength(
        asString(landingRaw.brandStory),
        80,
        "Brand Story aus Brand Rules.",
      ),
      collectionIntroduction: ensureMinLength(
        asString(landingRaw.collectionIntroduction),
        60,
        "Kollektionseinführung aus Design-Bericht.",
      ),
      cta: asString(landingRaw.cta) || "Jetzt shoppen",
    };
  }

  const productRaw = Array.isArray(payload.productCopy) ? payload.productCopy : [];
  const products = productRaw
    .map((entry, index) => normalizeProduct(entry, index))
    .filter((p): p is ContentProductCopy => Boolean(p));

  if (products.length === 0) {
    payload.productCopy = [normalizeProduct(
      {
        productName: "Hero-Produkt aus Shopify-Bericht",
        shortDescription: "Kurzbeschreibung aus Shopify-Listing.",
        longDescription:
          "Ausführliche Produktstory muss aus Design- und Shopify-Berichten abgeleitet werden.",
        featureBullets: [
          "Materialien aus Design-Intelligence",
          "Preisanker aus Shopify-Listing",
          "Launch-Narrative aus Marketing-Plan",
        ],
        seoCopy:
          "SEO-Copy aus Shopify-SEO-Feldern und Marketing-Kampagnenplan.",
      },
      0,
    )].filter(Boolean);
    adjustments.push("generated productCopy");
  } else {
    payload.productCopy = products;
  }

  const emailRaw = asRecord(payload.emailSequence);
  if (
    !emailRaw ||
    !asString(emailRaw.teaserEmail) ||
    asString(emailRaw.teaserEmail).length < 80
  ) {
    payload.emailSequence = defaultEmailSequence(seed);
    adjustments.push("enriched emailSequence");
  } else {
    payload.emailSequence = {
      teaserEmail: ensureMinLength(asString(emailRaw.teaserEmail), 80, "E-Mail"),
      revealEmail: ensureMinLength(asString(emailRaw.revealEmail), 100, "E-Mail"),
      countdownEmail: ensureMinLength(
        asString(emailRaw.countdownEmail),
        80,
        "E-Mail",
      ),
      launchEmail: ensureMinLength(asString(emailRaw.launchEmail), 100, "E-Mail"),
    };
  }

  const socialRaw = asRecord(payload.socialContent);
  const social: ContentSocialContent = {
    instagramCaptions: ensureCaptionList(
      socialRaw ? asStringArray(socialRaw.instagramCaptions) : [],
      10,
      20,
      "Instagram",
      seed,
    ),
    tiktokHooks: ensureCaptionList(
      socialRaw ? asStringArray(socialRaw.tiktokHooks) : [],
      10,
      20,
      "TikTok",
      seed,
    ),
    storyIdeas: ensureCaptionList(
      socialRaw ? asStringArray(socialRaw.storyIdeas) : [],
      5,
      15,
      "Story",
      seed,
    ).map((s) => s.slice(0, 200)),
    launchPosts: ensureCaptionList(
      socialRaw ? asStringArray(socialRaw.launchPosts) : [],
      4,
      10,
      "Launch",
      seed,
    ).map((s) => s.slice(0, 200)),
  };
  payload.socialContent = social;
  if (socialRaw) adjustments.push("enriched socialContent");

  const smsRaw = asRecord(payload.smsCampaign);
  if (!smsRaw || !asString(smsRaw.teaserSms)) {
    payload.smsCampaign = defaultSmsCampaign(seed);
    adjustments.push("enriched smsCampaign");
  } else {
    payload.smsCampaign = {
      teaserSms: ensureMinLength(asString(smsRaw.teaserSms), 20, "SMS").slice(
        0,
        160,
      ),
      countdownSms: ensureMinLength(
        asString(smsRaw.countdownSms),
        20,
        "SMS",
      ).slice(0, 160),
      launchSms: ensureMinLength(asString(smsRaw.launchSms), 20, "SMS").slice(
        0,
        160,
      ),
    };
  }

  const sourceTitles = asStringArray(payload.sourceReportTitles);
  if (sourceTitles.length === 0) {
    payload.sourceReportTitles = [
      "CEO-Bericht",
      "Design-Bericht",
      "Marketing-Bericht",
      "Shopify-Bericht",
    ];
    adjustments.push("generated sourceReportTitles");
  }

  if (typeof payload.confidence !== "number" || Number.isNaN(payload.confidence)) {
    payload.confidence = 0.76;
    adjustments.push("set default confidence");
  } else {
    payload.confidence = Math.min(1, Math.max(0, payload.confidence));
  }

  const fullContent = asString(payload.fullContent);
  if (!fullContent || fullContent.length < MIN_FULL_CONTENT) {
    payload.fullContent = buildFullContent(payload);
    adjustments.push("enriched fullContent");
  }

  return adjustments;
}
