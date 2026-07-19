import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import type { PersonaCreationRepository } from "./creation-repository";
import { SupabaseCreationRepository } from "./supabase-creation-repository";

let testOverride: PersonaCreationRepository | null = null;

export function setCreationRepositoryForTests(
  repo: PersonaCreationRepository | null,
): void {
  testOverride = repo;
}

export function createProductionCreationRepository(): PersonaCreationRepository {
  if (!isSupabaseConfigured()) {
    throw new PersonaDomainError(
      "Supabase ist nicht konfiguriert. Persona Studio benötigt Persistenz.",
      "CONFIG",
    );
  }
  return new SupabaseCreationRepository();
}

export function getCreationRepository(): PersonaCreationRepository {
  if (testOverride) return testOverride;
  return createProductionCreationRepository();
}

export function getCreationRepositoryKind(): "supabase" | "memory" {
  return getCreationRepository().kind;
}
