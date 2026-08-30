import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  IMAGE_PRODUCTION_STEPS,
  OWNER_AUTHORITY_LABELS,
  ownerAnalysisLabel,
  ownerProductStatusLabel,
  ownerShotLabel,
  ownerStatusLabel,
} from "@/lib/ux/owner-terminology";

async function source(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("owner terminology renders production authority and review states in German", () => {
  assert.equal(OWNER_AUTHORITY_LABELS.SHOPIFY_LIVE, "Shopify verifiziert");
  assert.equal(OWNER_AUTHORITY_LABELS.MANUAL_PROFILE, "Manuelles Produkt");
  assert.equal(
    ownerStatusLabel("AWAITING_CONFIRMATION"),
    "Bestätigung erforderlich",
  );
  assert.equal(ownerStatusLabel("REVIEW_REQUIRED"), "Prüfung erforderlich");
  assert.equal(ownerStatusLabel("UNSET"), "Nicht ausgewählt");
  assert.equal(ownerStatusLabel("APPROVED"), "Freigegeben");
  assert.equal(ownerStatusLabel("WAITING"), "Wartet");
  assert.equal(ownerStatusLabel("READY_TO_GENERATE"), "Bereit zur Generierung");
  assert.equal(ownerStatusLabel("succeeded"), "Erfolgreich");
  assert.equal(ownerStatusLabel("failed"), "Fehlgeschlagen");
  assert.equal(ownerShotLabel("Studio front — primary"), "Studio frontal");
  assert.equal(ownerProductStatusLabel("ACTIVE"), "Aktiv");
  assert.equal(ownerProductStatusLabel("DRAFT"), "Entwurf");
  assert.equal(ownerAnalysisLabel("Luxury"), "Premium");
  assert.equal(ownerAnalysisLabel("Typography driven"), "Typografiegeführt");
  assert.deepEqual(IMAGE_PRODUCTION_STEPS, [
    "Artwork",
    "Produkt",
    "Variante",
    "Markenmodel",
    "Aufnahme",
    "Druckseite",
    "Platzierung",
    "Prüfen",
    "Generieren",
    "Ergebnis",
  ]);
});

test("Design Studio behaves as an artwork library with fit controls and no bottom workflow rail", async () => {
  const [center, workspace, preview, controls, previewMedia] = await Promise.all([
    source("components/design/design-studio-center.tsx"),
    source("components/design/v2/master-artwork-workspace.tsx"),
    source("components/design/v2/center/artwork-preview-stage.tsx"),
    source("components/design/v2/center/viewport-controls.tsx"),
    source("components/design/master-artwork-preview-media.tsx"),
  ]);
  assert.match(center, /Freigegebene Artworks verwalten/);
  assert.match(center, /<MasterArtworkWorkspace mission=/);
  assert.doesNotMatch(center, /design-studio-crumb-design/);
  assert.match(workspace, /Artwork-Bibliothek/);
  assert.doesNotMatch(workspace, /ArtworkWorkflowRail/);
  assert.match(preview, /useMasterArtworkViewport/);
  assert.match(preview, /Namen ändern/);
  assert.match(preview, /Originaldatei/);
  assert.match(workspace, /renameArtworkDisplayName/);
  assert.match(controls, /An Bildschirm anpassen/);
  assert.match(previewMedia, /data-artwork-fit-mode="contain"/);
});

test("Image V2 is production-first, automatically placed, single-asset, and keeps Product calibration out of the owner flow", async () => {
  const [panel, workspace, productLibrary] = await Promise.all([
    source("components/image/deterministic-v2-panel.tsx"),
    source("components/image/image-studio-workspace.tsx"),
    source("components/product-library/product-library-workspace.tsx"),
  ]);
  assert.match(panel, /Stil und Platzierung/);
  assert.match(panel, /Vorbereiten & Kosten prüfen/);
  assert.match(panel, /Druckseite und Platzierung/);
  assert.match(panel, /Platzierung automatisch bereit/);
  assert.doesNotMatch(panel, /Druckfläche einrichten/);
  assert.doesNotMatch(panel, /Visuelle Feinjustierung der Druckfläche/);
  assert.doesNotMatch(panel, /Erweiterte Produktzuordnung/);
  assert.match(panel, /Artwork-Proportionen geschützt/);
  assert.match(panel, /Proportionen geschützt/);
  assert.match(panel, /SIMPLE_IMAGE_STEPS/);
  assert.match(panel, /"Stil & Platzierung"/);
  assert.match(panel, /Passt das Ergebnis/);
  assert.doesNotMatch(panel, /is-v2-review-checklist/);
  assert.doesNotMatch(panel, /Ich habe Model, Produkt/);
  assert.doesNotMatch(panel, /<span>Perspektive stimmt<\/span>/);
  assert.match(
    productLibrary,
    /Technische Produktdaten · Druckflächen kalibrieren/,
  );
  assert.match(
    panel,
    /<TechnicalDetails>[\s\S]*Interner synthetischer Testlauf/,
  );
  assert.doesNotMatch(panel, />Synthetischen Test starten</);
  assert.doesNotMatch(panel, /open=\{!resolvedSurface\}/);
  assert.match(
    panel,
    /Beide Bilder werden einzeln vorbereitet, bestätigt und\s+erstellt/,
  );
  assert.match(panel, /TechnicalDetails/);
  assert.match(panel, /Vorherige Durchläufe/);
  assert.match(panel, /Freigeben/);
  assert.match(panel, /Ablehnen/);
  assert.match(panel, /Markenmodel klar wiederzuerkennen/);
  assert.match(panel, /frei von Fremdprints/);
  assert.match(panel, /Umgebung hochwertig/);
  assert.match(panel, /Fremder Aufdruck im Basisbild erkannt/);
  assert.match(panel, /freigegebenes Artwork wurde deshalb nicht angewendet/);
  assert.doesNotMatch(panel, /auto.?batch/i);
  assert.match(
    workspace,
    /Generative Vorschau — Artwork kann verändert werden/,
  );
  assert.match(workspace, /<h1 className="is-hero-title">Image Studio<\/h1>/);
  assert.doesNotMatch(
    workspace,
    /<h1 className="is-hero-title">\{missionName\}<\/h1>/,
  );
  assert.match(workspace, /is-legacy-workspace/);
  assert.match(workspace, /Technische Details · Ältere Werkzeuge/);
  assert.match(workspace, /is-v1-preview/);
  assert.match(workspace, /ein Auftrag erzeugt genau ein Ergebnis/i);
  assert.doesNotMatch(
    workspace,
    /<span className="is-v2-input-number">05<\/span>/,
  );
});

test("Content Pack selection visibly drives one canonical shot", async () => {
  const [selector, workspace] = await Promise.all([
    source("components/image/content-pack-selector.tsx"),
    source("components/image/image-studio-workspace.tsx"),
  ]);
  assert.match(
    selector,
    /aria-pressed=\{props\.selectedAssetId === definition\.id\}/,
  );
  assert.match(selector, /is-content-shot__selected/);
  assert.match(selector, /> Ausgewählt/);
  assert.match(selector, /Social Content/);
  assert.match(selector, /Shopify Mockups/);
  assert.match(workspace, /setSelectedAssetId\(asset\.id\)/);
  assert.match(workspace, /selectedAssetId=\{selectedAsset\?\.id \?\? null\}/);
  assert.doesNotMatch(selector, /Promise\.all\([^)]*onSelect/);
  assert.match(selector, /const authorityKey = authority/);
  assert.match(selector, /if \(!authorityKey\)/);
  assert.doesNotMatch(selector, /Der Fortschritt konnte nicht geladen werden/);
  assert.doesNotMatch(selector, /setHistoryUnavailable/);
});

test("Image Studio offers the canonical approved Artwork Library without breaking Design handoff", async () => {
  const [workspace, picker, brandSelector] = await Promise.all([
    source("components/image/image-studio-workspace.tsx"),
    source("components/image/artwork-library-selector.tsx"),
    source("components/image/brand-model-selector.tsx"),
  ]);
  assert.match(workspace, /<ArtworkLibrarySelector/);
  assert.match(workspace, /saveImageStudioHandoff\(nextHandoff\)/);
  assert.match(workspace, /buildResolvedArtworkHandoff\(\{/);
  assert.match(workspace, /resolveCanonicalArtworkForImageHandoff/);
  assert.match(workspace, /setPaidJob\(null\)/);
  assert.match(workspace, /setProductSelection/);
  assert.match(picker, /\/api\/design\/master-artworks/);
  assert.match(picker, /Artwork wechseln/);
  assert.match(picker, /artwork\.displayName/);
  assert.doesNotMatch(picker, /checksum|storagePath|storage key/i);
  assert.match(brandSelector, /const onSelectionChangeRef = useRef/);
  assert.match(brandSelector, /\}, \[\]\);/);
  assert.match(brandSelector, /selectionRequestRef/);
  assert.doesNotMatch(brandSelector, /\}, \[onSelectionChange\]\);/);
});

