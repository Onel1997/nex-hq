/**
 * Persona Studio security notes (Phase 1.1–1.2).
 *
 * Current service-role behavior
 * -----------------------------
 * NexHQ's private-owner middleware first requires a validated Supabase Auth
 * session for application pages/APIs. Persona then applies its own stronger
 * UID allowlist and server-selected workspace authorization; general login
 * never substitutes for Persona authorization.
 *
 * API routes authorize through the shared Persona authorization context before
 * service-role repositories are reached. Service role bypasses RLS and remains
 * infrastructure capability only.
 *
 * Application-level workspace enforcement
 * ---------------------------------------
 * The guard resolves the active workspace server-side from
 * `NEXHQ_WORKSPACE_SLUG` / Brain seed after authenticating the actor. Production
 * access is restricted by `NEXHQ_PERSONA_AUTHORIZED_USER_IDS` until a durable
 * workspace-membership model exists. An explicit non-production-only bypass is
 * available through `NEXHQ_PERSONA_DEV_AUTH_BYPASS`.
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
 * The Milestone 2 migration removes known permissive Persona policies, enables
 * RLS on all Persona tables, and revokes anon/authenticated table privileges.
 * Direct browser table access is intentionally denied; authorized server routes
 * use service-role repositories. Both Foundation migrations were applied to
 * the linked Milaene project on 2026-08-16; post-apply catalog checks verified
 * RLS, direct-client grant revocation, and retained service-role privileges.
 *
 * Future SaaS / external-user requirement
 * ---------------------------------------
 * Before external multi-tenant rollout, introduce user↔workspace membership
 * and tighten RLS to membership-scoped policies. Until then, treat Persona
 * Studio as an internal single-active-workspace deployment.
 */

export const PERSONA_SECURITY_NOTES_VERSION = "foundation-milestone-2" as const;
