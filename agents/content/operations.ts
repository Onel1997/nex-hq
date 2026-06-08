import type { ContentOutput } from "./types";

/** Simulated publish result for channel integrations. */
export interface ContentPublishResult {
  simulated: true;
  channel: "shopify" | "klaviyo" | "instagram";
  publishId: string;
  status: "draft";
  message: string;
}

/**
 * Simulates publishing content to Shopify (product/collection copy).
 * Replace with real Shopify Admin API when integration is enabled.
 */
export async function publishToShopify(
  workspaceId: string,
  output: Pick<ContentOutput, "productCopy" | "landingPageCopy">,
): Promise<ContentPublishResult> {
  const publishId = `sim-shopify-${crypto.randomUUID().slice(0, 8)}`;

  console.info("[Content Operations] publishToShopify (simulated)", {
    workspaceId,
    publishId,
    productCount: output.productCopy.length,
  });

  return {
    simulated: true,
    channel: "shopify",
    publishId,
    status: "draft",
    message: `${output.productCopy.length} Produkt-Copy-Blöcke simuliert an Shopify übermittelt.`,
  };
}

/**
 * Simulates publishing email/SMS sequences to Klaviyo.
 * Replace with real Klaviyo API when integration is enabled.
 */
export async function publishToKlaviyo(
  workspaceId: string,
  output: Pick<ContentOutput, "emailSequence" | "smsCampaign">,
): Promise<ContentPublishResult> {
  const publishId = `sim-klaviyo-${crypto.randomUUID().slice(0, 8)}`;

  console.info("[Content Operations] publishToKlaviyo (simulated)", {
    workspaceId,
    publishId,
  });

  return {
    simulated: true,
    channel: "klaviyo",
    publishId,
    status: "draft",
    message:
      "E-Mail-Sequenz und SMS-Kampagne simuliert als Klaviyo-Drafts angelegt.",
  };
}

/**
 * Simulates publishing social content to Instagram.
 * Replace with real Meta/Instagram API when integration is enabled.
 */
export async function publishToInstagram(
  workspaceId: string,
  output: Pick<ContentOutput, "socialContent">,
): Promise<ContentPublishResult> {
  const publishId = `sim-instagram-${crypto.randomUUID().slice(0, 8)}`;

  console.info("[Content Operations] publishToInstagram (simulated)", {
    workspaceId,
    publishId,
    captionCount: output.socialContent.instagramCaptions.length,
  });

  return {
    simulated: true,
    channel: "instagram",
    publishId,
    status: "draft",
    message: `${output.socialContent.instagramCaptions.length} Instagram-Captions simuliert als Drafts gespeichert.`,
  };
}
