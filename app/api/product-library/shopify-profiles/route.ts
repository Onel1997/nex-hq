import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { syncShopifyProductProfile, toOwnerProductProfileView } from "@/lib/product-library/service";

/** Read Shopify canonical data, then persist only NexHQ Product knowledge. Shopify is never mutated. */
export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const profile = await syncShopifyProductProfile(gated.scope, await request.json());
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
