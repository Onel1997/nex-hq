"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  PackageCheck,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ImageStudioAsset } from "@/agents/image/types";
import type { BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";
import type { MasterArtworkReference } from "@/lib/design/master-artwork-authority/types";
import {
  CONTENT_PACK_PROGRESS_LABELS,
  CONTENT_PACKS,
  contentPackProgress,
  contentPackShots,
  contentShotById,
  isShotCompatible,
  type ContentPackId,
  type ContentPackLineage,
  type ContentPackProgressAuthority,
  type ContentPackProgressStatus,
  type ContentShotDefinition,
} from "@/lib/image/content-packs";
import { ownerShotLabel } from "@/lib/ux/owner-terminology";
import type { ImageContentMode } from "@/lib/image/social-creative-direction";

type ProductProfileSelection = {
  profileKey: string;
  version: number;
  variantId: string;
} | null;

const INTENT_LABELS: Record<string, string> = {
  SHOPIFY: "Shopify",
  INSTAGRAM_FEED: "Instagram Beitrag",
  INSTAGRAM_STORY: "Instagram Story",
  REEL_COVER: "Reel Cover",
  CAROUSEL: "Carousel",
  SOCIAL: "Social",
  CAMPAIGN: "Kampagne",
};

const SHOPIFY_STANDARD_SHOT_IDS = [
  "content:shopify-product-image",
  "content:premium-flatlay",
  "content:hanger-or-rack",
] as const;

function ProgressIcon({ status }: { status: ContentPackProgressStatus }) {
  if (status === "APPROVED") return <CheckCircle2 className="size-4" />;
  if (status === "REJECTED") return <XCircle className="size-4" />;
  if (status === "IN_REVIEW") return <PackageCheck className="size-4" />;
  return <Circle className="size-4" />;
}

function winningCategory(shot: ContentShotDefinition): string {
  if (/detail|highlight/i.test(shot.id)) return "Detail";
  if (/flatlay/i.test(shot.id)) return "Flatlay";
  if (/hanger|rack|folded|front|back/i.test(shot.id)) return "Produkt";
  if (/story|feed|carousel/i.test(shot.id)) return "Story & Feed";
  if (/campaign/i.test(shot.id)) return "Kampagne";
  if (shot.requiresBrandModel) return "Model & Lifestyle";
  return "Weitere Ideen";
}

export function ContentPackSelector(props: {
  assets: ImageStudioAsset[];
  selectedAssetId: string | null;
  productType: string | null;
  masterArtwork: MasterArtworkReference | null;
  productProfile: ProductProfileSelection;
  brandModelTrace: BrandModelTrace | null;
  contentMode: ImageContentMode;
  onContentModeChange: (mode: ImageContentMode) => void;
  onSelect: (asset: ImageStudioAsset) => void;
}) {
  const purpose = props.contentMode === "SOCIAL_CONTENT" ? "SOCIAL" : "SHOPIFY";
  const [mode, setMode] = useState<ContentPackId>("BASE");
  const [runs, setRuns] = useState<ContentPackLineage[]>([]);
  const shotOptionsLoading = props.assets.length === 0;
  const assetById = useMemo(
    () => new Map(props.assets.map((asset) => [asset.id, asset])),
    [props.assets],
  );
  const authority = useMemo<ContentPackProgressAuthority | null>(() => {
    if (!props.masterArtwork || !props.productProfile) return null;
    return {
      artworkId: props.masterArtwork.id,
      artworkVersion: props.masterArtwork.version,
      artworkChecksum: props.masterArtwork.checksum,
      productProfileId: props.productProfile.profileKey,
      productProfileVersion: props.productProfile.version,
      variantId: props.productProfile.variantId,
      brandModelId: props.brandModelTrace?.brandModelId ?? null,
    };
  }, [props.brandModelTrace, props.masterArtwork, props.productProfile]);
  const authorityKey = authority
    ? [
        authority.artworkId,
        authority.artworkVersion,
        authority.artworkChecksum,
        authority.productProfileId,
        authority.productProfileVersion,
        authority.variantId,
        authority.brandModelId ?? "no-model",
      ].join("|")
    : null;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleHandle: number | null = null;
    if (!authorityKey) {
      setRuns([]);
      return;
    }
    // Historical progress is optional convenience. Defer it so auth, Product
    // Family, Persona and the canonical shot selection own the startup lane.
    // Static shot cards remain interactive immediately.
    const loadHistory = () => void fetch("/api/image/v2/jobs?view=content-history", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Verlauf nicht verfügbar");
        const payload = (await response.json()) as {
          lineages?: ContentPackLineage[];
        };
        return payload.lineages ?? [];
      })
      .then((lineage) => {
        if (!cancelled) setRuns(lineage);
      })
      .catch(() => {
        // Pack progress is optional history. Production selection remains
        // authoritative and must never flicker, reset, or show an owner error
        // when history is unavailable.
        if (!cancelled) setRuns([]);
      });
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(loadHistory, { timeout: 2_500 });
    } else {
      timer = setTimeout(loadHistory, 2_000);
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (idleHandle != null && typeof window.cancelIdleCallback === "function")
        window.cancelIdleCallback(idleHandle);
    };
  }, [authorityKey]);

  const activePackMode = purpose === "SHOPIFY" ? "BASE" : mode;
  const packProgress =
    activePackMode === "CUSTOM"
      ? []
      : contentPackProgress(activePackMode, authority, runs);
  const visibleProgress = packProgress.filter(({ shot }) =>
    purpose === "SHOPIFY"
      ? shot.intents.includes("SHOPIFY")
      : shot.intents.some((intent) => intent !== "SHOPIFY"),
  );
  const approvedCount = visibleProgress.filter(
    (item) => item.status === "APPROVED",
  ).length;
  const createdCount = visibleProgress.filter(
    (item) => item.status !== "NOT_CREATED",
  ).length;
  const compatiblePackShots =
    activePackMode === "CUSTOM"
      ? []
      : contentPackShots(activePackMode, props.productType).map(
          ({ definition, compatible }) => ({
            definition,
            compatible,
            asset: assetById.get(definition.id) ?? null,
            status:
              packProgress.find((item) => item.shot.id === definition.id)
                ?.status ?? ("NOT_CREATED" as const),
          }),
        ).filter(({ definition }) =>
          definition.id === props.selectedAssetId ||
          (purpose === "SHOPIFY"
            ? definition.intents.includes("SHOPIFY")
            : definition.intents.some((intent) => intent !== "SHOPIFY")),
        );
  const groupedPackShots = (() => {
    if (
      purpose !== "SOCIAL" ||
      activePackMode !== "WINNING_EXPANSION"
    )
      return [["", compatiblePackShots]] as const;
    const groups = new Map<string, typeof compatiblePackShots>();
    for (const item of compatiblePackShots) {
      const category = winningCategory(item.definition);
      groups.set(category, [...(groups.get(category) ?? []), item]);
    }
    return [...groups.entries()];
  })();
  const packagedShotIds = new Set<string>([
    ...CONTENT_PACKS.BASE.shotIds,
    ...CONTENT_PACKS.WINNING_EXPANSION.shotIds,
  ]);
  const customAssets = props.assets.filter(
    (asset) =>
      (!asset.id.startsWith("content:") || !packagedShotIds.has(asset.id)) &&
      (asset.id === props.selectedAssetId ||
        !contentShotById(asset.id) ||
        (purpose === "SHOPIFY"
          ? contentShotById(asset.id)!.intents.includes("SHOPIFY")
          : contentShotById(asset.id)!.intents.some(
              (intent) => intent !== "SHOPIFY",
            ))),
  );

  function selectPurpose(nextMode: ImageContentMode) {
    props.onContentModeChange(nextMode);
    if (nextMode === "SHOPIFY_MOCKUP") setMode("BASE");
    const current = props.selectedAssetId
      ? contentShotById(props.selectedAssetId)
      : null;
    const matches = (definition: NonNullable<typeof current>) =>
      nextMode === "SHOPIFY_MOCKUP"
        ? definition.intents.includes("SHOPIFY")
        : definition.intents.some((intent) => intent !== "SHOPIFY");
    if (
      current &&
      matches(current) &&
      (nextMode !== "SHOPIFY_MOCKUP" ||
        (SHOPIFY_STANDARD_SHOT_IDS as readonly string[]).includes(current.id))
    )
      return;
    const preferredIds =
      nextMode === "SHOPIFY_MOCKUP"
        ? SHOPIFY_STANDARD_SHOT_IDS
        : [
            "content:lifestyle-with-model",
            "content:social-hero-story",
            "content:premium-flatlay",
          ];
    const replacement = preferredIds
      .map((id) => props.assets.find((asset) => asset.id === id) ?? null)
      .find(
        (asset) =>
          asset && isShotCompatible(asset.id, props.productType),
      );
    if (replacement) props.onSelect(replacement);
  }

  return (
    <section
      className="nx-card is-content-packs"
      aria-labelledby="content-pack-heading"
      aria-busy={shotOptionsLoading}
    >
      <div className="is-v2-section-head">
        <div>
          <p className="nx-page-header__eyebrow">Output-Ziel</p>
          <h3 id="content-pack-heading">Was möchtest du erstellen?</h3>
          <p>
            Wähle anschließend genau einen Content-Stil für dein nächstes Bild.
          </p>
        </div>
        <span className="nx-status nx-status--success">
          <ShieldCheck className="size-4" /> Ein Bild pro Erstellung
        </span>
      </div>
      <p className="is-content-pack-availability" role="status">
        {shotOptionsLoading
          ? "Aufnahmen werden vorbereitet …"
          : props.productType
            ? "Aufnahmen sind auswählbar."
            : "Wähle zuerst eine Produktfamilie für die genaue Verfügbarkeit."}
      </p>
      <div
        className="is-content-purpose-grid"
        role="radiogroup"
        aria-label="Inhaltstyp"
      >
        <button
          type="button"
          role="radio"
          aria-checked={purpose === "SOCIAL"}
          className={purpose === "SOCIAL" ? "is-selected" : ""}
          onClick={() => selectPurpose("SOCIAL_CONTENT")}
        >
          <strong>Social Content</strong>
          <span>
            Vielfältige Assets für Feed, Story, Anzeigen und Kampagnen.
          </span>
          {purpose === "SOCIAL" ? <em>Ausgewählt</em> : null}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={purpose === "SHOPIFY"}
          className={purpose === "SHOPIFY" ? "is-selected" : ""}
          onClick={() => selectPurpose("SHOPIFY_MOCKUP")}
        >
          <strong>Shopify Mockups</strong>
          <span>1–3 saubere, konsistente Produktbilder für den Shop.</span>
          {purpose === "SHOPIFY" ? <em>Ausgewählt</em> : null}
        </button>
      </div>
      {purpose === "SOCIAL" ? (
        <div
          className="is-content-pack-tabs"
          role="tablist"
          aria-label="Content Pack"
        >
          {(
            [
              ["BASE", "Basis-Pack"],
              ["WINNING_EXPANSION", "Winning Design Expansion"],
              ["CUSTOM", "Eigene Auswahl"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "is-selected" : ""}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {activePackMode !== "CUSTOM" ? (
        <>
          <div className="is-content-pack-summary">
            <strong>
              {purpose === "SHOPIFY"
                ? "Shopify Standard"
                : activePackMode === "WINNING_EXPANSION"
                  ? "Mehr Content aus diesem Gewinner-Design"
                  : CONTENT_PACKS[activePackMode].label}
            </strong>
            <span>
              {purpose === "SHOPIFY"
                ? "Drei ruhige, konsistente Optionen für deinen Shop."
                : CONTENT_PACKS[activePackMode].description}
            </span>
            <span>
              {createdCount} von {visibleProgress.length} erstellt ·{" "}
              {approvedCount} freigegeben
            </span>
          </div>
          {groupedPackShots.map(([category, shots]) => (
            <section className="is-content-shot-group" key={category || "shots"}>
              {category ? <h4>{category}</h4> : null}
              <div className="is-content-pack-grid">
                {shots.map(({ definition, compatible, asset, status }) => (
                <button
                  key={definition.id}
                  type="button"
                  className={`is-content-shot${props.selectedAssetId === definition.id ? " is-selected" : ""}`}
                  aria-pressed={props.selectedAssetId === definition.id}
                  disabled={!compatible || !asset}
                  onClick={() => asset && props.onSelect(asset)}
                  title={
                    !compatible
                      ? "Diese Aufnahme passt nicht zum verifizierten Produkttyp."
                      : !asset
                        ? shotOptionsLoading
                          ? "Die Aufnahmen werden gerade vorbereitet."
                          : "Diese Aufnahme ist im aktuellen Projektplan noch nicht verfügbar."
                      : undefined
                  }
                >
                  <span
                    className={`is-content-shot__status is-${status.toLocaleLowerCase()}`}
                  >
                    <ProgressIcon status={status} />{" "}
                    {CONTENT_PACK_PROGRESS_LABELS[status]}
                  </span>
                  {props.selectedAssetId === definition.id ? (
                    <span className="is-content-shot__selected">
                      <CheckCircle2 className="size-4" /> Ausgewählt
                    </span>
                  ) : null}
                  <strong>{definition.label}</strong>
                  <small>{definition.description}</small>
                  <span className="is-content-shot__meta">
                    {definition.intents
                      .map((intent) => INTENT_LABELS[intent])
                      .join(" · ")}
                  </span>
                  {!compatible ? (
                    <em>Für dieses Produkt nicht verfügbar.</em>
                  ) : !asset ? (
                    <em>
                      {shotOptionsLoading
                        ? "Aufnahmen werden vorbereitet …"
                        : "Im aktuellen Projektplan nicht verfügbar."}
                    </em>
                  ) : null}
                </button>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <div className="is-content-custom">
          <strong>Eigene Auswahl</strong>
          <p>Wähle eine einzelne Aufnahme aus deinem vorhandenen Plan.</p>
          <div className="is-content-custom-grid">
            {customAssets.map((asset) => {
              const definition = contentShotById(asset.id);
              const compatible = isShotCompatible(asset.id, props.productType);
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={!compatible}
                  className={
                    props.selectedAssetId === asset.id ? "is-selected" : ""
                  }
                  aria-pressed={props.selectedAssetId === asset.id}
                  onClick={() => props.onSelect(asset)}
                >
                  <strong>
                    {definition?.label ?? ownerShotLabel(asset.title)}
                  </strong>
                  <span>
                    {props.selectedAssetId === asset.id
                      ? "Ausgewählt"
                      : compatible
                        ? "Auswählen"
                        : "Nicht passend für diesen Produkttyp"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
