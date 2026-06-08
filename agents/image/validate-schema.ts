/**
 * Full schema validation test for Image Agent V2 output.
 * Run: npx tsx agents/image/validate-schema.ts
 */
import { ADVANCED_ASSET_SPECS, CORE_ASSET_SPECS } from "./asset-specs";
import { buildV2ImageOutput } from "./enrich-packages";
import { formatAssetTitle } from "./collection-identity";
import { imageOutputSchema } from "./normalized";

const COLLECTION = "Urban Echoes";

const REQUIRED_FIELDS = [
  "corePackage",
  "advancedPackage",
  "moodboard",
  "palette",
  "campaignShots",
  "sourceReportTitles",
  "fullProject",
  "confidence",
] as const;

function minimalValidAsset(
  id: string,
  type: string,
  pkg: "core" | "advanced",
  title: string,
  variant?: string,
) {
  const prompt =
    "35mm full-frame editorial photograph, 50mm f/1.4, three-quarter composition, soft overcast urban daylight, obsidian and concrete palette with signal green accent, structured streetwear styling, concrete architecture backdrop, urban luxury mood, reference Tyrone LeBon SSENSE campaign aesthetic.";
  return {
    id,
    title,
    type,
    package: pkg,
    dimensions: "1920x1080",
    platform: "website",
    variant,
    purpose: "Authoritative production asset for schema validation test.",
    prompt: { midjourney: prompt, openai: prompt, flux: prompt },
    status: "ready",
  };
}

function minimalValidPayload(): Record<string, unknown> {
  const prompt =
    "35mm full-frame editorial photograph, 50mm f/1.4, three-quarter composition, soft overcast urban daylight, obsidian and concrete palette with signal green accent, structured streetwear styling, concrete architecture backdrop, urban luxury mood, reference Tyrone LeBon SSENSE campaign aesthetic.";

  const core = CORE_ASSET_SPECS.map((spec) =>
    minimalValidAsset(
      spec.id,
      spec.type,
      "core",
      formatAssetTitle(COLLECTION, spec.title),
      spec.variant,
    ),
  );
  const advanced = ADVANCED_ASSET_SPECS.map((spec) =>
    minimalValidAsset(
      spec.id,
      spec.type,
      "advanced",
      formatAssetTitle(COLLECTION, spec.title),
      spec.variant,
    ),
  );

  const shots = Array.from({ length: 12 }, (_, i) => ({
    shotName: formatAssetTitle(COLLECTION, `Shot ${i + 1}`),
    shotType: "editorial_portrait",
    location: "Urban rooftop with concrete industrial backdrop",
    styling: "Obsidian and concrete palette, signal green accent, premium streetwear",
    purpose: `Production shot ${i + 1} for campaign launch strategy and content calendar`,
  }));

  const fullProject = [
    `# ${COLLECTION} Creative Production`,
    "## Creative Direction",
    "Urban luxury streetwear with editorial confidence derived from CEO, design, content and marketing intelligence.",
    "## Core Package",
    ...core.map((item) => `- **${item.title}**`),
    "## Advanced Package",
    ...advanced.map((item) => `- ${item.title}`),
    "## Campaign Shot List",
    ...shots.map((s) => `- ${s.shotName}`),
    "Extended production notes for creative team handoff and asset generation pipeline.",
  ].join("\n\n");

  return {
    title: `${COLLECTION} Creative Production`,
    reportType: "image-project",
    schemaVersion: "2.0",
    projectName: `${COLLECTION} Creative Production`,
    collectionName: COLLECTION,
    moodboard: {
      visualDirection:
        "Urban luxury streetwear with editorial confidence, scarcity drop energy, and premium material focus across every touchpoint.",
      aestheticKeywords: ["urban luxury", "minimal streetwear", "premium materials"],
      colorSystem: ["Obsidian Black #111111", "Signal Green #6FBF73"],
      materialReferences: ["Heavyweight organic cotton fleece", "Brushed cotton twill"],
      photographyStyle:
        "Editorial streetwear photography with natural urban light and shallow depth of field.",
    },
    palette: {
      primary: "Obsidian Black #111111",
      secondary: "Concrete Grey #888888",
      accent: "Signal Green #6FBF73",
      background: "Off-White #F5F5F0",
      text: "Charcoal #2A2A2A",
    },
    corePackage: core,
    advancedPackage: advanced,
    campaignShots: shots,
    confidence: 0.85,
    sourceReportTitles: ["CEO Report", "Design Report"],
    fullProject: fullProject.padEnd(600, "."),
    prompt,
  };
}

