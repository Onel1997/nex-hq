import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("Product Library exposes the simple family, color, blank, and green-area flow", () => {
  const source = read("components/product-library/product-library-workspace.tsx");
  for (const label of [
    "Produktfamilien",
    "Produktkategorie hinzufügen",
    "Farbe hinzufügen",
    "Blank hochladen",
    "MarketPrint-Bild hochladen",
    "Erlaubter Druckbereich",
    "für alle Farben dieser Produktfamilie",
  ]) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /normalizedRegion\.x\s*}\s*<\/p>/);
});

test("Product Family writes reconcile immediately with compact owner feedback", () => {
  const source = read("components/product-library/product-library-workspace.tsx");
  for (const label of [
    "Wird hochgeladen …",
    "Hochgeladen ✓",
    "Ersetzen",
    "Vorlage wird hochgeladen …",
    "Druckfläche erkannt ✓",
    "Druckfläche wird gespeichert …",
    "Druckfläche gespeichert ✓",
    "Bearbeiten",
    "Änderungen speichern",
    "Upload fehlgeschlagen. Erneut versuchen.",
    "Druckfläche konnte nicht gespeichert werden.",
  ]) assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /setConfirmedReference\(persisted\)/);
  assert.match(source, /onUpdated\(payload\.profile\)/);
  assert.doesNotMatch(source, /Blank hochladen[\s\S]{0,300}>Speichern</);
});

test("saved calibration collapses and technical role management stays out of normal family flow", () => {
  const source = read("components/product-library/product-library-workspace.tsx");
  assert.match(source, /template\?\.status === "READY" && !editing/);
  assert.match(source, /setEditing\(true\)/);
  assert.match(source, /needsSave/);
  assert.match(source, /familyMode\s*\?\s*"Technische Details"/);
  assert.match(source, /!familyMode \? <details open>[\s\S]*<summary>Produktbilder<\/summary>/);
});

test("Product Family polish is compact, responsive, and reduced-motion safe", () => {
  const css = read("app/nexhq-studio-system.css");
  assert.match(css, /\.product-family-blank-slot\s*\{/);
  assert.match(css, /\.product-family-calibration--compact\s*\{/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.product-family-blanks\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.product-action-feedback/);
});

test("Image Studio keeps family/color compact and MarketPrint placement ratio-locked", () => {
  const selector = read("components/image/product-production-selector.tsx");
  const panel = read("components/image/deterministic-v2-panel.tsx");
  const prepare = read("lib/image/deterministic-v2-panel/prepare-flow.ts");
  const activeRun = read("lib/image/deterministic-v2-panel/active-run.ts");
  assert.match(selector, /Produktfamilie auswählen/);
  assert.match(selector, />Farbe</);
  assert.match(panel, /Auto-Fit & zentrieren/);
  assert.match(panel, /Vertikale Artwork-Position/);
  assert.match(panel, />\s*Höher\s*</);
  assert.match(panel, />\s*Tiefer\s*</);
  assert.match(panel, /Höhe zurücksetzen/);
  assert.match(panel, /Artwork ziehen oder gleichmäßig skalieren/);
  assert.match(panel, /Proportionen gesperrt/);
  assert.match(panel, /ownerArtworkPlacement/);
  assert.match(panel, /strict-contain-fit-diagnostics/);
  assert.match(panel, /Verhältnis geschützt: Ja · Beschnitt: Nein · Verzerrung: Nein/);
  assert.match(prepare, /ownerArtworkPlacement/);
  assert.match(activeRun, /ownerArtworkPlacementSignature/);
  assert.match(activeRun, /ownerArtworkPlacementFromRecovery/);
});

test("green calibration cannot become Stage A input and blank references are preferred", () => {
  const service = read("lib/image/deterministic-runtime/service.ts");
  const family = read("lib/product-library/product-family.ts");
  assert.match(service, /selectStageAProductReferences/);
  assert.match(family, /reference\.purpose !== "PRINT_AREA_CALIBRATION"/);
  assert.match(family, /exactBlank\.length/);
  assert.doesNotMatch(read("lib/product-library/product-family-green-detection.ts"), /generateWithProvider|openai|fal-ai|fetch\(/i);
});

test("all existing content systems and fabric-aware V3 remain in place", () => {
  const packs = read("lib/image/content-packs.ts");
  const packSelector = read("components/image/content-pack-selector.tsx");
  const workspace = read("components/image/image-studio-workspace.tsx");
  const creativeDirection = read("lib/image/social-creative-direction.ts");
  const runtime = read("lib/image/deterministic-runtime/service.ts");
  for (const value of ["Basis-Pack", "Winning Design Expansion", "Eigene Auswahl"]) {
    assert.match(packs + packSelector + workspace, new RegExp(value));
  }
  assert.match(workspace, /SOCIAL_CONTENT/);
  assert.match(workspace + creativeDirection, /SHOPIFY_MOCKUP/);
  assert.match(runtime, /COMPOSITOR_VERSION_V3/);
  assert.match(runtime, /DEFAULT_FABRIC_AWARE_INTEGRATION/);
  assert.match(runtime, /DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION/);
  assert.match(runtime, /DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION/);
  assert.match(runtime, /\/shirt\|tee\/i\.test\(context\.productType\)/);
  assert.match(runtime, /productFamilyPlacement[\s\S]*DEFAULT_SURFACE_CONFORMING/);
  assert.match(
    runtime,
    /placementPreset === "FRONT_LARGE"[\s\S]*DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION/,
  );
  assert.match(runtime, /assetCount:\s*1/);
});

test("new Product Family jobs use strict garment-relative V3 without chest fallback", () => {
  const runtime = read("lib/image/deterministic-runtime/service.ts");
  const registration = read(
    "lib/image/deterministic-runtime/garment-registration-v3.ts",
  );
  assert.match(runtime, /outputMapping:\s*"GENERATED_GARMENT_RELATIVE_V3"/);
  assert.match(runtime, /placementPreset:[\s\S]*semanticPlacement\?\.placementPreset/);
  assert.match(registration, /FRONT_LEFT_CHEST/);
  assert.match(registration, /FRONT_CENTER_CHEST/);
  assert.match(registration, /FRONT_LARGE/);
  assert.match(registration, /LARGE_FRONT_UNSAFE/);
  assert.match(
    runtime,
    /große Frontprint.*tatsächlichen Shirt-Frontfläche erhalten werden/,
  );
});

test("family routes authenticate before workspace-scoped writes", () => {
  for (const path of [
    "app/api/product-library/profiles/[profileId]/colors/route.ts",
    "app/api/product-library/profiles/[profileId]/placement-templates/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /requirePersonaScope\(\)/);
    assert.match(source, /if \(!gated\.ok\) return gated\.response/);
    assert.doesNotMatch(source, /createAdminClient|service_role/);
  }
});
