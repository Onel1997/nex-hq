export type VideoRunSummary = {
  id: string;
  status: string;
  assetReviewStatus?: "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | null;
};

export function isCurrentVideoRun(run: VideoRunSummary): boolean {
  if (["awaiting_confirmation", "confirmed", "running", "unknown_outcome"].includes(run.status)) return true;
  return run.status === "succeeded" && !["APPROVED", "REJECTED"].includes(run.assetReviewStatus ?? "");
}

export function splitVideoRuns<T extends VideoRunSummary>(runs: T[]): {
  current: T | null;
  history: T[];
} {
  const current = runs.find(isCurrentVideoRun) ?? null;
  return {
    current,
    history: runs.filter((run) => run.id !== current?.id),
  };
}
