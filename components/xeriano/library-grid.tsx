"use client";

import { Download, Eraser, Heart, ImageIcon, Library, Maximize2, MoreHorizontal, Palette, Play, Plus, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createSecureBrowserUuid } from "@/lib/browser/secure-uuid";
import {
  DesignUtilityClientError, fetchDesignUtilityQuote, submitDesignUtility,
  submitSvgToPng, type DesignQuotePresentation,
} from "@/lib/design-studio/client";
import type { XerianoLibraryAsset } from "@/lib/xeriano/library";
import { handoffHref } from "@/lib/xeriano/library";

const filters = [
  ["ALL", "Alle"],
  ["IMAGE", "Bilder"],
  ["VIDEO", "Videos"],
  ["DESIGN", "Designs"],
  ["FAVORITE", "Favoriten"],
] as const;

type Filter = (typeof filters)[number][0];

function assetHref(asset: XerianoLibraryAsset, basePath: string) {
  return asset.assetType === "DESIGN"
    ? `${basePath === "/hq/library" ? "/hq" : "/app"}/design-studio?asset=${encodeURIComponent(asset.id)}&mode=edit`
    : asset.creationId
      ? `${basePath}/${encodeURIComponent(asset.creationId)}`
      : `/api/xeriano/library/${encodeURIComponent(asset.id)}/content`;
}

