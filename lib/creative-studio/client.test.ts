import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  type CreativeGenerationSetup,
  type CreativeReferenceImage,
} from "@/lib/creative-studio/contracts";
import {
  CreativeGenerationClientError,
  submitCreativeGeneration,
} from "@/lib/creative-studio/client";

function setup(reference: CreativeReferenceImage): CreativeGenerationSetup {
  return {
    contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
    prompt: "Test",
    modelId: "nano-banana-pro",
    aspectRatio: "4:5",
    quality: "2K",
    batchSize: 1,
    outputType: "CAMPAIGN",
    references: [{
      id: reference.id,
      name: reference.name,
      mimeType: reference.mimeType,
      byteLength: reference.byteLength,
      role: reference.role,
      order: reference.order,
    }],
    advanced: DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  };
}

function reference(size: number): CreativeReferenceImage {
  const file = new File([new Uint8Array(size)], "large.png", {
    type: "image/png",
  });
  return {
    id: "ref-large",
    name: file.name,
    mimeType: file.type,
    byteLength: file.size,
    role: "DESIGN",
    order: 0,
    previewUrl: "blob:test",
    source: { kind: "LOCAL_FILE_REFERENCE" },
    file,
    tempReferenceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    uploadState: "READY",
  };
}

test("large reference bytes stay out of the lightweight generation request", async () => {
  const selected = reference(8_000_000);
  let fetchCalls = 0;
  let requestBody = "";
  await submitCreativeGeneration({
    jobId: "11111111-1111-4111-8111-111111111111",
    setup: setup(selected),
    references: [selected],
    fetcher: async (_url, init) => {
      fetchCalls += 1;
      requestBody = String(init?.body ?? "");
      return Response.json({
        run: {
          id: "11111111-1111-4111-8111-111111111111",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "RUNNING",
          setup: setup(selected),
          results: [],
          message: "Das Bild wird erstellt.",
        },
      });
    },
  });
  assert.equal(fetchCalls, 1);
  assert.ok(requestBody.length < 20_000);
  assert.match(requestBody, /tempReferenceId/);
  assert.doesNotMatch(requestBody, /8000000.{10000}/);
});

test("non-JSON Vercel 413 is normalized as a definite pre-provider failure", async () => {
  const selected = reference(128);
  await assert.rejects(
    submitCreativeGeneration({
      jobId: "22222222-2222-4222-8222-222222222222",
      setup: setup(selected),
      references: [selected],
      fetcher: async () =>
        new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 }),
    }),
    (error: unknown) => {
      assert.equal(error instanceof CreativeGenerationClientError, true);
      assert.equal(
        (error as CreativeGenerationClientError).code,
        "REQUEST_PAYLOAD_TOO_LARGE",
      );
      return true;
    },
  );
});
