import { createHash } from "node:crypto";

import {
  productReferencePackageSchema,
  type ProductReferencePackage,
} from "@/lib/product-library/product-reference-package";

const MAX_PRODUCT_REFERENCE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]!;
    const path = `${input.workspaceId}/product-references/${input.package.packageId.replace(/[^a-zA-Z0-9._-]/g, "_")}/${reference.referenceId.replace(/[^a-zA-Z0-9._-]/g, "_")}-${checksum}.${extension}`;
    await input.persist({ path, bytes, mimeType });
    references.push({
      ...reference,
      privateStoragePath: path,
      contentChecksumSha256: checksum,
    });
  }
  return productReferencePackageSchema.parse({ ...input.package, references });
}
