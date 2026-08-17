import type { UserResponse } from "@supabase/supabase-js";

export type NexhqAuthenticatedActor = {
  userId: string;
  email: string | null;
  authenticationSource: "supabase_auth";
};

export type NexhqAuthenticationResult =
  | {
      authenticated: true;
      actor: NexhqAuthenticatedActor;
    }
  | {
      authenticated: false;
      reason: "missing_user" | "validation_failed";
    };

export type ValidatedUserReader = () => Promise<UserResponse>;

/**
 * Resolve only a user validated by Supabase Auth. This intentionally accepts
 * an anon/session-scoped reader; service-role clients must never authenticate
 * application callers.
 */
export async function resolveValidatedNexhqActor(
  getUser: ValidatedUserReader,
): Promise<NexhqAuthenticationResult> {
  try {
    const { data, error } = await getUser();
    if (error || !data.user) {
      return {
        authenticated: false,
        reason: error ? "validation_failed" : "missing_user",
      };
    }

    return {
      authenticated: true,
      actor: {
        userId: data.user.id,
        email: data.user.email ?? null,
        authenticationSource: "supabase_auth",
      },
    };
  } catch {
    return { authenticated: false, reason: "validation_failed" };
  }
}

