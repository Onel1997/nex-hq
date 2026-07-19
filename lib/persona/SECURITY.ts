/**
 * Persona Studio security notes (Phase 1.1–1.2).
 *
 * Current service-role behavior
 * -----------------------------
 * API routes use the Supabase service-role client (`createAdminClient`).
 * Service role bypasses RLS. All Persona Studio reads/writes therefore rely on
 * application-layer workspace scoping in `SupabasePersonaRepository` /
 * `SupabaseCreationRepository`, not on database membership policies.
 *
 * Application-level workspace enforcement
 * ---------------------------------------
 * `resolvePersonaWorkspaceScope()` resolves the active workspace server-side
 * from `NEXHQ_WORKSPACE_SLUG` / Brain seed (`milaene` by default).
 * Callers must never pass a trusted workspace ID from the client.
 * Repository methods filter by `scope.workspaceId` and call `assertWorkspace`.
 *
 * Candidate storage (Phase 1.2)
 * -----------------------------
 * Candidate assets live in the private `persona-references` bucket under
 * `workspace/{id}/persona-creation/...`. Only signed URLs are served.
 * Conversion copies into persona reference paths; no public permanent URLs.
 *
 * Current RLS limitations
 * -----------------------
 * Persona tables have RLS enabled with permissive `USING (true)` policies
 * (matching Brain development conventions). Combined with service-role access,
 * RLS does not provide multi-tenant isolation today.
 *
 * Future SaaS / external-user requirement
 * ---------------------------------------
 * Before external multi-tenant rollout, introduce user↔workspace membership
 * and tighten RLS to membership-scoped policies. Until then, treat Persona
 * Studio as an internal single-active-workspace deployment.
 */

export const PERSONA_SECURITY_NOTES_VERSION = "phase-1.2" as const;
