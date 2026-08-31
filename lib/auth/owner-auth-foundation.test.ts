import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserResponse } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { resolveValidatedNexhqActor } from "./authentication";
import {
  authenticateNexhqPassword,
  endNexhqSession,
  GENERIC_LOGIN_ERROR,
} from "./password-session";
import {
  decideNexhqAuthRouting,
  isCustomerProductApiPath,
  isPublicNexhqPath,
} from "./routing";
import { authorizePersonaActor } from "@/lib/persona/security/authorization";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { updateSession } from "@/lib/supabase/middleware";

function userResponse(userId: string): UserResponse {
  return {
    data: {
      user: {
        id: userId,
        email: "owner@example.invalid",
      },
    },
    error: null,
  } as unknown as UserResponse;
}

async function withoutSupabasePublicConfig<T>(run: () => Promise<T>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    return await run();
  } finally {
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
  }
}

describe("NexHQ private-owner authentication foundation", () => {
  it("keeps login and required static assets public", () => {
    assert.equal(isPublicNexhqPath("/login"), true);
    assert.equal(isPublicNexhqPath("/_next/static/app.js"), true);
    assert.deepEqual(
      decideNexhqAuthRouting({ pathname: "/login", authenticated: false }),
      { kind: "allow" },
    );
  });

  it("keeps the Xeriano landing public and redirects an unauthenticated dashboard request", () => {
    assert.deepEqual(
      decideNexhqAuthRouting({ pathname: "/", authenticated: false }),
      { kind: "allow" },
    );
    assert.deepEqual(
      decideNexhqAuthRouting({
        pathname: "/agents/persona",
        authenticated: false,
      }),
      { kind: "redirect", location: "/login" },
    );
  });

  it("allows a validated authenticated actor through the dashboard boundary", async () => {
    const authentication = await resolveValidatedNexhqActor(async () =>
      userResponse("owner-user"),
    );

    assert.equal(authentication.authenticated, true);
    assert.deepEqual(
      decideNexhqAuthRouting({
        pathname: "/agents/persona",
        authenticated: authentication.authenticated,
      }),
      { kind: "allow" },
    );
  });

  it("keeps the Xeriamo product Design Studio customer-safe while protecting Design Studio Intern", () => {
    assert.equal(isCustomerProductApiPath("/api/design-studio/history"), true);
    assert.equal(isCustomerProductApiPath("/api/design/run"), false);

    for (const pathname of [
      "/app/design-studio",
      "/api/design-studio/history",
      "/api/design-studio/quote",
      "/api/design-studio/generate",
      "/api/design-studio/utility",
      "/api/design-studio/svg-to-png",
    ]) {
      assert.deepEqual(
        decideNexhqAuthRouting({
          pathname,
          authenticated: true,
          internalOwner: false,
        }),
        { kind: "allow" },
        pathname,
      );
    }

    assert.deepEqual(
      decideNexhqAuthRouting({
        pathname: "/agents/design",
        authenticated: true,
        internalOwner: false,
      }),
      { kind: "redirect", location: "/app" },
    );
    assert.deepEqual(
      decideNexhqAuthRouting({
        pathname: "/api/design/run",
        authenticated: true,
        internalOwner: false,
      }),
      { kind: "api_forbidden", status: 403 },
    );

    for (const pathname of ["/hq/design-studio", "/agents/design"]) {
      assert.deepEqual(
        decideNexhqAuthRouting({
          pathname,
          authenticated: true,
          internalOwner: true,
        }),
        { kind: "allow" },
        pathname,
      );
    }
  });

  it("returns the JSON-401 decision for an unauthenticated API", () => {
    assert.deepEqual(
      decideNexhqAuthRouting({
        pathname: "/api/image/generate",
        authenticated: false,
      }),
      { kind: "api_unauthorized", status: 401 },
    );
  });

  it("materializes unauthenticated API protection as JSON rather than HTML", async () => {
    const response = await withoutSupabasePublicConfig(() =>
      updateSession(
        new NextRequest("https://nexhq.example/api/image/generate"),
      ),
    );

    assert.equal(response.status, 401);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), {
      error: "Authentication is required.",
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("materializes dashboard protection without blocking the login route", async () => {
    const dashboard = await withoutSupabasePublicConfig(() =>
      updateSession(new NextRequest("https://nexhq.example/agents/persona")),
    );
    const login = await withoutSupabasePublicConfig(() =>
      updateSession(new NextRequest("https://nexhq.example/login")),
    );

    assert.equal(dashboard.status, 307);
    assert.equal(dashboard.headers.get("location"), "https://nexhq.example/login");
    assert.equal(login.status, 200);
  });

  it("keeps login public without creating a redirect loop", () => {
    assert.deepEqual(
      decideNexhqAuthRouting({ pathname: "/login", authenticated: false }),
      { kind: "allow" },
    );
    assert.deepEqual(
      decideNexhqAuthRouting({ pathname: "/login", authenticated: true }),
      { kind: "allow" },
    );
  });

  it("uses the same generic error for invalid input and rejected credentials", async () => {
    let providerCalled = false;
    const missing = await authenticateNexhqPassword({
      email: "",
      password: "",
      signInWithPassword: async () => {
        providerCalled = true;
        return { error: null };
      },
    });
    const rejected = await authenticateNexhqPassword({
      email: "owner@example.invalid",
      password: "wrong",
      signInWithPassword: async () => ({ error: new Error("rejected") }),
    });

    assert.equal(providerCalled, false);
    assert.deepEqual(missing, { ok: false, error: GENERIC_LOGIN_ERROR });
    assert.deepEqual(rejected, { ok: false, error: GENERIC_LOGIN_ERROR });
  });

  it("ends the session before unauthenticated routing takes effect", async () => {
    let sessionActive = true;
    await endNexhqSession(async () => {
      sessionActive = false;
      return { error: null };
    });

    assert.equal(sessionActive, false);
    assert.deepEqual(decideNexhqAuthRouting({ pathname: "/", authenticated: sessionActive }), { kind: "allow" });
    assert.deepEqual(decideNexhqAuthRouting({ pathname: "/agents/persona", authenticated: sessionActive }), { kind: "redirect", location: "/login" });
  });

  it("keeps Persona authorization stronger than general authentication", () => {
    for (const authorizedUserIds of [[], ["different-user"]]) {
      assert.throws(
        () =>
          authorizePersonaActor({
            environment: "production",
            authenticatedUserId: "owner-user",
            authorizedUserIds,
            localDevelopmentBypassEnabled: false,
          }),
        (error: unknown) =>
          error instanceof PersonaDomainError &&
          error.code === "UNAUTHORIZED_WORKSPACE",
      );
    }

    const authorized = authorizePersonaActor({
      environment: "production",
      authenticatedUserId: "owner-user",
      authorizedUserIds: ["owner-user"],
      localDevelopmentBypassEnabled: false,
    });
    assert.equal(authorized.authorized, true);
    assert.equal(authorized.actorId, "owner-user");
  });

  it("never treats the Persona development bypass as production auth", () => {
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
});
