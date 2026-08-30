export const GENERIC_LOGIN_ERROR = "E-Mail oder Passwort ist ungültig." as const;

export type PasswordLoginResult =
  | { ok: true }
  | { ok: false; error: typeof GENERIC_LOGIN_ERROR };

type SignInWithPassword = (credentials: {
  email: string;
  password: string;
}) => Promise<{ error: unknown | null }>;

type SignOut = () => Promise<{ error: unknown | null }>;

export async function authenticateNexhqPassword(input: {
  email: string;
  password: string;
  signInWithPassword: SignInWithPassword;
}): Promise<PasswordLoginResult> {
  const email = input.email.trim();
  if (!email || !input.password) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  try {
    const { error } = await input.signInWithPassword({
      email,
      password: input.password,
    });
    return error
      ? { ok: false, error: GENERIC_LOGIN_ERROR }
      : { ok: true };
  } catch {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
}

export async function endNexhqSession(signOut: SignOut): Promise<void> {
  try {
    await signOut();
  } catch {
    // Redirecting to the public login surface remains the safe local outcome.
  }
}
