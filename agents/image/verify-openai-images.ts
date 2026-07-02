/**
 * Verify OpenAI Images API payload for gpt-image-1.
 * Run: npx tsx agents/image/verify-openai-images.ts
 */
import {
  buildOpenAiGenerationPayload,
  getOpenAiImageModel,
  IMAGE_GENERATION,
} from "@/lib/image/image-generation-config";
import { generateOpenAiImage } from "./providers/openai-images-provider";

function assertPayload() {
  const payload = buildOpenAiGenerationPayload(
    "Test prompt for verification",
    "1920x1080",
  );

  const issues: string[] = [];

  if ("response_format" in payload) {
    issues.push("payload must not include response_format");
  }
  if (payload.model !== getOpenAiImageModel()) {
    issues.push(`expected model ${getOpenAiImageModel()}, got ${payload.model}`);
  }
  if (payload.generationMode !== IMAGE_GENERATION.mode) {
    issues.push(`expected mode ${IMAGE_GENERATION.mode}, got ${payload.generationMode}`);
  }
  if (IMAGE_GENERATION.mode === "production" && payload.size !== "1536x1024") {
    issues.push(`expected landscape size 1536x1024 in production, got ${payload.size}`);
  }
  if (IMAGE_GENERATION.mode === "draft" && payload.size !== "1024x1024") {
    issues.push(`expected draft size 1024x1024, got ${payload.size}`);
  }
  if (payload.output_format !== IMAGE_GENERATION[IMAGE_GENERATION.mode].outputFormat) {
    issues.push(`expected output_format ${IMAGE_GENERATION[IMAGE_GENERATION.mode].outputFormat}, got ${payload.output_format}`);
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
