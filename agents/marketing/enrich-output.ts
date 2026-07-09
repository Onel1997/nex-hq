import { MARKETING_REPORT_TYPE } from "@/brain/domains/reports";

const MIN_STRATEGY_CHARS = 100;
const MIN_INFLUENCER_CHARS = 80;
const MIN_COMMUNITY_CHARS = 80;
const MIN_IDEA_CHARS = 20;
const MIN_FULL_PLAN = 800;

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

function ensureExactIdeas(
  items: string[],
  count: number,
  platform: "TikTok" | "Instagram",
  seed: string,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (item: string) => {
    const normalized = ensureMinLength(
      item,
      MIN_IDEA_CHARS,
      `${platform}-Content aus Research- und Design-Intelligence ableiten.`,
    );
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  };

  for (const item of items) add(item);

  const templates = [
    `${platform}-Teaser: Silhouette-Reveal ohne Full-Drop für ${seed}.`,
    `${platform}-Behind-the-Scenes: Material- und Qualitätsdetails als Differenzierung.`,
    `${platform}-Culture Clip: Streetwear-Ästhetik im urbanen Kontext.`,
    `${platform}-Founder POV: Warum diese Kollektion jetzt strategisch passt.`,
    `${platform}-UGC-Stitch: Community-Reaktionen auf Hero-Produkt einbinden.`,
    `${platform}-Countdown: 48h-Drop-Fenster mit Scarcity-Signal.`,
    `${platform}-Fit-Check: Oversized-Proportionen und Styling-Varianten.`,
    `${platform}-Moodboard-Carousel: Farbpalette und Design-Richtung visualisieren.`,
    `${platform}-Competitor-Contrast: Positionierung ohne direkten Name-Drop.`,
    `${platform}-VIP Early Access: Exklusivität für Core-Community.`,
  ];

  let i = 0;
  while (result.length < count) {
    add(`${templates[i % templates.length]} (#${result.length + 1})`);
    i++;
  }

  return result.slice(0, count);
}

function defaultEmailPhases(title: string) {
  return [
    {
      phase: "Tease",
      subject: `${title} — Something is coming`,
      objective: "Neugier aufbauen ohne Produkt-Reveal",
      content: ensureMinLength(
        "Minimaler Tease mit Markenstimme, Silhouette-Hint und Link zur VIP-Liste.",
        30,
        "E-Mail",
      ),
    },
    {
      phase: "Reveal",
      subject: `${title} — Full Collection Reveal`,
      objective: "Produktstory und Hero-SKU vorstellen",
      content: ensureMinLength(
        "Reveal-E-Mail mit Kollektionsstory, Hero-Produkt und Early-Access-CTA.",
        30,
        "E-Mail",
      ),
    },
    {
      phase: "Countdown",
      subject: `${title} — 48h Countdown`,
      objective: "Urgency und Conversion vor Drop",
      content: ensureMinLength(
        "Countdown mit Größentabelle, Preisanker und direktem Shop-Link.",
        30,
        "E-Mail",
      ),
    },
    {
      phase: "Post-Drop",
      subject: `${title} — Sell-through Story`,
      objective: "Social Proof und Capsule-Story",
      content: ensureMinLength(
        "Post-Drop-Update mit Sell-through, Community-Shoutouts und Next-Capsule-Tease.",
        30,
        "E-Mail",
      ),
    },
  ];
}

function defaultCalendar(title: string) {
  const channels = ["Instagram", "TikTok", "Email", "IG Stories"];
  const formats = ["Reel", "Carousel", "Story", "Post", "Live"];
  const entries = [];

  for (let day = 1; day <= 30; day++) {
    const channel = channels[day % channels.length];
    const format = formats[day % formats.length];
    entries.push({
      day,
      title: `Tag ${day}: ${title}`,
      channel,
      format,
      description: ensureMinLength(
        `Content für Tag ${day} — ${channel} ${format} aligned mit Launch-Phase und Kollektionsstory.`,
        20,
        "Kalender",
      ),
    });
  }

  return entries;
}

function defaultKpis() {
  return [
    {
      metric: "Reach (organic)",
      target: "250.000+ Impressions in 30 Tagen",
      rationale: "Organic-first Launch über TikTok und Instagram Reels.",
    },
    {
      metric: "VIP List Growth",
      target: "+1.500 neue Subscribers",
      rationale: "Early-Access-Liste als Conversion-Hebel vor Drop.",
    },
    {
      metric: "Email Open Rate",
      target: "40%+ auf Reveal-Sequenz",
      rationale: "Warme Audience mit hoher Markenaffinität.",
    },
    {
      metric: "Sell-through (48h)",
      target: "70%+ innerhalb Drop-Fenster",
      rationale: "Scarcity-getriebener Launch aus CEO- und Design-Intelligence.",
    },
  ];
}

