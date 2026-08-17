"use client";

import type { LocalArtworkUpload } from "@/components/design/v2/types";
import {
  DesignToImageHandoffError,
  resolveDurableHandoffMimeType,
} from "@/lib/design/design-to-image-handoff";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load artwork for handoff rasterization."));
    image.src = url;
  });
}

async function rasterizeSvgUploadToPng(objectUrl: string): Promise<Uint8Array> {
  const image = await loadImage(objectUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || 2048);
  canvas.height = Math.max(1, image.naturalHeight || 2048);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new DesignToImageHandoffError("Could not prepare artwork rasterization.");
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Failed to rasterize SVG artwork for durable handoff.")),
      "image/png",
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function readArtworkBytesForHandoff(
  upload: LocalArtworkUpload,
): Promise<{
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}> {
  const mimeType = resolveDurableHandoffMimeType(upload.fileKind, upload.mimeType);
  if (!mimeType) {
    throw new DesignToImageHandoffError(
      "Durable handoff requires PNG, JPEG, WebP, or SVG artwork. PDF, AI, and EPS must be exported to PNG first.",
    );
  }

  if (upload.fileKind === "svg") {
    return {
      bytes: await rasterizeSvgUploadToPng(upload.objectUrl),
      mimeType: "image/png",
    };
  }

  return {
    bytes: new Uint8Array(await upload.file.arrayBuffer()),
    mimeType,
  };
}
