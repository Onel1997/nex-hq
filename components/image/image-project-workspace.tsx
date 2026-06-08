"use client";

import { useMemo, useState } from "react";
import type { ImageCampaignShot, NormalizedImageAsset } from "@/agents/image/types";
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
  moodboard: ImageMoodboardSection;
  palette: ImagePalette;
  corePackage: NormalizedImageAsset[];
  advancedPackage: NormalizedImageAsset[];
  campaignShots: ImageCampaignShot[];
  confidence: number;
  sourceReportTitles?: string[];
}

export function ImageProjectWorkspace({
  reportId,
  reportRecordId,
  projectName,
  moodboard,
  palette,
  corePackage: initialCore,
  advancedPackage: initialAdvanced,
  campaignShots,
  confidence,
  sourceReportTitles = [],
}: ImageProjectWorkspaceProps) {
  const t = useT();
  const [corePackage, setCorePackage] = useState(initialCore);
  const [advancedPackage, setAdvancedPackage] = useState(initialAdvanced);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const updateAsset = (updated: NormalizedImageAsset) => {
    const apply = (list: NormalizedImageAsset[]) =>
      list.map((item) => (item.id === updated.id ? updated : item));

    if (updated.package === "core") {
      setCorePackage(apply);
    } else {
      setAdvancedPackage(apply);
    }
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
          {t("image.interface.confidence")}: {Math.round(confidence * 100)}%
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-label text-primary/80">{t("image.interface.moodboardSection")}</p>
        <p className="text-base leading-relaxed text-muted-foreground">
          {moodboard.visualDirection}
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
          {t("image.interface.corePackage")} ({corePackage.length})
        </p>
        <ul className="grid gap-4 lg:grid-cols-2">
          {corePackage.map((asset) => (
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

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3 text-left"
        >
          <span className="text-label text-primary/80">
            {t("image.interface.advancedPackage")} ({advancedPackage.length})
          </span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              advancedOpen && "rotate-180",
            )}
          />
        </button>
        {advancedOpen && (
          <ul className="grid gap-4 lg:grid-cols-2">
            {advancedPackage.map((asset) => (
              <CompactAssetCard
                key={asset.id}
                asset={asset}
                reportId={reportId}
                reportRecordId={reportRecordId}
                onUpdated={updateAsset}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-label text-primary/80">
          {t("image.interface.campaignShots")} ({campaignShots.length})
        </p>
        <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {campaignShots.map((shot) => (
            <li key={shot.shotName}>
              <span className="font-medium text-foreground">{shot.shotName}</span>{" "}
              · {shot.location} — {shot.purpose}
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
