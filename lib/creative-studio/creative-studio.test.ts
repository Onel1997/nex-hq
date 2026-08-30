import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CREATIVE_BATCH_SIZES,
  CREATIVE_GLOBAL_REFERENCE_LIMIT,
  CREATIVE_REFERENCE_ROLES,
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  creativeGenerationSetupSchema,
  type CreativeRun,
  type SavedCreativePrompt,
} from "@/lib/creative-studio/contracts";
import {
  CREATIVE_MODEL_REGISTRY,
  creativeModelById,
} from "@/lib/creative-studio/model-registry";
import {
  CreativeProviderNotConnectedError,
  executeCreativeGeneration,
  type CreativeImageProvider,
} from "@/lib/creative-studio/provider";
import {
  CREATIVE_STUDIO_STORAGE_KEY,
  loadCreativeStudioState,
  removeCreativePrompt,
  saveCreativeStudioState,
  upsertCreativePrompt,
  upsertCreativeRun,
  type CreativeStorage,
} from "@/lib/creative-studio/persistence";

function setup() {
  return creativeGenerationSetupSchema.parse({
    contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
    prompt: "Erstelle ein hochwertiges Streetwear-Kampagnenbild.",
    modelId: "nano-banana-pro",
    aspectRatio: "4:5",
    quality: "2K",
    batchSize: 2,
    outputType: "CAMPAIGN",
    references: [
      {
        id: "ref-design",
        name: "design.png",
        mimeType: "image/png",
        byteLength: 2048,
        role: "DESIGN",
        order: 0,
      },
      {
        id: "ref-free",
        name: "inspiration.webp",
        mimeType: "image/webp",
        byteLength: 4096,
        role: "NONE",
        order: 1,
      },
    ],
    advanced: DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  });
}

function memoryStorage(): CreativeStorage & { value: string | null } {
  return {
    value: null,
    getItem(key) {
      return key === CREATIVE_STUDIO_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === CREATIVE_STUDIO_STORAGE_KEY) this.value = value;
    },
  };
}

test("flexible reference contract keeps roles optional and prompt authoritative", () => {
  const parsed = setup();
  assert.equal(parsed.references.length, 2);
  assert.equal(parsed.references[1]?.role, "NONE");
  assert.ok(CREATIVE_REFERENCE_ROLES.includes("IDENTITY"));
  assert.ok(CREATIVE_REFERENCE_ROLES.includes("PRODUCT"));
  assert.ok(CREATIVE_REFERENCE_ROLES.includes("SCENE"));
  assert.equal(parsed.prompt.includes("Streetwear"), true);
});

test("global reference contract accepts fourteen metadata-only references and rejects oversized setups", () => {
  const references = Array.from({ length: CREATIVE_GLOBAL_REFERENCE_LIMIT }, (_, index) => ({
    id: `ref-${index}`,
    name: `referenz-${index}.png`,
    mimeType: "image/png",
    byteLength: 1024 + index,
    role: "NONE" as const,
    order: index,
  }));
  const base = setup();
  assert.equal(
    creativeGenerationSetupSchema.parse({ ...base, references }).references.length,
    14,
  );
  assert.equal(
    creativeGenerationSetupSchema.safeParse({
      ...base,
      references: [...references, { ...references[0], id: "ref-14", order: 14 }],
    }).success,
    false,
  );
});

test("model registry is provider-neutral and exposes all planned owner choices", () => {
  assert.deepEqual(
    CREATIVE_MODEL_REGISTRY.map((model) => model.name),
    [
      "GPT Image",
      "Higgsfield Soul",
      "Higgsfield Soul Cinema",
      "Seedream",
      "Recraft",
      "Nano Banana Pro",
    ],
  );
  assert.equal(creativeModelById("gpt-image")?.providerId, "openai");
  assert.equal(creativeModelById("nano-banana-pro")?.providerId, "fal");
  assert.equal(
    creativeModelById("nano-banana-pro")?.providerModelId,
    "fal-ai/nano-banana-pro/edit",
  );
  assert.equal(creativeModelById("nano-banana-pro")?.availability, "LIVE");
  assert.equal(creativeModelById("gpt-image")?.maximumReferences, 14);
  assert.equal(CREATIVE_MODEL_REGISTRY.every((model) => model.supportsReferences), true);
  assert.equal(
    CREATIVE_MODEL_REGISTRY.every((model) => model.supportedQualities.length > 0),
    true,
  );
});

