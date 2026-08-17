"use client";

import { ARTWORK_FILE_INPUT_ACCEPT } from "@/lib/design/artwork-file-picker";

interface ArtworkFileInputProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (files: FileList | null) => void;
}

export function ArtworkFileInput({
  fileInputRef,
  onFileSelect,
}: ArtworkFileInputProps) {
  return (
    <input
      ref={fileInputRef}
      type="file"
      className="sr-only"
      accept={ARTWORK_FILE_INPUT_ACCEPT}
      onChange={(event) => {
        onFileSelect(event.target.files);
        event.target.value = "";
      }}
      aria-hidden
      tabIndex={-1}
    />
  );
}
