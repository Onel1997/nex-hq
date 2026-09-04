"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { canUseNativeMediaShare, mediaFileName, saveMediaFile } from "@/lib/xeriano/media-save";

export function XerianoMediaSaveLink({
  href,
  fileName,
  mimeType,
  downloadLabel = "Herunterladen",
  iconSize = 16,
  className,
}: {
  href: string;
  fileName: string;
  mimeType: string;
  downloadLabel?: string;
  iconSize?: number;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [nativeShare, setNativeShare] = useState(false);
  const busyRef = useRef(false);
  const resolvedFileName = mediaFileName(fileName, mimeType);

  useEffect(() => {
    setNativeShare(canUseNativeMediaShare());
  }, []);

  async function save(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await saveMediaFile({ url: href, fileName, mimeType });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <a
      className={className}
      href={href}
      download={resolvedFileName}
      aria-busy={busy}
      aria-disabled={busy}
      onClick={(event) => void save(event)}
    >
      {busy ? (
        <><Loader2 className="spin" size={iconSize} /> Wird vorbereitet …</>
      ) : nativeShare ? (
        <><Share2 size={iconSize} /> In Mediathek sichern</>
      ) : (
        <><Download size={iconSize} /> {downloadLabel}</>
      )}
    </a>
  );
}
