import { designRunSchema, type DesignGenerationSetup, type DesignRun } from "@/lib/design-studio/contracts";
import type { DesignUtilityOperation } from "@/lib/design-studio/utility-config";

export type DesignQuotePresentation = {
  credits: number | null;
  ownerUnlimited: boolean;
  ownerCostLabel: string | null;
};

export class DesignUtilityClientError extends Error {
  constructor(message: string, readonly code: string | null, readonly status: number) { super(message); }
}

export type DesignUtilityClientResult = {
  assetId: string;
  creationId: string;
  width: number;
  height: number;
};

export async function fetchDesignQuote(setup: DesignGenerationSetup, fetcher: typeof fetch = fetch) {
  const response = await fetcher("/api/design-studio/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(setup), credentials: "same-origin" });
  const body = await response.json().catch(() => null) as { credits?: unknown; ownerUnlimited?: unknown; ownerCostLabel?: unknown } | null;
  if (!response.ok) throw new Error("QUOTE_UNAVAILABLE");
  return {
    credits: typeof body?.credits === "number" ? body.credits : null,
    ownerUnlimited: body?.ownerUnlimited === true,
    ownerCostLabel: typeof body?.ownerCostLabel === "string" ? body.ownerCostLabel : null,
  };
}

export async function fetchDesignUtilityQuote(operation: DesignUtilityOperation, fetcher: typeof fetch = fetch): Promise<DesignQuotePresentation> {
  const response = await fetcher("/api/design-studio/utility/quote", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation }), credentials: "same-origin",
  });
  const body = await response.json().catch(() => null) as { credits?: unknown; ownerUnlimited?: unknown; ownerCostLabel?: unknown } | null;
  if (!response.ok) throw new Error("QUOTE_UNAVAILABLE");
  return {
    credits: typeof body?.credits === "number" ? body.credits : null,
    ownerUnlimited: body?.ownerUnlimited === true,
    ownerCostLabel: typeof body?.ownerCostLabel === "string" ? body.ownerCostLabel : null,
  };
}

export async function submitDesignUtility(input: {
  jobId: string;
  sourceAssetId: string;
  operation: DesignUtilityOperation;
  fetcher?: typeof fetch;
}) {
  const response = await (input.fetcher ?? fetch)("/api/design-studio/utility", {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
    body: JSON.stringify({ jobId: input.jobId, sourceAssetId: input.sourceAssetId, operation: input.operation }),
  });
  const body = await response.json().catch(() => null) as { success?: unknown; error?: unknown; code?: unknown; status?: unknown; result?: unknown } | null;
  if (!response.ok || body?.success !== true) throw new DesignUtilityClientError(
    typeof body?.error === "string" ? body.error : "Die Aktion konnte nicht abgeschlossen werden.",
    typeof body?.code === "string" ? body.code : null,
    response.status,
  );
  const result = body.result as Partial<DesignUtilityClientResult> | null;
  if (!result || typeof result.assetId !== "string" || typeof result.creationId !== "string"
    || typeof result.width !== "number" || typeof result.height !== "number") {
    throw new DesignUtilityClientError("Die Aktion wird noch verarbeitet.", "UTILITY_RESULT_PENDING", 202);
  }
  return { status: "SUCCEEDED" as const, result: result as DesignUtilityClientResult };
}

export async function submitSvgToPng(input: {
  jobId: string;
  sourceAssetId: string;
  fetcher?: typeof fetch;
}) {
  const response = await (input.fetcher ?? fetch)("/api/design-studio/svg-to-png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ jobId: input.jobId, sourceAssetId: input.sourceAssetId }),
  });
  const body = await response.json().catch(() => null) as {
    success?: unknown;
    error?: unknown;
    code?: unknown;
    result?: unknown;
  } | null;
  if (!response.ok || body?.success !== true) {
    throw new DesignUtilityClientError(
      typeof body?.error === "string" ? body.error : "PNG-Version konnte nicht erstellt werden.",
      typeof body?.code === "string" ? body.code : null,
      response.status,
    );
  }
  const result = body.result as Partial<DesignUtilityClientResult> | null;
  if (!result || typeof result.assetId !== "string" || typeof result.creationId !== "string"
    || typeof result.width !== "number" || typeof result.height !== "number") {
    throw new DesignUtilityClientError("PNG-Version konnte nicht erstellt werden.", "SVG_TO_PNG_RESULT_INVALID", 503);
  }
  return { status: "SUCCEEDED" as const, result: result as DesignUtilityClientResult };
}

export async function submitDesignGeneration(input: { jobId: string; setup: DesignGenerationSetup; reference: File | null; fetcher?: typeof fetch }): Promise<{ run: DesignRun; credit?: unknown }> {
  const form = new FormData(); form.set("jobId", input.jobId); form.set("setup", JSON.stringify(input.setup));
  if (input.reference) form.set("reference", input.reference, input.reference.name);
  const response = await (input.fetcher ?? fetch)("/api/design-studio/generate", { method: "POST", body: form, credentials: "same-origin" });
  const body = await response.json().catch(() => null) as { run?: unknown; error?: unknown; credit?: unknown } | null;
  if (!response.ok || !body?.run) throw new Error(typeof body?.error === "string" ? body.error : "Design konnte nicht erstellt werden. Bitte versuche es erneut.");
  return { run: designRunSchema.parse(body.run), ...(body.credit ? { credit: body.credit } : {}) };
}

export async function fetchDesignJob(jobId: string, fetcher: typeof fetch = fetch): Promise<DesignRun> {
  const response = await fetcher(`/api/design-studio/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null) as { run?: unknown; error?: unknown } | null;
  if (!response.ok || !body?.run) throw new Error(typeof body?.error === "string" ? body.error : "Auftrag konnte nicht geladen werden.");
  return designRunSchema.parse(body.run);
}

export async function fetchDesignHistory(fetcher: typeof fetch = fetch): Promise<DesignRun[]> {
  const response = await fetcher("/api/design-studio/history?limit=40", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null) as { runs?: unknown; error?: unknown } | null;
  if (!response.ok || !Array.isArray(body?.runs)) throw new Error(typeof body?.error === "string" ? body.error : "Verlauf ist gerade nicht verfügbar.");
  return body.runs.map((run) => designRunSchema.parse(run));
}
