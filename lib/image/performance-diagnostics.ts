export type ImageStudioTiming = {
  phase: string;
  durationMs: number;
};

export async function timeImageStudioPhase<T>(
  phase: string,
  run: () => Promise<T>,
  timings: ImageStudioTiming[],
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    timings.push({
      phase,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    });
  }
}

export function logImageStudioTimings(
  requestName: string,
  timings: ImageStudioTiming[],
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[Image Studio performance] server phases", {
    request: requestName,
    totalMs: Math.round(
      timings.reduce((total, timing) => total + timing.durationMs, 0) * 10,
    ) / 10,
    phases: timings,
  });
}
