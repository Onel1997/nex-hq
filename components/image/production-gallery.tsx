"use client";

import type { ImageStudioAsset } from "@/agents/image/types";
import { ImageGenerationCard } from "@/components/image/image-generation-card";
import { cn } from "@/lib/utils";
import {
  Columns2,
  Heart,
  Maximize2,
  Star,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ProductionGalleryProps {
  assets: ImageStudioAsset[];
  reportId: string;
  reportRecordId: string;
  selectedAssetId: string | null;
  confidence?: number;
  favorites: Set<string>;
  approved: Set<string>;
  revisions: Set<string>;
  compareMode: boolean;
  onSelectAsset: (asset: ImageStudioAsset) => void;
  onUpdated: (asset: ImageStudioAsset) => void;
  onToggleFavorite: (assetId: string) => void;
  onApprove: (assetId: string) => void;
  onNeedsRevision: (assetId: string) => void;
  onToggleCompare: () => void;
}

export function ProductionGallery({
  assets,
  reportId,
  reportRecordId,
  selectedAssetId,
  confidence,
  favorites,
  approved,
  revisions,
  compareMode,
  onSelectAsset,
  onUpdated,
  onToggleFavorite,
  onApprove,
  onNeedsRevision,
  onToggleCompare,
}: ProductionGalleryProps) {
  const [fullscreenAsset, setFullscreenAsset] = useState<ImageStudioAsset | null>(null);
  const [zoom, setZoom] = useState(1);
  const [versionIndex, setVersionIndex] = useState(0);

  const closeFullscreen = useCallback(() => {
    setFullscreenAsset(null);
    setZoom(1);
  }, []);

  return (
    <>
      <div className="is-gallery-chrome">
        <div className="is-gallery-tools">
          <span className="is-gallery-tool-label">Grid</span>
          <button
            type="button"
            className={cn("is-gallery-tool", compareMode && "active")}
            onClick={onToggleCompare}
            title="Compare versions"
          >
            <Columns2 className="size-3.5" />
            Compare
          </button>
          <button
            type="button"
            className="is-gallery-tool"
            disabled={!selectedAssetId}
            onClick={() => {
              const asset = assets.find((a) => a.id === selectedAssetId);
              if (asset?.imageUrl) setFullscreenAsset(asset);
            }}
            title="Fullscreen preview"
          >
            <Maximize2 className="size-3.5" />
            Preview
          </button>
        </div>
        <div className="is-gallery-version">
          <span className="is-gallery-tool-label">Version</span>
          <button
            type="button"
            className="is-gallery-tool"
            disabled={versionIndex <= 0}
            onClick={() => setVersionIndex((v) => Math.max(0, v - 1))}
          >
            V{versionIndex || 1}
          </button>
          <button
            type="button"
            className="is-gallery-tool"
            onClick={() => setVersionIndex((v) => v + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className={cn("is-grid-wrap", compareMode && "is-grid-wrap--compare")}>
        <div className={cn("is-grid", compareMode && "is-grid--compare")}>
          {assets.map((asset) => (
            <ImageGenerationCard
              key={asset.id}
              asset={asset}
              reportId={reportId}
              reportRecordId={reportRecordId}
              selected={selectedAssetId === asset.id}
              confidence={confidence}
              isFavorite={favorites.has(asset.id)}
              isApproved={approved.has(asset.id)}
              needsRevision={revisions.has(asset.id)}
              onSelect={() => onSelectAsset(asset)}
              onUpdated={onUpdated}
              onToggleFavorite={() => onToggleFavorite(asset.id)}
              onApprove={() => onApprove(asset.id)}
              onNeedsRevision={() => onNeedsRevision(asset.id)}
              onFullscreen={() => asset.imageUrl && setFullscreenAsset(asset)}
            />
          ))}
        </div>
      </div>

      {fullscreenAsset?.imageUrl ? (
        <div className="is-fullscreen" role="dialog" aria-modal="true">
          <div className="is-fullscreen-backdrop" onClick={closeFullscreen} aria-hidden />
          <div className="is-fullscreen-panel">
            <header className="is-fullscreen-header">
              <span>{fullscreenAsset.title ?? fullscreenAsset.productName}</span>
              <div className="is-fullscreen-actions">
                <button type="button" className="is-fullscreen-btn" onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>
                  <ZoomIn className="size-4" />
                </button>
                <button type="button" className="is-fullscreen-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="size-4" />
                </button>
                <button type="button" className="is-fullscreen-btn" onClick={() => onToggleFavorite(fullscreenAsset.id)}>
                  <Heart className={cn("size-4", favorites.has(fullscreenAsset.id) && "fill-current")} />
                </button>
                <button type="button" className="is-fullscreen-btn" onClick={() => onApprove(fullscreenAsset.id)}>
                  <Star className="size-4" />
                </button>
                <button type="button" className="is-fullscreen-btn" onClick={closeFullscreen}>
                  <X className="size-4" />
                </button>
              </div>
            </header>
            <div className="is-fullscreen-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullscreenAsset.imageUrl}
                alt={fullscreenAsset.title ?? fullscreenAsset.productName}
                style={{ transform: `scale(${zoom})` }}
                className="is-fullscreen-img"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
