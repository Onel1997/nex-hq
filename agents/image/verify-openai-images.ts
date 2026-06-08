/**
 * Verify OpenAI Images API payload for gpt-image-1.
 * Run: npx tsx agents/image/verify-openai-images.ts
 */
import {
  buildOpenAiImageRequest,
  generateOpenAiImage,
  OPENAI_IMAGE_MODEL,
} from "./providers/openai-images-provider";

function assertPayload() {
  const payload = buildOpenAiImageRequest({
    prompt: "Test prompt for verification",
    dimensions: "1920x1080",
    assetType: "hero_banner",
  });

  const issues: string[] = [];

  if ("response_format" in payload) {
    issues.push("payload must not include response_format");
  }
  if (payload.model !== OPENAI_IMAGE_MODEL) {
    issues.push(`expected model ${OPENAI_IMAGE_MODEL}, got ${payload.model}`);
  }
  if (payload.size !== "1536x1024") {
    issues.push(`expected landscape size 1536x1024, got ${payload.size}`);
  }
  if (payload.output_format !== "png") {
    issues.push(`expected output_format png, got ${payload.output_format}`);
  }

  console.log("=== OpenAI Images Request Payload ===");
  console.log(JSON.stringify(payload, null, 2));

  if (issues.length > 0) {
    console.error("\nPayload issues:");
    for (const issue of issues) {
      console.error(`  ✗ ${issue}`);
    }
    process.exit(1);
  }

  console.log("\n✓ Payload valid for gpt-image-1 (no response_format)");
}

async function tryLiveGeneration() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("\nSkipping live API call — OPENAI_API_KEY not set");
    return;
  }

  console.log("\n=== Live OpenAI Images API Call ===");
  try {
    const result = await generateOpenAiImage({
      prompt:
        "Minimal flat color block test image, solid signal green square on white background, no text",
      dimensions: "1024x1024",
      assetType: "hero_banner",
    });

    const hasBytes = Boolean(result.imageBytes && result.imageBytes.length > 0);
    const hasUrl = Boolean(result.url);

    console.log("✓ Generation succeeded");
    console.log(`  imageBytes: ${result.imageBytes?.length ?? 0} bytes`);
    console.log(`  url: ${hasUrl ? result.url : "(none — expected for gpt-image-1)"}`);
    console.log(`  providerId: ${result.providerId}`);
    console.log(`  status: ${result.status}`);

    if (!hasBytes) {
      console.error("✗ No image bytes returned");
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("response_format")) {
      console.error("✗ API still rejects response_format — fix incomplete");
      process.exit(1);
    }
    console.error(`✗ Live generation failed: ${message}`);
    process.exit(1);
  }
}

async function main() {
  assertPayload();
  await tryLiveGeneration();
}

main();