test("prompt library and history persist, update, duplicate and delete without a migration", () => {
  const storage = memoryStorage();
  const timestamp = "2026-08-27T13:00:00.000Z";
  const prompt: SavedCreativePrompt = {
    id: "prompt-1",
    title: "Parkhaus Hero",
    description: "Lifestyle-Kampagne",
    tags: ["Streetwear"],
    favorite: true,
    prompt: setup().prompt,
    modelId: "gpt-image",
    aspectRatio: "4:5",
    quality: "2K",
    batchSize: 2,
    outputType: "CAMPAIGN",
    advanced: {
      ...DEFAULT_CREATIVE_ADVANCED_SETTINGS,
      styleStrength: 0.91,
      seed: 1204,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUsedAt: null,
  };
  const run: CreativeRun = {
    id: "run-1",
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "PROVIDER_NOT_CONNECTED",
    setup: setup(),
    results: [],
    message: "Keine kostenpflichtige Ausführung.",
  };

  let state = upsertCreativePrompt(loadCreativeStudioState(storage), prompt);
  state = upsertCreativeRun(state, run);
  saveCreativeStudioState(storage, state);
  const restored = loadCreativeStudioState(storage);
  assert.equal(restored.prompts[0]?.title, "Parkhaus Hero");
  assert.equal(restored.prompts[0]?.modelId, "gpt-image");
  assert.equal(restored.prompts[0]?.aspectRatio, "4:5");
  assert.equal(restored.prompts[0]?.quality, "2K");
  assert.equal(restored.prompts[0]?.batchSize, 2);
  assert.equal(restored.prompts[0]?.outputType, "CAMPAIGN");
  assert.equal(restored.prompts[0]?.advanced?.styleStrength, 0.91);
  assert.equal(restored.prompts[0]?.advanced?.seed, 1204);
  assert.equal(restored.runs[0]?.setup.references[0]?.id, "ref-design");
  assert.equal(removeCreativePrompt(restored, "prompt-1").prompts.length, 0);
});

test("unconnected models fail truthfully without invoking a provider", async () => {
  let providerCalls = 0;
  await assert.rejects(
    executeCreativeGeneration({
      request: {
        clientRequestId: "request-1",
        setup: { ...setup(), modelId: "gpt-image" },
        references: [],
      },
      providers: [],
    }),
    (error) => error instanceof CreativeProviderNotConnectedError,
  );
  assert.equal(providerCalls, 0);

  const provider: CreativeImageProvider = {
    providerId: "openai",
    isConfigured: () => true,
    async generate() {
      providerCalls += 1;
      return {
        provider: "openai",
        providerModel: "mock",
        providerRequestId: "mock-request",
        providerPrompt: setup().prompt,
        referenceOrder: [],
        results: [],
      };
    },
  };
  await executeCreativeGeneration({
    request: {
      clientRequestId: "request-2",
      setup: { ...setup(), modelId: "gpt-image" },
      references: [],
    },
    providers: [provider],
  });
  assert.equal(providerCalls, 1);
});

test("Creative Studio is a separate German route and does not import Image Studio runtime", () => {
  const page = readFileSync("app/(dashboard)/creative-studio/page.tsx", "utf8");
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const controls = readFileSync(
    "components/creative-studio/creative-studio-controls.tsx",
    "utf8",
  );
  const library = readFileSync(
    "components/creative-studio/creative-studio-library.tsx",
    "utf8",
  );
  const creativeSource = page + workspace + controls + library;
  assert.match(page, /CreativeStudioWorkspace/);
  assert.doesNotMatch(creativeSource, /deterministic-runtime\/service/);
  assert.match(creativeSource, /Referenzbilder/);
  assert.match(creativeSource, /Seitenverhältnis/);
  assert.match(creativeSource, /Prompt-Bibliothek/);
  assert.match(creativeSource, /Generieren/);
  assert.match(creativeSource, /Schnelleinstellungen/);
  assert.match(creativeSource, /Modelle durchsuchen/);
  assert.match(creativeSource, /Ergebnisse erscheinen hier/);
  assert.doesNotMatch(creativeSource, /\/agents\/image|prepare\/estimate\/confirm/i);
});

test("mobile-first stylesheet preserves touch targets, safe area and compact breakpoints", () => {
  const css = readFileSync("app/creative-studio.css", "utf8");
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /\.cs-quick-bar/);
  assert.match(css, /\.cs-anchored-popover/);
  assert.doesNotMatch(css, /\.cs-model-sheet|\.cs-choice-sheet/);
});