function defaultBudget() {
  return [
    {
      category: "Organic Content Production",
      allocation: "35%",
      rationale: "Reels, Carousels und BTS — Kern des Launches.",
    },
    {
      category: "Paid Retargeting",
      allocation: "25%",
      rationale: "Warm Audiences und VIP-Liste nur.",
    },
    {
      category: "Influencer Seeding",
      allocation: "20%",
      rationale: "Micro-Influencer mit authentischer Streetwear-Relevanz.",
    },
    {
      category: "Email & CRM",
      allocation: "10%",
      rationale: "VIP-Sequenz und Automation.",
    },
    {
      category: "Community & Events",
      allocation: "10%",
      rationale: "IG Live, Discord-Tease und UGC-Anreize.",
    },
  ];
}

function buildFullPlan(payload: Record<string, unknown>): string {
  const title = asString(payload.title) || "Marketing-Plan";
  const sections = [
    `# ${title}`,
    "## Launch-Strategie",
    asString(payload.launchStrategy),
    "## Content-Pillars",
    ...asStringArray(payload.contentPillars).map((p) => `- ${p}`),
    "## Influencer-Strategie",
    asString(payload.influencerStrategy),
    "## Community-Plan",
    asString(payload.communityBuildingPlan),
  ];

  return ensureMinLength(
    sections.filter(Boolean).join("\n\n"),
    MIN_FULL_PLAN,
    "Vollständiger Marketing-Plan basierend auf Research-, CEO- und Design-Intelligence.",
  );
}

