export const LARGE_RESEARCH_RESPONSE_THRESHOLD = 18_000;

export function logResearchResponseSize(raw: string): void {
  console.log("RAW LENGTH", raw.length);
  if (raw.length > LARGE_RESEARCH_RESPONSE_THRESHOLD) {
    console.warn("Large research response");
  }
}

export function assertCompleteJsonResponse(raw: string): void {
  logResearchResponseSize(raw);
  if (!raw.trim().endsWith("}")) {
    throw new Error("Incomplete JSON response");
  }
}

export function isRetriableResearchParseError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.message === "Incomplete JSON response") return true;
    if (error.name === "ResearchParseError" || error.constructor.name === "ResearchParseError") {
      return true;
    }
  }
  return false;
}
