"use client";

import { useMemo, useState } from "react";
import type {
  ImageLookbookShot,
  ImageStudioAsset,
} from "@/agents/image/types";
import type { ImageMoodboardSection, ImagePalette } from "@/agents/image/types";
import { CompactAssetCard } from "@/components/image/compact-asset-card";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ImageProjectWorkspaceProps {
  reportId: string;
  reportRecordId: string;
  projectName: string;
  visualDirection?: string;
  moodboard: ImageMoodboardSection;
  palette: ImagePalette;
  productionAssets: ImageStudioAsset[];
  lookbookShots: ImageLookbookShot[];
  confidence: number;
  sourceReportTitles?: string[];
}

export function ImageProjectWorkspace({
  reportId,
  reportRecordId,
  projectName,
  visualDirection,
  moodboard,
  palette,
  productionAssets: initialAssets,
  lookbookShots,
  confidence,
  sourceReportTitles = [],
}: ImageProjectWorkspaceProps) {
  const t = useT();
  const [productionAssets, setProductionAssets] = useState(initialAssets);
  const [secondaryOpen, setSecondaryOpen] = useState(true);

  const { primaryAssets, secondaryAssets } = useMemo(() => {
    const primary = productionAssets.filter(
      (a) =>
        a.outputCategory === "product_photography" ||
        a.outputCategory === "launch_assets",
    );
    const secondary = productionAssets.filter(
      (a) =>
        a.outputCategory === "editorial_campaign" ||
        a.outputCategory === "social_media" ||
        a.outputCategory === "lookbook",
    );
    return {
      primaryAssets: primary.length ? primary : productionAssets.slice(0, 12),
      secondaryAssets: secondary.length
        ? secondary
        : productionAssets.slice(12),
    };
  }, [productionAssets]);

  const updateAsset = (updated: ImageStudioAsset) => {
    setProductionAssets((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const paletteItems = useMemo(
    () => [
      { label: t("image.interface.palettePrimary"), value: palette.primary },
      { label: t("image.interface.paletteSecondary"), value: palette.secondary },
      { label: t("image.interface.paletteAccent"), value: palette.accent },
    ],
    [palette, t],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="font-display text-3xl font-medium">{projectName}</h3>
        <p className="text-sm text-muted-foreground">
          {t("image.interface.confidence")}: {Math.round(confidence * 100)}% ·{" "}
          {productionAssets.length} production assets
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-label text-primary/80">{t("image.interface.moodboardSection")}</p>
        <p className="text-base leading-relaxed text-muted-foreground">
          {visualDirection ?? moodboard.visualDirection}
        </p>
        <div className="flex flex-wrap gap-2">
          {paletteItems.map((item) => (
            <Badge key={item.label} variant="secondary" className="font-normal">
              {item.label}: {item.value}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-label text-primary/80">
          Product & Launch ({primaryAssets.length})
        </p>
        <ul className="grid gap-4 lg:grid-cols-2">
          {primaryAssets.map((asset) => (
            <CompactAssetCard
              key={asset.id}
              asset={asset}
              reportId={reportId}
              reportRecordId={reportRecordId}
              onUpdated={updateAsset}
            />
          ))}
        </ul>
      </section>

      {secondaryAssets.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setSecondaryOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3 text-left"
          >
            <span className="text-label text-primary/80">
              Editorial, Social & Lookbook ({secondaryAssets.length})
            </span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                secondaryOpen && "rotate-180",
              )}
            />
          </button>
          {secondaryOpen ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {secondaryAssets.map((asset) => (
                <CompactAssetCard
                  key={asset.id}
                  asset={asset}
                  reportId={reportId}
                  reportRecordId={reportRecordId}
                  onUpdated={updateAsset}
                />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <p className="text-label text-primary/80">
          {t("image.interface.campaignShots")} ({lookbookShots.length})
        </p>
        <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {lookbookShots.map((shot) => (
            <li key={shot.shotName}>
              <span className="font-medium text-foreground">{shot.shotName}</span>{" "}
              · {shot.models} · {shot.location} — {shot.purpose}
            </li>
          ))}
        </ul>
      </section>

      {sourceReportTitles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sourceReportTitles.map((title) => (
            <Badge key={title} variant="outline" className="font-normal">
              {title}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
