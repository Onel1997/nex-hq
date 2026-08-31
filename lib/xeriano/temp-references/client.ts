"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  XerianoTempReferenceKind,
  XerianoTempReferenceStudio,
} from "./contracts";

export class XerianoTempReferenceUploadError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "XerianoTempReferenceUploadError";
  }
}

async function readPayload(response: Response) {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

/**
 * The file body is sent by storage-js directly to Supabase Storage. The two
 * Xeriamo API calls contain metadata/ids only and never carry binary data.
 */
export async function uploadXerianoTempReference(input: {
  studio: XerianoTempReferenceStudio;
  kind: XerianoTempReferenceKind;
  file: File;
  fetcher?: typeof fetch;
}): Promise<{ tempReferenceId: string }> {
  const fetcher = input.fetcher ?? fetch;
  const slotResponse = await fetcher("/api/xeriano/temp-references", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studio: input.studio,
      kind: input.kind,
      mimeType: input.file.type,
      byteSize: input.file.size,
      filename: input.file.name,
    }),
  });
  const slot = await readPayload(slotResponse);
  if (
    !slotResponse.ok ||
    typeof slot?.referenceId !== "string" ||
    typeof slot?.path !== "string" ||
    typeof slot?.token !== "string"
  ) {
    throw new XerianoTempReferenceUploadError(
      typeof slot?.error === "string"
        ? slot.error
        : "Upload konnte nicht vorbereitet werden.",
      typeof slot?.code === "string" ? slot.code : "TEMP_REFERENCE_SLOT_FAILED",
    );
  }

  const upload = await createClient()
    .storage.from("xeriamo-temp-references")
    .uploadToSignedUrl(slot.path, slot.token, input.file, {
      contentType: input.file.type,
      cacheControl: "0",
    });
  if (upload.error) {
    throw new XerianoTempReferenceUploadError(
      "Upload fehlgeschlagen. Bitte erneut versuchen.",
      "TEMP_REFERENCE_UPLOAD_FAILED",
    );
  }

  const completeResponse = await fetcher(
    `/api/xeriano/temp-references/${encodeURIComponent(slot.referenceId)}/complete`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  const completed = await readPayload(completeResponse);
  if (!completeResponse.ok || completed?.ready !== true) {
    throw new XerianoTempReferenceUploadError(
      typeof completed?.error === "string"
        ? completed.error
        : "Upload fehlgeschlagen. Bitte erneut versuchen.",
      typeof completed?.code === "string"
        ? completed.code
        : "TEMP_REFERENCE_COMPLETION_FAILED",
    );
  }
  return { tempReferenceId: slot.referenceId };
}

export async function deleteXerianoTempReference(
  tempReferenceId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await fetcher(
    `/api/xeriano/temp-references/${encodeURIComponent(tempReferenceId)}`,
    { method: "DELETE", credentials: "same-origin" },
  ).catch(() => undefined);
}

