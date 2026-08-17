import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizePersonaActor,
  parsePersonaAuthorizedUserIds,
  PERSONA_LOCAL_DEV_ACTOR_ID,
  resolvePersonaAuthorizationContext,
} from "./authorization";
import { PersonaDomainError } from "../domain/errors";

describe("Persona authorization and workspace context", () => {
  it("rejects a missing production actor", () => {
    assert.throws(
      () =>
        authorizePersonaActor({
          environment: "production",
          authenticatedUserId: null,
          authorizedUserIds: ["allowed-user"],
          localDevelopmentBypassEnabled: false,
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "AUTHENTICATION_REQUIRED",
    );
  });

  it("rejects an authenticated actor outside the production allowlist", () => {
    assert.throws(
      () =>
        authorizePersonaActor({
          environment: "production",
          authenticatedUserId: "different-user",
          authorizedUserIds: ["allowed-user"],
          localDevelopmentBypassEnabled: false,
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "UNAUTHORIZED_WORKSPACE",
    );
  });

  it("authorizes an allowlisted Supabase actor", () => {
    const result = authorizePersonaActor({
      environment: "production",
      authenticatedUserId: "allowed-user",
      authorizedUserIds: ["allowed-user"],
      localDevelopmentBypassEnabled: false,
    });
    assert.equal(result.actorId, "allowed-user");
    assert.equal(result.accessMode, "authenticated_allowlist");
  });

  it("allows the explicit local bypass only outside production", () => {
    const local = authorizePersonaActor({
      environment: "development",
      authenticatedUserId: null,
      authorizedUserIds: [],
      localDevelopmentBypassEnabled: true,
    });
    assert.equal(local.actorId, PERSONA_LOCAL_DEV_ACTOR_ID);
    assert.equal(local.accessMode, "local_development_bypass");

    assert.throws(
      () =>
        authorizePersonaActor({
          environment: "production",
          authenticatedUserId: null,
          authorizedUserIds: [],
          localDevelopmentBypassEnabled: true,
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "AUTHENTICATION_REQUIRED",
    );
  });

  it("does not resolve the service-role-backed workspace before authorization", async () => {
    let workspaceResolverCalled = false;
    await assert.rejects(
      () =>
        resolvePersonaAuthorizationContext({
          environment: "production",
          authorizedUserIds: ["allowed-user"],
          localDevelopmentBypassEnabled: false,
          getAuthenticatedUserId: async () => null,
          resolveServerWorkspaceId: async () => {
            workspaceResolverCalled = true;
            return "workspace-a";
          },
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "AUTHENTICATION_REQUIRED",
    );
    assert.equal(workspaceResolverCalled, false);
  });

  it("uses only the server-resolved workspace and preserves actor provenance", async () => {
    const context = await resolvePersonaAuthorizationContext({
      environment: "production",
      authorizedUserIds: ["allowed-user"],
      getAuthenticatedUserId: async () => "allowed-user",
      resolveServerWorkspaceId: async () => "workspace-a",
    });
    assert.equal(context.workspaceId, "workspace-a");
    assert.equal(context.actorId, "allowed-user");
    assert.equal(context.workspaceSource, "server_environment");
    assert.equal(context.authorized, true);
  });

  it("normalizes the server allowlist without accepting blank identities", () => {
    assert.deepEqual(
      parsePersonaAuthorizedUserIds(" user-a, user-b, user-a, ,"),
      ["user-a", "user-b"],
    );
  });
});