test("Social Content exposes compact structured variety while Shopify stays consistent", async () => {
  const [selector, creative, workspace] = await Promise.all([
    source("components/image/content-pack-selector.tsx"),
    source("components/image/social-creative-direction-selector.tsx"),
    source("components/image/image-studio-workspace.tsx"),
  ]);
  assert.match(selector, /Social Content/);
  assert.match(selector, /Shopify Mockups/);
  assert.match(creative, /Stil wählen/);
  assert.match(creative, /<summary>Stil anpassen<\/summary>/);
  assert.match(creative, /Shopify Standard/);
  assert.match(creative, /Social Vielfalt planen/);
  assert.match(creative, /0 automatische Aufträge/);
  for (const label of ["Szene", "Ort", "Licht", "Kamera", "Stimmung"]) {
    assert.match(creative, new RegExp(label));
  }
  assert.match(workspace, /creativeDirection=\{effectiveCreativeDirection\}/);
  assert.match(workspace, /const effectiveCreativeDirection = useMemo/);
  assert.doesNotMatch(creative, /requestedDirection/);
  assert.doesNotMatch(creative, /Generate|Prepare|Estimate/);
});

test("Studio typography uses one sans-serif family and legacy display fonts do not own operational headings", async () => {
  const [layout, globals, studioCss, imageCss] = await Promise.all([
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("app/nexhq-studio-system.css"),
    source("app/image-studio.css"),
  ]);
  assert.doesNotMatch(layout, /Cormorant_Garamond/);
  assert.match(globals, /--font-display: var\(--font-geist-sans\)/);
  assert.match(studioCss, /--nx-font-ui: var\(--font-geist-sans\)/);
  assert.match(studioCss, /\.nx-studio[\s\S]*is-hero-title/);
  assert.match(imageCss, /\.is-hero-title/);
  assert.match(imageCss, /-webkit-line-clamp: 2/);
  assert.match(studioCss, /-webkit-line-clamp: 2/);
});

