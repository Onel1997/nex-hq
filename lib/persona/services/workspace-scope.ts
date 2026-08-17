/** Resolve the authorized, server-selected Persona workspace scope. */

import {
  resolvePersonaAuthorizationContext,
  type PersonaAuthorizationContext,
} from "../security/authorization";

export async function resolvePersonaWorkspaceScope(): Promise<PersonaAuthorizationContext> {
  return resolvePersonaAuthorizationContext();
}
