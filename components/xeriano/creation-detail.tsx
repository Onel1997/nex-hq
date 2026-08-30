"use client";

import {
  Check,
  Copy,
  Download,
  Heart,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  creationStudioHref,
  creationVideoHref,
  xerianoCreationSchema,
  type XerianoCreation,
} from "@/lib/xeriano/creation-contracts";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function XerianoCreationDetail({ creationId }: { creationId: string }) {
  const [creation, setCreation] = useState<XerianoCreation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/xeriano/creations/${encodeURIComponent(creationId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          creation?: unknown;
          error?: string;
        };
        if (!response.ok || !payload.creation) {
          throw new Error(payload.error ?? "Kreation nicht verfügbar.");
        }
        const parsed = xerianoCreationSchema.parse(payload.creation);
        if (!cancelled) setCreation(parsed);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Kreation nicht verfügbar.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creationId]);

  async function toggleFavorite() {
    if (!creation) return;
    const response = await fetch(`/api/xeriano/creations/${creation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !creation.favorite }),
    });
    if (response.ok) {
      setCreation({ ...creation, favorite: !creation.favorite });
    }
  }

  async function copyPrompt() {
    if (!creation) return;
    await navigator.clipboard.writeText(creation.originalPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (error) return <div className="xeriano-inline-notice">{error}</div>;
  if (!creation) return <div className="xeriano-empty">Kreation wird geladen …</div>;

  const aspectRatio = String(creation.settings.aspectRatio ?? "—");
  const quality = String(creation.settings.quality ?? "—");
  const width = creation.settings.width;
  const height = creation.settings.height;

  return (
    <article className="xeriano-creation-detail">
      <div className="xeriano-creation-detail__visual">
        {creation.creationType === "IMAGE" ? (
          <Image
            src={creation.resultContentUrl}
            alt={creation.title}
            fill
            sizes="(max-width: 900px) 100vw, 62vw"
            priority
            unoptimized
          />
        ) : (
          <video src={creation.resultContentUrl} controls playsInline />
        )}
      </div>

      <div className="xeriano-creation-detail__actions">
        {creation.creationType === "IMAGE" ? (
          <>
            <Link className="is-primary" href={creationStudioHref(creation.id, "edit")}>
              <Pencil size={18} /> Bild bearbeiten
            </Link>
            <Link href={creationStudioHref(creation.id, "recreate")}>
              <RotateCcw size={18} /> Neu erstellen
            </Link>
            <Link href={creationVideoHref(creation.assetId)}>
              <Video size={18} /> Video erstellen
            </Link>
          </>
        ) : null}
      </div>

      <div className="xeriano-creation-detail__secondary">
        <button type="button" onClick={() => void toggleFavorite()}>
          <Heart size={17} fill={creation.favorite ? "currentColor" : "none"} />
          Favorit
        </button>
        <a href={creation.resultDownloadUrl} download>
          <Download size={17} /> Herunterladen
        </a>
        <details>
          <summary><MoreHorizontal size={17} /> Mehr</summary>
          <div><span>In Bibliothek</span></div>
        </details>
      </div>

      <section className="xeriano-creation-prompt">
        <header>
          <div>
            <span className="xeriano-eyebrow">Original-Setup</span>
            <h2>Prompt</h2>
          </div>
          <button type="button" onClick={() => void copyPrompt()}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Kopiert" : "Kopieren"}
          </button>
        </header>
        {creation.references?.length ? (
          <div className="xeriano-creation-references" aria-label="Originale Referenzen">
            {creation.references.map((reference) => (
              <div key={reference.id} title={`${reference.order + 1}. ${reference.filename}`}>
                {reference.mimeType.startsWith("image/") ? (
                  <Image
                    src={reference.contentUrl}
                    alt={`Referenz ${reference.order + 1}`}
                    fill
                    sizes="72px"
                    unoptimized
                  />
                ) : (
                  <ImageIcon size={19} />
                )}
                <span>{reference.order + 1}</span>
              </div>
            ))}
          </div>
        ) : null}
        <details open={creation.originalPrompt.length < 500}>
          <summary>Vollständigen Prompt anzeigen</summary>
          <p>{creation.originalPrompt}</p>
        </details>
      </section>

      <details className="xeriano-creation-details">
        <summary>Details</summary>
        <dl>
          <div><dt>Modell</dt><dd>{creation.modelId}</dd></div>
          <div><dt>Qualität</dt><dd>{quality}</dd></div>
          <div><dt>Seitenverhältnis</dt><dd>{aspectRatio}</dd></div>
          {typeof width === "number" && typeof height === "number" ? (
            <div><dt>Größe</dt><dd>{width} × {height}</dd></div>
          ) : null}
          <div><dt>Erstellt</dt><dd>{formatDate(creation.createdAt)}</dd></div>
          <div><dt>Credits</dt><dd>{creation.creditCost}</dd></div>
        </dl>
      </details>
    </article>
  );
}
