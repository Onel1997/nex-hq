"use client";

import { useCallback, useState } from "react";
import type { NormalizedImageAsset } from "@/agents/image/types";
import type { ImageGenerationProvider } from "@/agents/image/types-generation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ImageIcon, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CompactAssetCardProps {
  asset: NormalizedImageAsset;
  reportId: string;
  reportRecordId: string;
  onUpdated: (asset: NormalizedImageAsset) => void;
}

function statusLabel(
  status: NormalizedImageAsset["status"],
  t: ReturnType<typeof useT>,
) {
  switch (status) {
    case "ready":
      return t("image.interface.statusReady");
    case "generating":
      return t("image.interface.statusGenerating");
    case "completed":
      return t("image.interface.statusCompleted");
    case "failed":
      return t("image.interface.statusFailed");
    default:
      return status;
  }
}

export function CompactAssetCard({
  asset,
  reportId,
  reportRecordId,
  onUpdated,
}: CompactAssetCardProps) {
  const t = useT();
  const [provider, setProvider] = useState<ImageGenerationProvider>("openai");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportRecordId,
          reportId,
          assetId: asset.id,
          provider,
          promptVariant: provider,
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
        storagePath: data.asset.storagePath,
        provider: data.asset.provider,
        createdAt: data.asset.createdAt,
        message: data.asset.message,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("image.errors.unexpected"));
    } finally {
      setIsGenerating(false);
    }
  }, [asset, isGenerating, onUpdated, provider, reportId, reportRecordId, t]);

  const activePrompt =
    provider === "flux" ? asset.prompt.flux : asset.prompt.openai;

  return (
    <li className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{asset.title}</p>
          <p className="text-xs text-muted-foreground">
            {asset.dimensions}
            {asset.platform ? ` · ${asset.platform}` : ""}
          </p>
        </div>
        <Badge variant="secondary" className="font-normal text-xs">
          {statusLabel(isGenerating ? "generating" : asset.status, t)}
        </Badge>
      </div>

      {asset.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.imageUrl}
          alt={asset.title}
          className="aspect-video w-full rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-background/40">
          <ImageIcon className="size-8 text-muted-foreground/40" />
        </div>
      )}

      {showPrompt && (
        <p className="text-xs text-muted-foreground line-clamp-4">{activePrompt}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ImageGenerationProvider)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="openai">{t("image.interface.providerOpenai")}</option>
          <option value="flux">{t("image.interface.providerFlux")}</option>
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium",
            "hover:bg-muted/40 disabled:opacity-50",
          )}
        >
          {isGenerating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ImageIcon className="size-3.5" />
          )}
          {isGenerating
            ? t("image.interface.generating")
            : t("image.interface.generate")}
        </button>
        <button
          type="button"
          onClick={() => setShowPrompt((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
        >
          <Pencil className="size-3.5" />
          {showPrompt
            ? t("image.interface.hidePrompt")
            : t("image.interface.editPrompt")}
        </button>
      </div>

      {asset.createdAt && (
        <p className="text-xs text-muted-foreground">
          {t("image.interface.generatedAt")}:{" "}
          {new Date(asset.createdAt).toLocaleString()}
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}
