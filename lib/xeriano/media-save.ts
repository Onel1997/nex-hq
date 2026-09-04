export type MediaSaveInput = {
  url: string;
  fileName: string;
  mimeType: string;
};

type ShareNavigator = Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

type FileConstructor = new (
  fileBits: BlobPart[],
  fileName: string,
  options?: FilePropertyBag,
) => File;

type DownloadDocument = Pick<Document, "body" | "createElement">;

export type MediaSaveDependencies = {
  navigator?: ShareNavigator | null;
  document?: DownloadDocument | null;
  fetcher?: typeof fetch;
  File?: FileConstructor | null;
  URL?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> | null;
};

export type MediaSaveResult = "SHARED" | "DOWNLOADED" | "CANCELLED";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function runtimeNavigator(): ShareNavigator | null {
  return typeof navigator === "undefined" ? null : navigator;
}

function runtimeDocument(): DownloadDocument | null {
  return typeof document === "undefined" ? null : document;
}

function runtimeFile(): FileConstructor | null {
  return typeof File === "undefined" ? null : File;
}

function runtimeUrl(): Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> | null {
  return typeof URL === "undefined" ? null : URL;
}

export function isAppleMobileDevice(navigatorAuthority: ShareNavigator | null): boolean {
  if (!navigatorAuthority) return false;
  const userAgent = navigatorAuthority.userAgent ?? "";
  const platform = navigatorAuthority.platform ?? "";
  return /iPhone|iPad|iPod/i.test(userAgent)
    || ((platform === "MacIntel" || /Macintosh/i.test(userAgent))
      && (navigatorAuthority.maxTouchPoints ?? 0) > 1);
}

export function canUseNativeMediaShare(
  navigatorAuthority: ShareNavigator | null = runtimeNavigator(),
  FileAuthority: FileConstructor | null = runtimeFile(),
): boolean {
  if (
    !isAppleMobileDevice(navigatorAuthority)
    || !navigatorAuthority?.share
    || !navigatorAuthority.canShare
    || !FileAuthority
  ) {
    return false;
  }
  try {
    const probe = new FileAuthority([""], "xeriamo-media-share.txt", { type: "text/plain" });
    return navigatorAuthority.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function mediaFileName(fileName: string, mimeType: string): string {
  const safeName = fileName
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120) || "xeriamo-medium";
  const extension = EXTENSION_BY_MIME[mimeType.toLowerCase()];
  if (!extension) return safeName;
  return `${safeName.replace(/\.[a-z0-9]{2,5}$/i, "")}.${extension}`;
}

function triggerDownload(
  url: string,
  fileName: string,
  documentAuthority: DownloadDocument | null,
): void {
  if (!documentAuthority?.body) return;
  const anchor = documentAuthority.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  documentAuthority.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function wasShareCancelled(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" && error !== null && "name" in error
      && (error as { name?: unknown }).name === "AbortError";
}

/**
 * Opens the native Apple share sheet for an authenticated media Blob when
 * supported. Every unsupported or technical share path falls back to the
 * existing browser download; user cancellation stays intentionally silent.
 */
export async function saveMediaFile(
  input: MediaSaveInput,
  dependencies: MediaSaveDependencies = {},
): Promise<MediaSaveResult> {
  const navigatorAuthority = dependencies.navigator === undefined
    ? runtimeNavigator()
    : dependencies.navigator;
  const documentAuthority = dependencies.document === undefined
    ? runtimeDocument()
    : dependencies.document;
  const FileAuthority = dependencies.File === undefined ? runtimeFile() : dependencies.File;
  const urlAuthority = dependencies.URL === undefined ? runtimeUrl() : dependencies.URL;
  const fileName = mediaFileName(input.fileName, input.mimeType);
  const fetcher = dependencies.fetcher ?? globalThis.fetch;

  let blob: Blob;
  try {
    const response = await fetcher(input.url, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`media_fetch_${response.status}`);
    blob = await response.blob();
  } catch {
    triggerDownload(input.url, fileName, documentAuthority);
    return "DOWNLOADED";
  }

  const mimeType = input.mimeType || blob.type || "application/octet-stream";
  if (canUseNativeMediaShare(navigatorAuthority, FileAuthority) && FileAuthority) {
    const file = new FileAuthority([blob], fileName, { type: mimeType });
    try {
      await navigatorAuthority!.share!({ files: [file] });
      return "SHARED";
    } catch (error) {
      if (wasShareCancelled(error)) return "CANCELLED";
    }
  }

  if (urlAuthority) {
    const objectUrl = urlAuthority.createObjectURL(blob);
    try {
      triggerDownload(objectUrl, fileName, documentAuthority);
    } finally {
      globalThis.setTimeout(() => urlAuthority.revokeObjectURL(objectUrl), 0);
    }
  } else {
    triggerDownload(input.url, fileName, documentAuthority);
  }
  return "DOWNLOADED";
}
