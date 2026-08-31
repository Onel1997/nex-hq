"use client";

import { Heart, Library, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { XerianoLibraryAsset } from "@/lib/xeriano/library";

const filters = [
  ["ALL", "Alle"],
  ["IMAGE", "Bilder"],
  ["VIDEO", "Videos"],
  ["DESIGN", "Designs"],
  ["FAVORITE", "Favoriten"],
] as const;

type Filter = (typeof filters)[number][0];

function assetHref(asset: XerianoLibraryAsset, basePath: string) {
  return asset.creationId
    ? `${basePath}/${encodeURIComponent(asset.creationId)}`
    : asset.assetType === "DESIGN"
      ? `${basePath === "/hq/library" ? "/hq" : "/app"}/design-studio?asset=${encodeURIComponent(asset.id)}`
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

  return (
    <div className="xeriano-creation-library">
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
              <article className="xeriano-creation-tile" key={asset.id}>
                <Link href={assetHref(asset, basePath)} aria-label={`${asset.title} öffnen`}>
                  {asset.mimeType.startsWith("image/") ? (
                    <Image
                      src={`/api/xeriano/library/${asset.id}/content`}
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
