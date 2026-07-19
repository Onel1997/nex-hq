import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import type { PersonaRepository } from "./persona-repository";
import { SupabasePersonaRepository } from "./supabase-persona-repository";

let testOverride: PersonaRepository | null = null;

export function setPersonaRepositoryForTests(repo: PersonaRepository | null): void {
  testOverride = repo;
}

export function createProductionPersonaRepository(): PersonaRepository {
  if (!isSupabaseConfigured()) {
    throw new PersonaDomainError(
      "Supabase ist nicht konfiguriert. Persona Studio benötigt Persistenz.",
      "CONFIG",
    );
  }
  return new SupabasePersonaRepository();
}

/** Production default is ALWAYS Supabase — memory only via test override. */
export function getPersonaRepository(): PersonaRepository {
  if (testOverride) return testOverride;
  return createProductionPersonaRepository();
}

export function getPersonaRepositoryKind(): "supabase" | "memory" {
  return getPersonaRepository().kind;
}