test("owner-facing Image production keeps V2 primary and raw job details collapsed", async () => {
  const workspace = await source("components/image/image-studio-workspace.tsx");
  const deterministic = await source(
    "components/image/deterministic-v2-panel.tsx",
  );
  const productDisplay = await source(
    "lib/image/image-studio-product-display.ts",
  );
  assert.match(workspace, /Artwork geschützt · Einzelbild/);
  assert.match(workspace, /Technische Details · Generative Vorschau/);
  assert.match(workspace, /<details className="nx-technical">/);
  assert.doesNotMatch(deterministic, /Maximale Stage-A-Kosten/);
  assert.match(deterministic, /Geschätzte maximale Kosten/);
  assert.match(deterministic, /<TechnicalDetails>[\s\S]*Fingerprint/);
  assert.match(deterministic, /Bild erstellen/);
  assert.match(deterministic, /execute_real/);
  assert.match(deterministic, /postJobActionWithProgressPolling/);
  assert.match(deterministic, /aria-busy=\{productionState\.busy\}/);
  assert.match(deterministic, /productionState\.showContinuation/);
  assert.doesNotMatch(
    deterministic,
    /wenn der bezahlte Anbieter serverseitig freigegeben ist/,
  );
  assert.doesNotMatch(
    deterministic,
    /wartet auf die verfügbare\s+Produktion/,
  );
  assert.match(
    productDisplay,
    /Wähle ein für Bilder freigegebenes Markenmodel/,
  );
  assert.match(productDisplay, /Kein Produkt ausgewählt/);
  assert.doesNotMatch(workspace, />UNSET</);
  assert.doesNotMatch(workspace, />APPROVED</);
  assert.doesNotMatch(workspace, />WAITING</);
  assert.doesNotMatch(workspace, /No product selected/);
  assert.doesNotMatch(workspace, /Select an eligible Brand Model/);
  assert.match(
    workspace,
    /ownerAuthorityLabel\(productHeader\.authorityLabel\)/,
  );
  assert.match(workspace, /artworkIdentity\.displayName/);
  assert.match(workspace, /formatArtworkSecondaryLine/);
});

