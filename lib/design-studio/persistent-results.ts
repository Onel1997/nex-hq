import type { DesignResult, DesignRun } from "@/lib/design-studio/contracts";

export function isSuccessfulDesignRun(run: DesignRun): boolean {
  return (run.status === "SUCCEEDED" || run.status === "PARTIALLY_SUCCEEDED")
    && run.results.length > 0;
}

export function latestCompletedDesignRun(runs: DesignRun[]): DesignRun | null {
  return runs.find(isSuccessfulDesignRun) ?? null;
}

export function mergeDurableDesignResults(
  immediateDerived: DesignResult[],
  persistent: DesignResult[],
): DesignResult[] {
  const seen = new Set<string>();
  return [...immediateDerived, ...persistent].filter((result) => {
    const key = result.libraryAssetId ?? result.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
