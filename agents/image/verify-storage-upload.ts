/**
 * Verify Supabase image-assets bucket and upload.
 * Run: npx tsx agents/image/verify-storage-upload.ts
 */
import { IMAGE_ASSETS_BUCKET, uploadImageAsset } from "./storage";

async function main() {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  console.log(`Bucket: ${IMAGE_ASSETS_BUCKET}`);

  const result = await uploadImageAsset({
    workspaceId: "test-workspace",
    reportId: "00000000-0000-0000-0000-000000000001",
    assetKey: "test:openai",
    imageBytes: png,
  });

  console.log("Upload result:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
