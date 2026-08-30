"use client";

import { ACCEPTED_ARTWORK_EXTENSIONS } from "@/components/design/v2/types";
import { cn } from "@/lib/utils";
import { AlertCircle, Upload } from "lucide-react";
import { useCallback, useState } from "react";

interface ArtworkUploadZoneProps {
  onFileSelect: (files: FileList | null) => void;
  onOpenPicker: () => void;
  error?: string | null;
  className?: string;
}

export function ArtworkUploadZone({
  onFileSelect,
  onOpenPicker,
  error,
  className,
}: ArtworkUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      onFileSelect(event.dataTransfer.files);
    },
    [onFileSelect],
  );

  return (
    <div className={cn("dsv2-upload-zone", className)}>
      <div
        className={cn("dsv2-upload-drop", dragOver && "is-drag-over")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        role="region"
        aria-label="Master Artwork hochladen"
      >
        <div className="dsv2-upload-icon-wrap">
          <Upload className="size-8" strokeWidth={1.25} />
        </div>

        <h2 className="dsv2-upload-title">Artwork hochladen</h2>
        <p className="dsv2-upload-caption">
          Ziehe dein produktionsfertiges Artwork hierher oder wähle eine Datei aus.
        </p>

        <button type="button" className="dsv2-upload-btn" onClick={onOpenPicker}>
          <Upload className="size-4" />
          Datei auswählen
        </button>

        <p className="dsv2-upload-formats">
          Unterstützt: {ACCEPTED_ARTWORK_EXTENSIONS.join(" · ")}
        </p>

        {error ? (
          <div className="dsv2-upload-error" role="alert">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
