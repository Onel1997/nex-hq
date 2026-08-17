import type { z } from "zod";
import { deterministicReviewRequestSchema } from "@/lib/image/deterministic-runtime/types";
export type DeterministicReviewRequest = z.infer<typeof deterministicReviewRequestSchema>;