test("Artwork picker and live production feedback stay stable and owner-readable", async () => {
  const [picker, panel, status, css] = await Promise.all([
    source("components/image/artwork-library-selector.tsx"),
    source("components/image/deterministic-v2-panel.tsx"),
    source("lib/image/deterministic-v2-panel/owner-production-state.ts"),
    source("app/image-studio.css"),
  ]);
  assert.match(picker, /if \(!open \|\| loaded\) return/);
  assert.match(picker, /orderedArtworks/);
  assert.match(picker, /aria-pressed=\{selected\}/);
  assert.match(css, /\.is-artwork-library-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.is-artwork-library-list-frame\s*\{[^}]*min-height: 9rem/);
  assert.match(panel, /Stage-A Basisbild/);
  assert.match(panel, /Geprüfter Druckbereich/);
  assert.match(panel, /Front Torso Envelope/);
  assert.match(panel, /is-v2-base-preview__torso-envelope/);
  assert.match(panel, /volle SAM-Kleidungsfläche/);
  assert.match(panel, /\/base-preview/);
  assert.doesNotMatch(panel, /preview\.storagePath/);
  for (const copy of [
    "Auftrag wird bestätigt",
    "Basisbild wird erstellt",
    "Artwork wird auf das Produkt angewendet",
    "Ergebnis wird gespeichert",
    "Ergebnis ist zur Prüfung bereit",
  ]) {
    assert.match(status, new RegExp(copy));
  }
});

