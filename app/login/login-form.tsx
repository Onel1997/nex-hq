"use client";

import Link from "next/link";
import { useActionState } from "react";

import { withXerianoPlanIntent } from "@/lib/xeriano/plan-intent";
import { loginOwner, type LoginActionState } from "./actions";

const INITIAL_LOGIN_ACTION_STATE: LoginActionState = { error: null };

export function LoginForm({ planIntent }: { planIntent: string | null }) {
  const [state, formAction, pending] = useActionState(
    loginOwner,
    INITIAL_LOGIN_ACTION_STATE,
  );

  return (
    <form action={formAction} className="xeriano-auth-form">
      {planIntent ? <input name="planIntent" type="hidden" value={planIntent} /> : null}
      <label htmlFor="email">
        E-Mail
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </label>
      <label htmlFor="password">
        Passwort
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      <Link className="xeriano-auth-forgot" href={withXerianoPlanIntent("/reset-password", planIntent)}>
        Passwort vergessen?
      </Link>
      <div aria-live="polite" className="xeriano-form-error">{state.error}</div>
      <button type="submit" className="xeriano-primary-button" disabled={pending}>
        {pending ? "Anmeldung läuft …" : "Anmelden"}
      </button>
    </form>
  );
}