const FIXTURES: Array<{ name: string; payload: Record<string, unknown> }> = [
  { name: "valid V2 baseline", payload: minimalValidPayload() },
  {
    name: "legacy string moodboard",
    payload: { ...minimalValidPayload(), moodboard: "Urban Summer Vibes" },
  },
  {
    name: "mixed collection names in titles",
    payload: {
      ...minimalValidPayload(),
      corePackage: CORE_ASSET_SPECS.map((spec) =>
        minimalValidAsset(
          spec.id,
          spec.type,
          "core",
          `Summer Collection — ${spec.title}`,
          spec.variant,
        ),
      ),
      advancedPackage: ADVANCED_ASSET_SPECS.map((spec) =>
        minimalValidAsset(
          spec.id,
          spec.type,
          "advanced",
          `Drop — ${spec.title}`,
          spec.variant,
        ),
      ),
    },
  },
  {
    name: "duplicate hero and mockup assets",
    payload: {
      ...minimalValidPayload(),
      corePackage: [
        ...CORE_ASSET_SPECS.map((spec) =>
          minimalValidAsset(spec.id, spec.type, "core", `Wrong — ${spec.title}`, spec.variant),
        ),
        minimalValidAsset("core-hero-banner-dup", "hero_banner", "core", "Drop — Hero Banner"),
        minimalValidAsset(
          "core-mockup-flat_lay-dup",
          "product_mockup",
          "core",
          "Drop — Flat Lay",
          "flat_lay",
        ),
      ],
    },
  },
  {
    name: "legacy-only top-level fields",
    payload: {
      title: "Milaene Creative Production",
      reportType: "image-project",
      projectName: "Milaene Creative Production",
      collectionName: COLLECTION,
      moodboard: "Street Culture Drop",
      palette: [
        { name: "Black", hex: "#000000" },
        { name: "Grey", hex: "#808080" },
        { name: "Green", hex: "#00FF00" },
        { name: "White", hex: "#FFFFFF" },
        { name: "Dark", hex: "#222222" },
      ],
      heroBanner: {
        headline: "Drop Hero",
        subheadline: "Limited release",
        visualDirection: "Urban editorial",
        openaiPrompt: promptStub(),
        fluxPrompt: promptStub(),
        midjourneyPrompt: promptStub(),
      },
      productMockups: [
        {
          name: "Hero Hoodie",
          conceptType: "hero_product",
          description: "Primary product mockup for drop hero",
          prompts: {
            midjourney: promptStub(),
            openai: promptStub(),
            flux: promptStub(),
          },
          dimensions: "1536x2048",
        },
      ],
      campaignVisuals: [],
      confidence: 0.75,
      sourceReportTitles: ["CEO Report"],
      fullProject: "x".repeat(600),
    },
  },
];

function promptStub(): string {
  return "35mm full-frame editorial photograph, 50mm f/1.4, three-quarter composition, soft overcast urban daylight, obsidian palette, structured streetwear, concrete backdrop, urban luxury mood, Tyrone LeBon SSENSE reference aesthetic.";
}

function assertNaming(
  payload: Record<string, unknown>,
  label: string,
): string[] {
  const issues: string[] = [];
  const banned = [/drop/i, /summer collection/i, /^collection$/i, /^project$/i];
  const assets = [
    ...(Array.isArray(payload.corePackage) ? payload.corePackage : []),
    ...(Array.isArray(payload.advancedPackage) ? payload.advancedPackage : []),
  ];

  for (const asset of assets) {
    const obj = asset as Record<string, unknown>;
    const title = String(obj.title ?? "");
    if (!title.startsWith(`${COLLECTION} —`)) {
      issues.push(`${label}: title "${title}" does not use "${COLLECTION} —" prefix`);
    }
    for (const pattern of banned) {
      if (pattern.test(title) && !title.startsWith(`${COLLECTION} —`)) {
        issues.push(`${label}: banned generic name in "${title}"`);
      }
    }
  }

  if (payload.corePackage && Array.isArray(payload.corePackage)) {
    if (payload.corePackage.length !== CORE_ASSET_SPECS.length) {
      issues.push(
        `${label}: corePackage has ${payload.corePackage.length} assets, expected ${CORE_ASSET_SPECS.length}`,
      );
    }
  }
  if (payload.advancedPackage && Array.isArray(payload.advancedPackage)) {
    if (payload.advancedPackage.length !== ADVANCED_ASSET_SPECS.length) {
      issues.push(
        `${label}: advancedPackage has ${payload.advancedPackage.length} assets, expected ${ADVANCED_ASSET_SPECS.length}`,
      );
    }
  }

  return issues;
}

function printZodIssues(fixtureName: string, issues: { issues: Array<{ path: PropertyKey[]; message: string }> }["issues"]): void {
  if (issues.length === 0) {
    console.log(`  ✓ ${fixtureName}: no schema issues`);
    return;
  }
  console.log(`  ✗ ${fixtureName}: ${issues.length} issue(s)`);
  for (const issue of issues) {
    const path = issue.path.length
      ? issue.path.map(String).join(".")
      : "(root)";
    console.log(`    - [${path}] ${issue.message}`);
  }
}

function main(): void {
  console.log("=== Image Project Schema Validation Test ===\n");

  let totalIssues = 0;
  const namingIssues: string[] = [];

  for (const fixture of FIXTURES) {
    const working = structuredClone(fixture.payload);
    const v2 = buildV2ImageOutput(working, {
      collectionIdentity: {
        collectionName: COLLECTION,
        campaignName: COLLECTION,
        projectName: `${COLLECTION} Creative Production`,
      },
    });
    const result = imageOutputSchema.safeParse(v2);

    namingIssues.push(...assertNaming(v2, fixture.name));

    for (const field of REQUIRED_FIELDS) {
      if (v2[field] === undefined) {
        namingIssues.push(`${fixture.name}: missing required field "${field}"`);
      }
    }

    if (!result.success) {
      console.error("IMAGE PROJECT VALIDATION ERRORS", result.error.flatten());
      printZodIssues(fixture.name, result.error.issues);
      totalIssues += result.error.issues.length;
    } else {
      printZodIssues(fixture.name, []);
    }
  }

  console.log("\n=== Naming & Package Assertions ===");
  if (namingIssues.length === 0) {
    console.log(`  ✓ All assets use "${COLLECTION} — {Asset Type}" naming`);
    console.log(`  ✓ Core: ${CORE_ASSET_SPECS.length} assets, Advanced: ${ADVANCED_ASSET_SPECS.length} assets`);
  } else {
    for (const issue of namingIssues) {
      console.log(`  ✗ ${issue}`);
    }
  }

  console.log("\n=== Summary ===");
  if (totalIssues === 0 && namingIssues.length === 0) {
    console.log("All fixtures passed.");
    process.exit(0);
  }

  console.log(
    `Remaining issues: ${totalIssues} Zod, ${namingIssues.length} naming/package`,
  );
  process.exit(1);
}

main();