test("final daily owner flow has four phases and hides implementation complexity", async () => {
  const [panel, workspace, creative, packs, productSelector, brandSelector] = await Promise.all([
    source("components/image/deterministic-v2-panel.tsx"),
    source("components/image/image-studio-workspace.tsx"),
    source("components/image/social-creative-direction-selector.tsx"),
    source("components/image/content-pack-selector.tsx"),
    source("components/image/product-production-selector.tsx"),
    source("components/image/brand-model-selector.tsx"),
  ]);
  assert.match(
    panel,
    /const SIMPLE_IMAGE_STEPS = \[\s*"Auswahl",\s*"Stil & Platzierung",\s*"Erstellen",\s*"Ergebnis",\s*\]/,
  );
  assert.doesNotMatch(
    workspace,
    /<span className="is-v2-input-number">05<\/span>/,
  );
  assert.match(workspace, /setHandoff\(bootstrapped\.artworkHandoff\)/);
  assert.match(workspace, /hasArtworkHandoff[\s\S]*artworkIdentity\.displayName/);
  assert.match(creative, /Stil wählen/);
  assert.match(creative, /<details className="nx-technical is-creative-adjustments">/);
  assert.doesNotMatch(creative, /open=/);
  assert.match(packs, /nextMode === "SHOPIFY_MOCKUP"\) setMode\("BASE"\)/);
  assert.match(packs, /const SHOPIFY_STANDARD_SHOT_IDS = \[/);
  assert.match(packs, /SHOPIFY_STANDARD_SHOT_IDS as readonly string\[\]/);
  assert.match(packs, /purpose === "SOCIAL" \? \(/);
  assert.doesNotMatch(packs, /definition\.aspectIntents/);
  assert.doesNotMatch(productSelector, /Druckfläche im nächsten Schritt/);
  assert.doesNotMatch(brandSelector, /\{model\.displayName\} · Identität/);
  assert.match(brandSelector, /<summary>Technische Details<\/summary>/);
  assert.doesNotMatch(panel, /Druckfläche einrichten/);
  assert.doesNotMatch(panel, /Visuelle Feinjustierung/);
  assert.match(panel, /<TechnicalDetails>[\s\S]*Internen Testlauf starten/);
  assert.match(panel, /decision === "APPROVED" \? "PASS" : "NEEDS_REVIEW"/);
});

test("Persona primary journey and technical noise are owner-friendly", async () => {
  const [persona, casting] = await Promise.all([
    source("components/persona/persona-studio.tsx"),
    source("components/persona/persona-creator-views.tsx"),
  ]);
  for (const label of [
    "Neues Model entdecken",
    "Freigegebene Modelle",
    "Modelle in Bearbeitung",
    "Referenzpaket",
  ]) {
    assert.match(persona, new RegExp(label));
  }
  assert.match(casting, /DEBUG_MODE \? \(/);
  assert.doesNotMatch(
    casting,
    /process\.env\.NODE_ENV !== "production" \|\| DEBUG_MODE/,
  );
});

test("Product Library separates verified Shopify products from durable Product Families", async () => {
  const productLibrary = await source(
    "components/product-library/product-library-workspace.tsx",
  );
  assert.match(productLibrary, /Shopify verifiziert/);
  assert.match(productLibrary, /Produktfamilien/);
  assert.match(productLibrary, /Produktkategorie hinzufügen/);
  assert.match(productLibrary, /Produktfamilie wurde gespeichert/);
  assert.match(productLibrary, /ownerProductStatusLabel\(product.status\)/);
  assert.doesNotMatch(productLibrary, /SHOPIFY_LIVE/);
  assert.doesNotMatch(productLibrary, /\{product\.status === "ACTIVE"/);
});

test("Product Library uses document scroll instead of a viewport-height overflow trap", async () => {
  const studioCss = await source("app/nexhq-studio-system.css");
  assert.match(studioCss, /hq-app-layout:has\(\.product-library\)/);
  assert.match(
    studioCss,
    /\.product-library\.nx-studio\s*\{[^}]*overflow:\s*visible/,
  );
  assert.doesNotMatch(
    studioCss,
    /\.product-library__grid\s*\{[^}]*overflow-y:\s*(auto|scroll|hidden)/,
  );
  assert.doesNotMatch(
    studioCss,
    /\.product-library\.nx-studio\s*\{[^}]*overflow-y:\s*(auto|scroll|hidden)/,
  );
});

test("Image Studio surfaces owner Artwork names without using name as authority", async () => {
  const image = await source("components/image/image-studio-workspace.tsx");
  assert.match(
    image,
    /userFacingTitle: handoff\?\.durableMasterArtwork\?\.displayName/,
  );
  assert.match(image, /formatArtworkSecondaryLine/);
  assert.match(image, /artworkOriginalFileName/);
  assert.match(
    await source("lib/design/artwork-display-name.ts"),
    /Originaldatei/,
  );
});

test("no UX surface introduces provider execution or paid-generation toggles", async () => {
  const paths = [
    "components/studio/studio-ui.tsx",
    "components/product-library/product-library-workspace.tsx",
    "lib/ux/owner-terminology.ts",
  ];
  const merged = (await Promise.all(paths.map(source))).join("\n");
  assert.doesNotMatch(
    merged,
    /OPENAI_API_KEY|NEXHQ_IMAGE_PAID_GENERATION_ENABLED|images\.generate|images\.edit/,
  );
});
