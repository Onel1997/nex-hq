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
  assert.equal(ownerStatusLabel("AWAITING_CONFIRMATION"), "Bestätigung erforderlich");
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
    "Platzierung",
    "Aufnahme",
    "Prüfen",
    "Generieren",
    "Ergebnis",
  ]);
});

test("Design Studio behaves as an artwork library with fit controls and no bottom workflow rail", async () => {
  const [center, workspace, preview, controls] = await Promise.all([
    source("components/design/design-studio-center.tsx"),
    source("components/design/v2/master-artwork-workspace.tsx"),
    source("components/design/v2/center/artwork-preview-stage.tsx"),
    source("components/design/v2/center/viewport-controls.tsx"),
  ]);
  assert.match(center, /Freigegebene Artworks verwalten/);
  assert.match(center, /<MasterArtworkWorkspace mission=/);
  assert.doesNotMatch(center, /design-studio-crumb-design/);
  assert.match(workspace, /Artwork-Bibliothek/);
  assert.doesNotMatch(workspace, /ArtworkWorkflowRail/);
  assert.match(preview, /useMasterArtworkViewport/);
  assert.match(preview, /dsv2-preview-provenance/);
  assert.match(controls, /An Bildschirm anpassen/);
});

test("Image V2 is production-first, visually calibrated, single-asset, and keeps debug details collapsed", async () => {
  const [panel, workspace] = await Promise.all([
    source("components/image/deterministic-v2-panel.tsx"),
    source("components/image/image-studio-workspace.tsx"),
  ]);
  assert.match(panel, /Deterministisches Mockup/);
  assert.match(panel, /Vorbereiten & Kosten prüfen/);
  assert.match(panel, /Visuelle Platzierung für die Druckfläche/);
  assert.match(panel, /TechnicalDetails/);
  assert.match(panel, /Vorherige Durchläufe/);
  assert.match(panel, /Freigeben/);
  assert.match(panel, /Ablehnen/);
  assert.doesNotMatch(panel, /auto.?batch/i);
  assert.match(workspace, /Generative Vorschau — Artwork kann verändert werden/);
  assert.match(workspace, /<h1 className="is-hero-title">Image Studio<\/h1>/);
  assert.doesNotMatch(workspace, /<h1 className="is-hero-title">\{missionName\}<\/h1>/);
  assert.match(workspace, /is-legacy-workspace/);
  assert.match(workspace, /Weitere Aufnahmen und ältere Werkzeuge/);
  assert.match(workspace, /is-v1-preview/);
  assert.match(workspace, /ein Auftrag erzeugt genau ein Ergebnis/i);
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
  const deterministic = await source("components/image/deterministic-v2-panel.tsx");
  const productDisplay = await source("lib/image/image-studio-product-display.ts");
  assert.match(workspace, /Deterministisches Mockup · Produktion/);
  assert.match(workspace, /Generative Vorschau · Artwork kann verändert werden/);
  assert.match(workspace, /<details className="nx-technical">/);
  assert.doesNotMatch(deterministic, /Maximale Stage-A-Kosten/);
  assert.match(deterministic, /Basisbild · maximales Kostenlimit/);
  assert.match(productDisplay, /Wähle ein für Bilder freigegebenes Markenmodel/);
  assert.match(productDisplay, /Kein Produkt ausgewählt/);
  assert.doesNotMatch(workspace, />UNSET</);
  assert.doesNotMatch(workspace, />APPROVED</);
  assert.doesNotMatch(workspace, />WAITING</);
  assert.doesNotMatch(workspace, /No product selected/);
  assert.doesNotMatch(workspace, /Select an eligible Brand Model/);
  assert.match(workspace, /ownerAuthorityLabel\(productHeader\.authorityLabel\)/);
  assert.match(workspace, /artworkIdentity\.displayName/);
});

test("Persona primary journey and technical noise are owner-friendly", async () => {
  const [persona, casting] = await Promise.all([
    source("components/persona/persona-studio.tsx"),
    source("components/persona/persona-creator-views.tsx"),
  ]);
  for (const label of ["Neues Model entdecken", "Freigegebene Modelle", "Modelle in Bearbeitung", "Referenzpaket"]) {
    assert.match(persona, new RegExp(label));
  }
  assert.match(casting, /DEBUG_MODE \? \(/);
  assert.doesNotMatch(casting, /process\.env\.NODE_ENV !== "production" \|\| DEBUG_MODE/);
});

test("Product Library separates verified Shopify products from durable manual persistence", async () => {
  const productLibrary = await source("components/product-library/product-library-workspace.tsx");
  assert.match(productLibrary, /Shopify verifiziert/);
  assert.match(productLibrary, /Manuelle Produkte/);
  assert.match(productLibrary, /Produkt anlegen/);
  assert.match(productLibrary, /Manuelles Produktprofil wurde gespeichert/);
  assert.match(productLibrary, /ownerProductStatusLabel\(product.status\)/);
  assert.doesNotMatch(productLibrary, /SHOPIFY_LIVE/);
  assert.doesNotMatch(productLibrary, /\{product\.status === "ACTIVE"/);
});

test("Product Library uses document scroll instead of a viewport-height overflow trap", async () => {
  const studioCss = await source("app/nexhq-studio-system.css");
  assert.match(studioCss, /facility-app-layout:has\(\.product-library\)/);
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

test("no UX surface introduces provider execution or paid-generation toggles", async () => {
  const paths = [
    "components/studio/studio-ui.tsx",
    "components/product-library/product-library-workspace.tsx",
    "lib/ux/owner-terminology.ts",
  ];
  const merged = (await Promise.all(paths.map(source))).join("\n");
  assert.doesNotMatch(merged, /OPENAI_API_KEY|NEXHQ_IMAGE_PAID_GENERATION_ENABLED|images\.generate|images\.edit/);
});
