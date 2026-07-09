"use client";

import { ACCEPTED_ARTWORK_EXTENSIONS } from "@/components/design/v2/types";
import { cn } from "@/lib/utils";
import { AlertCircle, Upload } from "lucide-react";
import { useCallback, useState } from "react";

interface ArtworkUploadZoneProps {
  onFileSelect: (files: FileList | null) => void;
  onOpenPicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  error?: string | null;
  className?: string;
}

export function ArtworkUploadZone({
  onFileSelect,
  onOpenPicker,
  fileInputRef,
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
        aria-label="Upload master artwork"
      >
        <div className="dsv2-upload-icon-wrap">
          <Upload className="size-8" strokeWidth={1.25} />
        </div>

        <h2 className="dsv2-upload-title">Upload Master Artwork</h2>
        <p className="dsv2-upload-caption">
          Drop your production-ready artwork here, or browse from your computer.
        </p>

        <button type="button" className="dsv2-upload-btn" onClick={onOpenPicker}>
          <Upload className="size-4" />
          Choose File
        </button>

        <p className="dsv2-upload-formats">
          Supported: {ACCEPTED_ARTWORK_EXTENSIONS.join(" · ")}
        </p>

        {error ? (
          <div className="dsv2-upload-error" role="alert">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept=".svg,.png,.pdf,.ai,.eps,image/svg+xml,image/png,application/pdf"
          onChange={(e) => {
            onFileSelect(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
