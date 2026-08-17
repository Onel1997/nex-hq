/** Image Studio consumer seam for server-verified Shopify product context. */

import { z } from "zod";
import {
  productProductionContextSchema,
  productProductionSelectionSchema,
  type ProductProductionContext,
  type ProductProductionSelection,
} from "@/lib/image/product-production-context";

export type ImageProductSelection = {
  selection: Extract<ProductProductionSelection, { authority: "SHOPIFY_LIVE" }>;
  productionContext: ProductProductionContext;
};

export class ImageProductConsumerError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ImageProductConsumerError";
  }
}

const resolveResponseSchema = z
  .object({
    success: z.literal(true),
    context: productProductionContextSchema,
  })
  .strict();

async function readIntegrationResponse(response: Response): Promise<unknown> {
  const payload = (await response.json()) as unknown;
  if (response.ok) return payload;
  const safe = z
    .object({
      error: z.string().optional(),
      code: z.string().optional(),
    })
    .passthrough()
    .safeParse(payload);
  throw new ImageProductConsumerError(
    safe.success
      ? safe.data.error ?? "Shopify product context request failed."
      : "Shopify product context request failed.",
    safe.success ? safe.data.code ?? "INTEGRATION_ERROR" : "INTEGRATION_ERROR",
  );
}

export async function fetchImageProductProductionContext(
  selection: Extract<ProductProductionSelection, { authority: "SHOPIFY_LIVE" }>,
): Promise<ProductProductionContext> {
  const parsedSelection = productProductionSelectionSchema.parse(selection);
  if (parsedSelection.authority !== "SHOPIFY_LIVE") {
    throw new ImageProductConsumerError(
      "Only live Shopify selections can be resolved for production.",
      "NON_AUTHORITATIVE_SELECTION",
    );
  }
  if (!parsedSelection.variantId) {
    throw new ImageProductConsumerError(
      "Select an exact Shopify variant before resolving production context.",
      "VARIANT_REQUIRED",
    );
  }

  const response = await fetch("/api/image/product-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selection: parsedSelection }),
    cache: "no-store",
  });
  return resolveResponseSchema.parse(await readIntegrationResponse(response)).context;
}

export function toImageProductSelection(
  selection: Extract<ProductProductionSelection, { authority: "SHOPIFY_LIVE" }>,
  productionContext: ProductProductionContext,
): ImageProductSelection {
  return {
    selection: productProductionSelectionSchema.parse(selection) as Extract<
      ProductProductionSelection,
      { authority: "SHOPIFY_LIVE" }
    >,
    productionContext: productProductionContextSchema.parse(productionContext),
  };
}
