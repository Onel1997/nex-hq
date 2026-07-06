"use client";

import { prepareMasterArtworkPreviewSvg } from "@/lib/design/master-artwork-preview-svg";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface MasterArtworkPreviewMediaProps {
  imageUrl?: string;
  svgMarkup?: string;
  svgUrl?: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  svgClassName?: string;
}

export function MasterArtworkPreviewMedia({
  imageUrl,
  svgMarkup,
  svgUrl,
  alt = "Master artwork",
  className,
  imgClassName = "ma-artwork-img",
  svgClassName = "ma-artwork-svg",
}: MasterArtworkPreviewMediaProps) {
  const previewSvg = useMemo(
    () => (svgMarkup?.trim() ? prepareMasterArtworkPreviewSvg(svgMarkup) : undefined),
    [svgMarkup],
  );

  const resolvedImageUrl = imageUrl?.trim() || svgUrl?.trim();

  if (!previewSvg && !resolvedImageUrl) {
    return null;
  }

  return (
    <div className={cn("ma-artwork-preview", className)}>
      <div className="ma-artwork-frame">
        {previewSvg ? (
          <div
            className={svgClassName}
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={resolvedImageUrl} alt={alt} className={imgClassName} decoding="async" />
        )}
      </div>
    </div>
  );
}