export function XerianoLibraryGrid({
  basePath = "/app/library",
}: {
  basePath?: "/app/library" | "/hq/library";
} = {}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [assets, setAssets] = useState<XerianoLibraryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [utilityBusy, setUtilityBusy] = useState<string | null>(null);
  const [utilityQuotes, setUtilityQuotes] = useState<Partial<Record<"BACKGROUND_REMOVE" | "UPSCALE", DesignQuotePresentation>>>({});
  const audience = basePath === "/hq/library" ? "OWNER" : "CUSTOMER";
  const studioRoot = audience === "OWNER" ? "/hq" : "/app";

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      const params = new URLSearchParams({ offset: String(offset) });
      if (filter === "FAVORITE") params.set("favorite", "1");
      else if (filter !== "ALL") params.set("type", filter);
      try {
        const response = await fetch(`/api/xeriano/library?${params}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          assets?: XerianoLibraryAsset[];
          total?: number;
          error?: string;
        };
        if (!response.ok || !payload.assets) {
          throw new Error(payload.error ?? "Bibliothek nicht verfügbar.");
        }
        setAssets((current) =>
          offset === 0 ? payload.assets! : [...current, ...payload.assets!],
        );
        setTotal(payload.total ?? payload.assets.length);
        setError(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Bibliothek nicht verfügbar.",
        );
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  useEffect(() => {
    void Promise.all((["BACKGROUND_REMOVE", "UPSCALE"] as const).map(async (operation) => {
      const quote = await fetchDesignUtilityQuote(operation);
      setUtilityQuotes((current) => ({ ...current, [operation]: quote }));
    })).catch(() => undefined);
  }, []);

  async function toggleFavorite(asset: XerianoLibraryAsset) {
    const endpoint = asset.creationId
      ? `/api/xeriano/creations/${asset.creationId}`
      : `/api/xeriano/library/${asset.id}`;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !asset.favorite }),
    });
    if (response.ok) {
      setAssets((current) =>
        current.map((candidate) =>
          candidate.id === asset.id
            ? { ...candidate, favorite: !candidate.favorite }
            : candidate,
        ),
      );
    }
  }

  function utilityLabel(operation: "BACKGROUND_REMOVE" | "UPSCALE", label: string) {
    const quote = utilityQuotes[operation];
    if (audience === "OWNER") return quote?.ownerCostLabel ? `${label} · ${quote.ownerCostLabel}` : label;
    return quote?.credits ? `${label} · ${quote.credits} Credits` : label;
  }

  function utilityReady(operation: "BACKGROUND_REMOVE" | "UPSCALE") {
    const quote = utilityQuotes[operation];
    return audience === "OWNER" ? Boolean(quote?.ownerCostLabel) : quote?.credits != null;
  }

  async function runUtility(asset: XerianoLibraryAsset, operation: "BACKGROUND_REMOVE" | "UPSCALE") {
    const ready = utilityReady(operation);
    if (!ready || utilityBusy) return;
    const storageKey = `xeriamo-design-utility-job-v1:${asset.id}:${operation}`;
    let jobId: string;
    try {
      jobId = window.localStorage.getItem(storageKey) ?? createSecureBrowserUuid();
      window.localStorage.setItem(storageKey, jobId);
    } catch {
      setNotice("Die Aktion konnte nicht sicher gestartet werden.");
      return;
    }
    setUtilityBusy(`${asset.id}:${operation}`);
    setNotice(operation === "BACKGROUND_REMOVE" ? "Hintergrund wird entfernt …" : "Wird auf 4K hochskaliert …");
    try {
      await submitDesignUtility({ jobId, sourceAssetId: asset.id, operation });
      window.localStorage.removeItem(storageKey);
      setNotice(operation === "BACKGROUND_REMOVE" ? "Hintergrund entfernt" : "4K-Version erstellt");
      await load(0);
    } catch (caught) {
      if (caught instanceof DesignUtilityClientError && [400, 402, 404].includes(caught.status)) {
        window.localStorage.removeItem(storageKey);
      }
      setNotice(caught instanceof Error ? caught.message : "Die Aktion konnte nicht abgeschlossen werden.");
    } finally {
      setUtilityBusy(null);
    }
  }

  async function createPngVersion(asset: XerianoLibraryAsset) {
    if (!asset.design?.canCreatePng || utilityBusy) return;
    const storageKey = `xeriamo-svg-to-png-job-v1:${asset.id}`;
    let jobId: string;
    try {
      jobId = window.localStorage.getItem(storageKey) ?? createSecureBrowserUuid();
      window.localStorage.setItem(storageKey, jobId);
    } catch {
      setNotice("Die PNG-Version konnte nicht sicher gestartet werden.");
      return;
    }
    setUtilityBusy(`${asset.id}:SVG_TO_PNG`);
    setNotice("PNG-Version wird erstellt …");
    try {
      await submitSvgToPng({ jobId, sourceAssetId: asset.id });
      window.localStorage.removeItem(storageKey);
      setNotice("PNG-Version erstellt");
      await load(0);
    } catch (caught) {
      if (caught instanceof DesignUtilityClientError && [400, 401, 403, 404].includes(caught.status)) {
        window.localStorage.removeItem(storageKey);
      }
      setNotice(caught instanceof Error ? caught.message : "PNG-Version konnte nicht erstellt werden.");
    } finally {
      setUtilityBusy(null);
    }
  }

  return (
    <div className="xeriano-creation-library">
      {notice ? <div className="xeriano-inline-notice" role="status">{notice}<button aria-label="Hinweis schließen" onClick={() => setNotice(null)}>×</button></div> : null}
      <div className="xeriano-filter-row" aria-label="Bibliothek filtern">
        {filters.map(([id, label]) => (
          <button
            type="button"
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="xeriano-inline-notice">{error}</div>
      ) : assets.length ? (
        <>
          <div className="xeriano-creation-grid">
            {assets.map((asset) => (
              <article className={`xeriano-creation-tile${asset.design?.transparentPreview ? " xeriamo-transparency-preview" : ""}`} key={asset.id}>
                <Link href={assetHref(asset, basePath)} aria-label={`${asset.title} öffnen`}>
                  {asset.mimeType.startsWith("image/") ? (
                    <Image
                      src={`/api/xeriano/library/${asset.id}/content${asset.mimeType === "image/svg+xml" ? "?preview=1" : ""}`}
                      alt={asset.title}
                      fill
                      sizes="(max-width: 560px) 50vw, (max-width: 1000px) 33vw, 25vw"
                      unoptimized
                    />
                  ) : asset.mimeType.startsWith("video/") ? (
                    <>
                      <video
                        src={`/api/xeriano/library/${asset.id}/content`}
                        preload="metadata"
                        muted
                      />
                      <span className="xeriano-creation-video-mark">
                        <Play size={17} fill="currentColor" />
                      </span>
                    </>
                  ) : (
                    <Library />
                  )}
                  <span className="xeriano-creation-tile__label">
                    {asset.title}
                  </span>
                </Link>
                <button
                  type="button"
                  className="xeriano-creation-favorite"
                  onClick={() => void toggleFavorite(asset)}
                  aria-label={
                    asset.favorite
                      ? "Aus Favoriten entfernen"
                      : "Zu Favoriten hinzufügen"
                  }
                >
                  <Heart
                    size={17}
                    fill={asset.favorite ? "currentColor" : "none"}
                  />
                </button>
                {asset.assetType === "DESIGN" ? <details className="xeriano-library-actions">
                  <summary aria-label={`Aktionen für ${asset.title}`}><MoreHorizontal size={18}/></summary>
                  <div>
                    <Link href={`${studioRoot}/design-studio?asset=${encodeURIComponent(asset.id)}&mode=edit`}><Palette/>Im Design Studio bearbeiten</Link>
                    <Link href={`${studioRoot}/design-studio?asset=${encodeURIComponent(asset.id)}&mode=variation`}><Sparkles/>Variation erstellen</Link>
                    {asset.design?.canCreatePng ? <button disabled={Boolean(utilityBusy)} onClick={() => void createPngVersion(asset)}><ImageIcon/>{utilityBusy === `${asset.id}:SVG_TO_PNG` ? "PNG-Version wird erstellt …" : "PNG-Version erstellen"}</button> : null}
                    {asset.design?.canBackgroundRemove ? <button disabled={Boolean(utilityBusy) || !utilityReady("BACKGROUND_REMOVE")} onClick={() => void runUtility(asset, "BACKGROUND_REMOVE")}><Eraser/>{utilityBusy === `${asset.id}:BACKGROUND_REMOVE` ? "Hintergrund wird entfernt …" : utilityLabel("BACKGROUND_REMOVE", "Hintergrund entfernen")}</button> : null}
                    {asset.design?.canUpscale ? <button disabled={Boolean(utilityBusy) || !utilityReady("UPSCALE")} onClick={() => void runUtility(asset, "UPSCALE")}><Maximize2/>{utilityBusy === `${asset.id}:UPSCALE` ? "Wird auf 4K hochskaliert …" : utilityLabel("UPSCALE", "Auf 4K upscalen")}</button> : null}
                    <Link href={handoffHref(asset.id, "CREATIVE_STUDIO", audience)}><Plus/>Im Creative Studio verwenden</Link>
                    <a href={`/api/xeriano/library/${asset.id}/content?download=1`}><Download/>{asset.mimeType === "image/svg+xml" ? "SVG herunterladen" : "Herunterladen"}</a>
                    <Link href={`${studioRoot}/design-studio?asset=${encodeURIComponent(asset.id)}&mode=details`}>Details bearbeiten</Link>
                    <button onClick={() => void toggleFavorite(asset)}><Heart/>Favorit</button>
                  </div>
                </details> : null}
              </article>
            ))}
          </div>
          {assets.length < total ? (
            <button
              type="button"
              className="xeriano-library-more"
              disabled={loading}
              onClick={() => void load(assets.length)}
            >
              {loading ? "Wird geladen …" : "Mehr anzeigen"}
            </button>
          ) : null}
        </>
      ) : loading ? (
        <div className="xeriano-empty"><p>Bibliothek wird geladen …</p></div>
      ) : (
        <div className="xeriano-empty">
          <Library />
          <h2>Deine Bibliothek ist noch leer</h2>
          <p>Designs und Kreationen erscheinen hier automatisch.</p>
        </div>
      )}
    </div>
  );
}