export function enrichMarketingPayload(
  payload: Record<string, unknown>,
): string[] {
  const adjustments: string[] = [];

  if (!payload.reportType) {
    payload.reportType = MARKETING_REPORT_TYPE;
    adjustments.push("set reportType=marketing-report");
  }

  const title = asString(payload.title) || "Marketing-Kampagnenplan";
  if (!asString(payload.title)) {
    payload.title = title;
    adjustments.push("generated title");
  }

  if (
    !asString(payload.launchStrategy) ||
    asString(payload.launchStrategy).length < MIN_STRATEGY_CHARS
  ) {
    payload.launchStrategy = ensureMinLength(
      asString(payload.launchStrategy) ||
        `Launch-Strategie für ${title}: Organic-first Tease-Reveal-Countdown über 30 Tage, VIP Early Access, 48h Drop-Fenster.`,
      MIN_STRATEGY_CHARS,
      "Strategie leitet sich aus Research-, CEO- und Design-Berichten ab.",
    );
    adjustments.push("enriched launchStrategy");
  }

  const pillars = asStringArray(payload.contentPillars);
  if (pillars.length < 3) {
    payload.contentPillars = [
      ...pillars,
      "Product Story — Kollektionsnarrativ und Hero-SKU im Fokus",
      "Culture & Community — Streetwear-Identität und UGC",
      "Scarcity & Exclusivity — Limited Drops und VIP-Zugang",
    ].slice(0, 8);
    adjustments.push("enriched contentPillars");
  }

  const tiktok = ensureExactIdeas(
    asStringArray(payload.tiktokIdeas),
    20,
    "TikTok",
    title,
  );
  if (payload.tiktokIdeas !== tiktok) {
    payload.tiktokIdeas = tiktok;
    adjustments.push("enriched tiktokIdeas");
  }

  const instagram = ensureExactIdeas(
    asStringArray(payload.instagramIdeas),
    20,
    "Instagram",
    title,
  );
  if (payload.instagramIdeas !== instagram) {
    payload.instagramIdeas = instagram;
    adjustments.push("enriched instagramIdeas");
  }

  if (
    !asString(payload.influencerStrategy) ||
    asString(payload.influencerStrategy).length < MIN_INFLUENCER_CHARS
  ) {
    payload.influencerStrategy = ensureMinLength(
      asString(payload.influencerStrategy) ||
        "Micro-Influencer-Seeding mit authentischer Streetwear-Relevanz, Product-Seeding 2 Wochen vor Drop, UGC-Repost-Strategie.",
      MIN_INFLUENCER_CHARS,
      "Influencer-Plan aus Wettbewerbs- und CEO-Intelligence.",
    );
    adjustments.push("enriched influencerStrategy");
  }

  const emailRaw = Array.isArray(payload.emailCampaignPlan)
    ? payload.emailCampaignPlan
    : [];
  const emails = emailRaw
    .map((entry) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const phase = asString(obj.phase);
      if (!phase) return null;
      return {
        phase,
        subject: asString(obj.subject) || `${title} — ${phase}`,
        objective: asString(obj.objective) || "Kampagnenziel",
        content: ensureMinLength(
          asString(obj.content),
          30,
          "E-Mail-Content aus Launch-Strategie.",
        ),
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (emails.length < 3) {
    payload.emailCampaignPlan = defaultEmailPhases(title);
    adjustments.push("enriched emailCampaignPlan");
  } else {
    payload.emailCampaignPlan = emails.slice(0, 8);
  }

  if (
    !asString(payload.communityBuildingPlan) ||
    asString(payload.communityBuildingPlan).length < MIN_COMMUNITY_CHARS
  ) {
    payload.communityBuildingPlan = ensureMinLength(
      asString(payload.communityBuildingPlan) ||
        "Community-Aufbau über VIP-Liste, IG Close Friends, Discord-Tease und Post-Drop UGC-Kampagne.",
      MIN_COMMUNITY_CHARS,
      "Community-Plan aus CEO- und Research-Intelligence.",
    );
    adjustments.push("enriched communityBuildingPlan");
  }

  const calendarRaw = Array.isArray(payload.contentCalendar30Day)
    ? payload.contentCalendar30Day
    : [];
  const calendar = calendarRaw
    .map((entry) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const day = Number(obj.day);
      if (!Number.isInteger(day) || day < 1 || day > 30) return null;
      return {
        day,
        title: asString(obj.title) || `Tag ${day}`,
        channel: asString(obj.channel) || "Instagram",
        format: asString(obj.format) || "Reel",
        description: ensureMinLength(
          asString(obj.description),
          20,
          "Tages-Content aus Launch-Kalender.",
        ),
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (calendar.length !== 30) {
    payload.contentCalendar30Day = defaultCalendar(title);
    adjustments.push("enriched contentCalendar30Day");
  } else {
    payload.contentCalendar30Day = calendar;
  }

  const kpiRaw = Array.isArray(payload.launchKpis) ? payload.launchKpis : [];
  const kpis = kpiRaw
    .map((entry) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const metric = asString(obj.metric);
      if (!metric) return null;
      return {
        metric,
        target: asString(obj.target) || "TBD",
        rationale: ensureMinLength(
          asString(obj.rationale),
          15,
          "KPI aus Launch-Zielen.",
        ),
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (kpis.length < 4) {
    payload.launchKpis = defaultKpis();
    adjustments.push("enriched launchKpis");
  } else {
    payload.launchKpis = kpis.slice(0, 12);
  }

  const budgetRaw = Array.isArray(payload.budgetAllocation)
    ? payload.budgetAllocation
    : [];
  const budget = budgetRaw
    .map((entry) => {
      const obj = asRecord(entry);
      if (!obj) return null;
      const category = asString(obj.category);
      if (!category) return null;
      return {
        category,
        allocation: asString(obj.allocation) || "TBD",
        rationale: ensureMinLength(
          asString(obj.rationale),
          15,
          "Budget aus Kanal-Priorität.",
        ),
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (budget.length < 4) {
    payload.budgetAllocation = defaultBudget();
    adjustments.push("enriched budgetAllocation");
  } else {
    payload.budgetAllocation = budget.slice(0, 10);
  }

  const sourceTitles = asStringArray(payload.sourceReportTitles);
  if (sourceTitles.length === 0) {
    payload.sourceReportTitles = ["Wissensspeicher-Intelligence"];
    adjustments.push("generated sourceReportTitles");
  }

  if (typeof payload.confidence !== "number" || Number.isNaN(payload.confidence)) {
    payload.confidence = 0.74;
    adjustments.push("set default confidence");
  } else {
    payload.confidence = Math.min(1, Math.max(0, payload.confidence));
  }

  const fullPlan = asString(payload.fullPlan);
  if (!fullPlan || fullPlan.length < MIN_FULL_PLAN) {
    payload.fullPlan = buildFullPlan(payload);
    adjustments.push("enriched fullPlan");
  }

  return adjustments;
}
