"use client";

import { Check, Images, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";

type ArtworkLibraryResponse = {
  success?: boolean;
  artworks?: ApprovedMasterArtworkView[];
  error?: string;
};

export function ArtworkLibrarySelector(props: {
  currentArtworkId: string | null;
  currentLabel: string;
  onSelect: (artwork: ApprovedMasterArtworkView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [artworks, setArtworks] = useState<ApprovedMasterArtworkView[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/design/master-artworks", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as ArtworkLibraryResponse;
        if (!response.ok) {
          throw new Error(
            payload.error ?? "Die Artwork-Bibliothek konnte nicht geladen werden.",
          );
        }
        return (payload.artworks ?? []).filter(
          (artwork) => artwork.status === "APPROVED",
        );
      })
      .then((approved) => {
        if (!cancelled) {
          setArtworks(approved);
          setLoaded(true);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Die Artwork-Bibliothek konnte nicht geladen werden.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, open]);

  const orderedArtworks = useMemo(
    () =>
      [...artworks].sort((left, right) => {
        if (left.id === props.currentArtworkId) return -1;
        if (right.id === props.currentArtworkId) return 1;
        return (left.displayName ?? left.originalFileName ?? left.designId)
          .localeCompare(
            right.displayName ?? right.originalFileName ?? right.designId,
            "de",
          );
      }),
    [artworks, props.currentArtworkId],
  );

  return (
    <div className="is-artwork-library-selector">
      <button
        type="button"
        className="nx-button"
        aria-expanded={open}
        aria-controls="image-artwork-library"
        onClick={() => setOpen((current) => !current)}
      >
        <Images className="size-4" />
        {props.currentArtworkId ? "Artwork wechseln" : "Artwork auswählen"}
      </button>

      {open ? (
        <div
          id="image-artwork-library"
          className="is-artwork-library-popover"
          role="dialog"
          aria-label="Artwork-Bibliothek"
          aria-busy={loading}
        >
          <div className="is-artwork-library-head">
            <div>
              <strong>Artwork-Bibliothek</strong>
              <span>Wähle ein freigegebenes Artwork.</span>
            </div>
            <button
              type="button"
              className="nx-icon-button"
              aria-label="Artwork-Bibliothek schließen"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="is-artwork-library-list-frame">
            {loading ? (
              <p className="nx-loading" role="status">
                <Loader2 className="size-4 animate-spin" /> Artworks werden
                geladen …
              </p>
            ) : null}
            {error ? (
              <p className="nx-notice nx-notice--error" role="alert">
                {error}
              </p>
            ) : null}
            {!loading && !error && artworks.length === 0 ? (
              <p className="nx-notice nx-notice--info">
                Noch kein freigegebenes Artwork vorhanden.
              </p>
            ) : null}

            <div
              className="is-artwork-library-grid"
              aria-label="Freigegebene Artworks"
            >
              {orderedArtworks.map((artwork) => {
                const selected = artwork.id === props.currentArtworkId;
                const label =
                  artwork.displayName?.trim() ||
                  artwork.originalFileName?.trim() ||
                  artwork.designId;
                return (
                  <button
                    key={artwork.id}
                    type="button"
                    className={`is-artwork-library-item${selected ? " is-selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => {
                      props.onSelect(artwork);
                      setOpen(false);
                    }}
                  >
                    <span className="is-artwork-library-thumb">
                      {/* Authenticated, workspace-scoped route; no storage path is exposed. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/design/master-artworks/${artwork.id}`}
                        alt={`Vorschau: ${label}`}
                      />
                    </span>
                    <span className="is-artwork-library-copy">
                      <strong>{label}</strong>
                      {artwork.originalFileName &&
                      artwork.originalFileName !== label ? (
                        <small>{artwork.originalFileName}</small>
                      ) : null}
                      <em>
                        {selected ? (
                          <>
                            <Check className="size-3.5" /> Ausgewählt
                          </>
                        ) : (
                          "Freigegeben"
                        )}
                      </em>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {props.currentArtworkId ? (
            <p className="is-artwork-library-current">
              Aktuell: {props.currentLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
