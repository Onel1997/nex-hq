/**
 * Generation job repository factory.
 */

import { isSupabaseConfigured } from "@/lib/supabase/admin";
import type { PersonaGenerationJobRepository } from "./generation-job-repository";
import { MemoryGenerationJobRepository } from "./memory-generation-job-repository";
import { SupabaseGenerationJobRepository } from "./supabase-generation-job-repository";

let override: PersonaGenerationJobRepository | null = null;

export function setGenerationJobRepositoryForTests(
  repo: PersonaGenerationJobRepository | null,
) {
  override = repo;
}

export function getGenerationJobRepository(): PersonaGenerationJobRepository {
  if (override) return override;
  if (isSupabaseConfigured()) return new SupabaseGenerationJobRepository();
  return new MemoryGenerationJobRepository();
}

export function getGenerationJobRepositoryKind(): "supabase" | "memory" | "unconfigured" {
  if (override) return override.kind;
  if (isSupabaseConfigured()) return "supabase";
  return "memory";
}
