"use client";

import type { ImageStudioAsset } from "@/agents/image/types";
import type { ImageGenerationProvider } from "@/agents/image/types-generation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Check,
  Heart,
  ImageIcon,
  Maximize2,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ImageGenerationCardProps {
  asset: ImageStudioAsset;
  reportId: string;
  reportRecordId: string;
  selected?: boolean;
  isFavorite?: boolean;
  isApproved?: boolean;
  needsRevision?: boolean;
  onSelect?: () => void;
  onUpdated: (asset: ImageStudioAsset) => void;
  onToggleFavorite?: () => void;
  onApprove?: () => void;
  onNeedsRevision?: () => void;
  onFullscreen?: () => void;
  confidence?: number;
}

function deriveScores(confidence: number) {
  const base = Math.round(confidence * 100);
  return {
    commercial: Math.min(99, base + 4),
    luxury: Math.min(99, base + 2),
    brandFit: Math.min(99, base + 6),
  };
}

export function ImageGenerationCard({
  asset,
  reportId,
  reportRecordId,
  selected,
  isFavorite,
  isApproved,
  needsRevision,
  onSelect,
  onUpdated,
  onToggleFavorite,
  onApprove,
  onNeedsRevision,
  onFullscreen,
  confidence = 0.82,
}: ImageGenerationCardProps) {
  const t = useT();
  const [isGenerating, setIsGenerating] = useState(false);
  const scores = deriveScores(confidence);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportRecordId,
          reportId,
          assetId: asset.id,
          provider: "openai" as ImageGenerationProvider,
          promptVariant: "openai",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? t("image.errors.unexpected"));
      }

      onUpdated({
        ...asset,
        status: data.asset.status,
        imageUrl: data.asset.imageUrl,
        createdAt: data.asset.createdAt,
      });
    } catch {
      // Parent handles errors
    } finally {
      setIsGenerating(false);
    }
  }, [asset, isGenerating, onUpdated, reportId, reportRecordId, t]);

  const version = asset.createdAt
    ? `v${new Date(asset.createdAt).getTime().toString(36).slice(-4)}`
    : "v1";

  const statusLabel = isGenerating || asset.status === "generating"
    ? "Generating"
    : asset.imageUrl
      ? isApproved
        ? "Approved"
        : needsRevision
          ? "Needs Revision"
          : "Ready"
      : "Waiting";

  return (
    <article
      className={cn(
        "is-gen-card",
        selected && "selected",
        isApproved && "is-gen-card--approved",
        needsRevision && "is-gen-card--revision",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect?.();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="is-gen-preview">
        {asset.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.imageUrl} alt={asset.title ?? asset.productName} />
        ) : (
          <div className="is-gen-placeholder">
            {isGenerating || asset.status === "generating" ? (
              <span className="is-gen-status-text">Generating…</span>
            ) : (
              <ImageIcon className="size-10" />
            )}
          </div>
        )}

        <div className="is-gen-overlay" onClick={(e) => e.stopPropagation()}>
          {asset.imageUrl ? (
            <>
              <button type="button" className="is-gen-action" onClick={onFullscreen} title="Fullscreen">
                <Maximize2 className="size-3.5" />
              </button>
              <button type="button" className="is-gen-action" onClick={onToggleFavorite} title="Favorite">
                <Heart className={cn("size-3.5", isFavorite && "fill-current text-rose-400")} />
              </button>
              <button type="button" className="is-gen-action" onClick={onApprove} title="Approve">
                <Check className="size-3.5" />
              </button>
              <button type="button" className="is-gen-action" onClick={onNeedsRevision} title="Needs revision">
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <button type="button" className="is-gen-action is-gen-action--primary" onClick={() => void handleGenerate()}>
              <RefreshCw className={cn("size-3.5", isGenerating && "opacity-50")} />
              Generate
            </button>
          )}
        </div>

        <div className="is-gen-scores">
          <span className="is-score is-score--emerald" title="Commercial">
            {scores.commercial}
          </span>
          <span className="is-score is-score--gold" title="Luxury">
            {scores.luxury}
          </span>
          {isApproved ? <Star className="size-3 text-[var(--is-gold)]" /> : null}
        </div>
      </div>
      <div className="is-gen-meta">
        <p className="is-gen-title">{asset.title ?? asset.productName}</p>
        <div className="is-gen-details">
          <span>{version}</span>
          <span>{statusLabel}</span>
          {asset.createdAt ? (
            <span>{new Date(asset.createdAt).toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
