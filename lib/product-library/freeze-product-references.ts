import { createHash } from "node:crypto";

import {
  productReferencePackageSchema,
  type ProductReferencePackage,
} from "@/lib/product-library/product-reference-package";
import {
  frozenProductVisualReferenceSchema,
  type FrozenProductVisualReference,
  type ProductVisualReference,
} from "@/lib/product-library/types";

const MAX_PRODUCT_REFERENCE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function detectProductReferenceMimeType(
  bytes: Buffer,
): FrozenProductVisualReference["mimeType"] {
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  throw new Error(
    "Frozen Product reference bytes are not a supported PNG, JPEG, or WebP image.",
  );
}

/**
 * Completes legacy frozen metadata only from checksum-verified private bytes.
 * Declared MIME/length mismatches fail closed instead of being normalized.
 */
export function completeFrozenProductReference(
  reference: ProductVisualReference,
  bytes: Buffer,
): FrozenProductVisualReference {
  const actualChecksum = createHash("sha256").update(bytes).digest("hex");
  if (reference.contentChecksumSha256 !== actualChecksum)
    throw new Error(
      "Frozen Product reference checksum does not match its private bytes.",
    );
  const detectedMimeType = detectProductReferenceMimeType(bytes);
  if (reference.mimeType && reference.mimeType !== detectedMimeType)
    throw new Error(
      "Frozen Product reference MIME type does not match its private bytes.",
    );
  if (reference.byteLength && reference.byteLength !== bytes.length)
    throw new Error(
      "Frozen Product reference byte length does not match its private bytes.",
    );
  return frozenProductVisualReferenceSchema.parse({
    ...reference,
    mimeType: detectedMimeType,
    byteLength: bytes.length,
  });
}

export function assertSafeShopifyCdnUrl(value: string): URL {
  const url = new URL(value);
  const allowedHost = url.hostname === "cdn.shopify.com" || url.hostname.endsWith(".shopifycdn.com");
  if (url.protocol !== "https:" || !allowedHost || url.username || url.password) {
    throw new Error("Shopify product reference URL is not an allowed HTTPS CDN URL.");
  }
  return url;
}

async function readReferenceBytes(
  url: URL,
  fetchImpl: typeof fetch,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await fetchImpl(url, { redirect: "error" });
  if (!response.ok) throw new Error(`Shopify product reference fetch failed (${response.status}).`);
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Shopify product reference has an unsupported MIME type.");
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PRODUCT_REFERENCE_BYTES) throw new Error("Shopify product reference exceeds the size limit.");
  if (!response.body) throw new Error("Shopify product reference response has no body.");
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PRODUCT_REFERENCE_BYTES) {
      await reader.cancel();
      throw new Error("Shopify product reference exceeds the size limit.");
    }
    chunks.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(chunks, total);
  if (!bytes.length) throw new Error("Shopify product reference has an invalid byte length.");
  return { bytes, mimeType };
}

/**
 * Freezes remote Shopify media before paid confirmation. The returned package
 * binds content checksums and private object identities, so execution never
 * trusts a mutable remote URL as exact production truth.
 */
export async function freezeShopifyProductReferences(input: {
  workspaceId: string;
  package: ProductReferencePackage;
  fetchImpl?: typeof fetch;
  persist: (object: { path: string; bytes: Buffer; mimeType: string }) => Promise<void>;
}): Promise<ProductReferencePackage> {
  if (input.package.authority !== "SHOPIFY_LIVE") {
    throw new Error("Shopify freezer only accepts SHOPIFY_LIVE reference packages.");
  }
  const fetchImpl = input.fetchImpl ?? ((input, init) => fetch(input, init));
  const references = [];
  for (const reference of input.package.references) {
    if (!reference.sourceUrl) throw new Error("Shopify reference is missing its server-resolved source URL.");
    const url = assertSafeShopifyCdnUrl(reference.sourceUrl);
    const { bytes, mimeType } = await readReferenceBytes(url, fetchImpl);
    const detectedMimeType = detectProductReferenceMimeType(bytes);
    if (mimeType !== detectedMimeType)
      throw new Error(
        "Shopify Product reference MIME type does not match its image bytes.",
      );
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]!;
    const path = `${input.workspaceId}/product-references/${input.package.packageId.replace(/[^a-zA-Z0-9._-]/g, "_")}/${reference.referenceId.replace(/[^a-zA-Z0-9._-]/g, "_")}-${checksum}.${extension}`;
    await input.persist({ path, bytes, mimeType });
    references.push(completeFrozenProductReference({
      ...reference,
      privateStoragePath: path,
      contentChecksumSha256: checksum,
      mimeType,
      byteLength: bytes.length,
      updatedAt: reference.updatedAt ?? input.package.capturedAt,
    }, bytes));
  }
  return productReferencePackageSchema.parse({ ...input.package, references });
}
