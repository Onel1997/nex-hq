import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  approveMasterArtworkMetaSchema,
  approveMasterArtworkRequestSchema,
  DESIGN_MASTER_ARTWORK_SOURCE_TYPES,
  type ApproveMasterArtworkRequest,
} from "./types";
import { decodeMasterArtworkUpload, DESIGN_MASTER_ARTWORK_MAX_BYTES } from "./storage";
import {
  normalizeOriginalFileName,
  normalizeOwnerArtworkDisplayName,
} from "@/lib/design/artwork-display-name";

export type ParsedApproveMasterArtworkBody =
  | { ok: true; meta: ApproveMasterArtworkRequest; bytes: Buffer }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      details?: unknown;
      stage: "request_parse" | "request_validation" | "artwork_decode";
    };

const SOURCE_TYPES = new Set<string>(DESIGN_MASTER_ARTWORK_SOURCE_TYPES);
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "1";
}

function parseNullableText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function buildMetaFromFields(input: Record<string, unknown>) {
  return approveMasterArtworkMetaSchema.safeParse(input);
}

function buildJsonRequest(input: Record<string, unknown>) {
  return approveMasterArtworkRequestSchema.safeParse(input);
}

export async function parseApproveMasterArtworkBody(
  request: Request,
): Promise<ParsedApproveMasterArtworkBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch (error) {
      return {
        ok: false,
        status: 413,
        error:
          error instanceof Error
            ? error.message
            : "Master Artwork upload body could not be read.",
        code: "REQUEST_TOO_LARGE",
        stage: "request_parse",
      };
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return {
        ok: false,
        status: 400,
        error: "Master Artwork upload requires a binary file field.",
        code: "VALIDATION",
        stage: "request_validation",
      };
    }

    const sourceType = String(form.get("sourceType") ?? "uploaded");
    const mimeType = String(form.get("mimeType") ?? file.type ?? "image/png");
    if (!SOURCE_TYPES.has(sourceType)) {
      return {
        ok: false,
        status: 400,
        error: "Invalid Master Artwork source type.",
        code: "VALIDATION",
        stage: "request_validation",
      };
    }
    if (!MIME_TYPES.has(mimeType)) {
      return {
        ok: false,
        status: 400,
        error: "Master Artwork mime type must be PNG, JPEG, or WebP.",
        code: "VALIDATION",
        stage: "request_validation",
      };
    }

    const parsedDisplayName = parseNullableText(form.get("displayName"));
    const displayName = parsedDisplayName
      ? normalizeOwnerArtworkDisplayName(parsedDisplayName)
      : null;
    if (displayName && !displayName.ok) {
      return {
        ok: false,
        status: 400,
        error: displayName.error,
        code: "VALIDATION",
        stage: "request_validation",
      };
    }

    const parsedMeta = buildMetaFromFields({
      designId: form.get("designId"),
      version: form.get("version"),
      sourceType,
      sourceReportId: parseNullableText(form.get("sourceReportId")),
      sourceHandoffAt: form.get("sourceHandoffAt"),
      placement: parseNullableText(form.get("placement")),
      printMethod: parseNullableText(form.get("printMethod")),
      mimeType,
      approvalAttestation: parseBooleanField(form.get("approvalAttestation"))
        ? true
        : false,
      provenance: form.get("provenance"),
      displayName: displayName?.ok ? displayName.value : null,
      originalFileName:
        normalizeOriginalFileName(parseNullableText(form.get("originalFileName"))) ??
        normalizeOriginalFileName(file.name),
    });

    if (!parsedMeta.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid durable Master Artwork approval request.",
        code: "VALIDATION",
        details: parsedMeta.error.flatten(),
        stage: "request_validation",
      };
    }

    if (!parseBooleanField(form.get("approvalAttestation"))) {
      return {
        ok: false,
        status: 400,
        error: "Explicit Master Artwork approval attestation is required.",
        code: "VALIDATION",
        stage: "request_validation",
      };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      if (!bytes.length) {
        throw new PersonaDomainError("Master Artwork is empty.", "WORKFLOW");
      }
      if (bytes.length > DESIGN_MASTER_ARTWORK_MAX_BYTES) {
        throw new PersonaDomainError(
          "Master Artwork exceeds the 20 MB limit.",
          "WORKFLOW",
        );
      }
    } catch (error) {
      if (error instanceof PersonaDomainError) {
        return {
          ok: false,
          status: 409,
          error: error.message,
          code: error.code,
          stage: "artwork_decode",
        };
      }
      throw error;
    }

    return { ok: true, meta: { ...parsedMeta.data, contentBase64: "" }, bytes };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return {
      ok: false,
      status: 413,
      error:
        error instanceof Error
          ? error.message
          : "Master Artwork approval JSON body could not be parsed.",
      code: "REQUEST_TOO_LARGE",
      stage: "request_parse",
    };
  }

  const parsed = buildJsonRequest(body as Record<string, unknown>);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Invalid durable Master Artwork approval request.",
      code: "VALIDATION",
      details: parsed.error.flatten(),
      stage: "request_validation",
    };
  }

  try {
    const bytes = decodeMasterArtworkUpload(parsed.data.contentBase64);
    return { ok: true, meta: parsed.data, bytes };
  } catch (error) {
    if (error instanceof PersonaDomainError) {
      return {
        ok: false,
        status: error.code === "WORKFLOW" ? 409 : 400,
        error: error.message,
        code: error.code,
        stage: "artwork_decode",
      };
    }
    throw error;
  }
}
