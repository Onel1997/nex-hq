"use client";

import {
  MOCKUP_GARMENT_OPTIONS,
  type MockupGarmentId,
} from "@/lib/design/master-artwork-canvas-background";
import { cn } from "@/lib/utils";

interface MasterArtworkMockupFrameProps {
  garment: MockupGarmentId;
  imageUrl?: string;
  svgMarkup?: string;
  svgUrl?: string;
}

export function MasterArtworkMockupFrame({
  garment,
  imageUrl,
  svgMarkup,
  svgUrl,
}: MasterArtworkMockupFrameProps) {
  const option = MOCKUP_GARMENT_OPTIONS.find((entry) => entry.id === garment);
  const garmentColor = option?.garmentColor ?? "#141414";
  const kind = option?.kind ?? "tee";

  return (
    <div
      className={cn("ma-mockup-frame", `is-${kind}`, `is-garment-${garment}`)}
      style={{ "--ma-mockup-garment": garmentColor } as React.CSSProperties}
    >
      <div className="ma-mockup-garment" aria-hidden>
        {kind === "hoodie" ? (
          <svg className="ma-mockup-silhouette" viewBox="0 0 400 480" aria-hidden>
            <path
              d="M120 88c0-22 18-40 40-40h80c22 0 40 18 40 40v12l52 28 28 52-36 24-20-36v224H96V168l-20 36-36-24 28-52 52-28V88z"
              fill="currentColor"
            />
            <ellipse cx="200" cy="72" rx="34" ry="18" fill="currentColor" opacity="0.85" />
          </svg>
        ) : (
          <svg className="ma-mockup-silhouette" viewBox="0 0 400 440" aria-hidden>
            <path
              d="M128 72c0-18 14-32 32-32h80c18 0 32 14 32 32v8l56 32 24 44-32 20-16-28v244H96V148l-16 28-32-20 24-44 56-32V72z"
              fill="currentColor"
            />
          </svg>
        )}
      </div>

      <div className="ma-mockup-artwork">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="Artwork on mockup" className="ma-mockup-artwork-img" />
        ) : svgMarkup ? (
          <div
            className="ma-mockup-artwork-svg"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : svgUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={svgUrl} alt="Artwork on mockup" className="ma-mockup-artwork-img" />
        ) : null}
      </div>
    </div>
  );
}