test("mobile sticky action contains only the centered Generate CTA", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const sticky = workspace.match(
    /<div className="cs-quick-bar"[\s\S]*?<\/div>/,
  )?.[0];
  assert.ok(sticky);
  assert.match(sticky, /className="cs-generate-button"/);
  assert.match(sticky, /"Generieren"/);
  assert.doesNotMatch(sticky, /QuickControlButtons/);
  assert.doesNotMatch(sticky, /aspectRatio|quality|batchSize|4:5|2K|Anzahl/);

  const formSettings = workspace.match(
    /<section className="cs-card cs-inline-settings">[\s\S]*?<\/section>/,
  )?.[0];
  assert.ok(formSettings);
  assert.match(formSettings, /QuickControlButtons/);
  assert.match(workspace, /Seitenverhältnis, Qualität und Anzahl für diesen Lauf/);
});

test("Creative mobile layout removes its sidebar offset and keeps safe scroll reserve", () => {
  const css = readFileSync("app/creative-studio.css", "utf8");
  const page = readFileSync("app/(dashboard)/creative-studio/page.tsx", "utf8");
  const mobile = css.slice(
    css.indexOf("@media (max-width: 900px)"),
    css.indexOf("@media (max-width: 640px)"),
  );
  assert.match(mobile, /--cs-sidebar-offset: 0px/);
  assert.match(mobile, /\.hq-sidebar \{\s*display: none/);
  assert.doesNotMatch(mobile, /--cs-sidebar-offset: (4\.25|13\.5)rem/);
  assert.match(css, /left: var\(--cs-sidebar-offset, 0px\)/);
  assert.match(css, /right: 0/);
  assert.match(css, /transform: none !important/);
  assert.match(css, /justify-content: center/);
  assert.match(css, /width: min\(620px, 100%\)/);
  assert.match(
    css,
    /padding: 20px 12px calc\(118px \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(css, /\.cs-anchored-popover \{[\s\S]*?position: absolute/);
  assert.match(css, /max-width: calc\(100vw - 20px\)/);
  assert.match(css, /max-height: min\(46dvh/);
  assert.match(page, /viewportFit: "cover"/);
  assert.match(page, /interactiveWidget: "resizes-content"/);
});

test("model popover owns a momentum-scrollable list without scroll-time reflow", () => {
  const css = readFileSync("app/creative-studio.css", "utf8");
  const controls = readFileSync(
    "components/creative-studio/creative-studio-controls.tsx",
    "utf8",
  );
  assert.match(css, /\.cs-model-popover \{[\s\S]*?height: min\(390px, 48dvh/);
  assert.match(css, /\.cs-model-options \{[\s\S]*?overflow-y: auto/);
  assert.match(css, /\.cs-model-options \{[\s\S]*?-webkit-overflow-scrolling: touch/);
  assert.match(css, /\.cs-model-options \{[\s\S]*?overscroll-behavior: contain/);
  assert.match(controls, /popoverRef\.current\?\.contains\(event\.target\)/);
  assert.match(controls, /event\.type === "scroll"/);
});

test("mobile Reference and Prompt cards use compact, readable dimensions", () => {
  const css = readFileSync("app/creative-studio.css", "utf8");
  const mobile = css.slice(css.indexOf("@media (max-width: 640px)"));
  assert.match(mobile, /\.cs-reference-card,[\s\S]*?padding: 12px/);
  assert.match(mobile, /\.cs-dropzone \{[\s\S]*?min-height: 148px/);
  assert.match(mobile, /\.cs-prompt-card-main textarea \{[\s\S]*?min-height: 154px/);
  assert.match(mobile, /\.cs-prompt-card-main textarea \{[\s\S]*?max-height: 320px/);
  assert.match(mobile, /\.cs-reference-strip \{[\s\S]*?padding-bottom: 6px/);
});

test("Creative uses the DashboardShell's canonical Owner mobile navigation", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const dashboardShell = readFileSync(
    "components/layout/dashboard-shell.tsx",
    "utf8",
  );
  const shared = readFileSync(
    "components/navigation/studio-mobile-navigation.tsx",
    "utf8",
  );
  const css = readFileSync("app/hq-navigation.css", "utf8");
  assert.doesNotMatch(workspace, /CreativeMobileNavigation|StudioMobileNavigation/);
  assert.match(dashboardShell, /StudioMobileNavigation audience="OWNER"/);
  assert.match(shared, /getStudioSidebarSections\(locale, audience\)/);
  assert.match(shared, /isSidebarNavItemActive\(pathname, item\)/);
  assert.match(shared, /aria-current=\{active \? "page"/);
  assert.match(shared, /aria-expanded=\{open\}/);
  assert.match(shared, /event\.key === "Escape"/);
  assert.match(shared, /triggerRef\.current\?\.focus\(\)/);
  assert.match(css, /\.studio-mobile-nav-drawer/);
  assert.match(css, /\.studio-mobile-nav-drawer nav a\.is-active/);
});

test("model and quick selectors use compact anchored popovers instead of sheets", () => {
  const controls = readFileSync(
    "components/creative-studio/creative-studio-controls.tsx",
    "utf8",
  );
  const modelSelector = controls.slice(
    controls.indexOf("export function ModelSelector"),
    controls.indexOf("function QuickChoicePopover"),
  );
  const quickSelectors = controls.slice(
    controls.indexOf("function QuickChoicePopover"),
    controls.indexOf("export function AdvancedPanel"),
  );
  assert.match(modelSelector, /AnchoredPopover/);
  assert.match(modelSelector, /cs-model-popover/);
  assert.doesNotMatch(modelSelector, /ModalFrame|autoFocus|cs-model-sheet/);
  assert.match(quickSelectors, /cs-choice-popover--/);
  assert.doesNotMatch(quickSelectors, /ModalFrame|cs-choice-sheet/);
  assert.match(controls, /document\.addEventListener\("pointerdown", closeOutside\)/);
  assert.match(controls, /event\.key === "Escape"/);
  assert.match(controls, /aria-expanded=\{expanded\}/);
  assert.match(controls, /props\.onClose\(\)/);
});

test("Create and successful results expose prompt saving without changing generation", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  assert.match(workspace, /className="cs-prompt-save-action"/);
  assert.match(workspace, /Prompt wurde gespeichert\./);
  assert.match(workspace, /setPromptSaveSource\(activeRun\.setup\)/);
  assert.match(workspace, /<Save size=\{15\} \/> Prompt speichern/);
  assert.match(workspace, /promptSaveSource \?\? undefined/);
  assert.match(workspace, /reopenRunSetup\(activeRun\)/);
  assert.match(workspace, /addResultAsReference/);
  assert.deepEqual(CREATIVE_BATCH_SIZES, [1, 2, 3, 4]);
  assert.match(workspace, /\* batchSize/);
});

test("Creative browser code never assumes crypto.randomUUID is available", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const controls = readFileSync(
    "components/creative-studio/creative-studio-controls.tsx",
    "utf8",
  );
  assert.doesNotMatch(workspace + controls, /crypto\.randomUUID|randomUUID\(/);
  assert.match(workspace, /createCreativeClientId/);
  assert.doesNotMatch(workspace + controls, /deterministic-runtime|\/agents\/image/);
});

test("visible Creative Studio status copy remains honest without fake provider output", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const library = readFileSync(
    "components/creative-studio/creative-studio-library.tsx",
    "utf8",
  );
  const creativeSource = workspace + library;
  assert.match(creativeSource, /Es wurde kein kostenpflichtiger Aufruf ausgeführt/);
  assert.match(creativeSource, /ohne Fake-Ergebnisse/);
  assert.doesNotMatch(creativeSource, /data:image\//);
  assert.doesNotMatch(creativeSource, /setTimeout/);
});
