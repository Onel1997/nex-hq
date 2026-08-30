"use client";

import { useActionState } from "react";
import { registerCustomer, type RegisterState } from "./actions";

const initial: RegisterState = { success: false, error: null };

export function RegisterForm({ planIntent }: { planIntent: string | null }) {
  const [state, action, pending] = useActionState(registerCustomer, initial);
  if (state.success) return <div className="xeriano-auth-success"><strong>Fast geschafft.</strong><p>Prüfe dein E-Mail-Postfach und bestätige dein Xeriamo-Konto.</p></div>;
  return <form action={action} className="xeriano-auth-form">
    {planIntent ? <input name="planIntent" type="hidden" value={planIntent} /> : null}
    <label>Name<input name="name" autoComplete="name" required /></label>
    <label>E-Mail<input name="email" type="email" autoComplete="email" required /></label>
    <label>Passwort<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
    <p className="xeriano-form-hint">Mindestens 8 Zeichen.</p>
    <p className="xeriano-form-error" aria-live="polite">{state.error}</p>
    <button className="xeriano-primary-button" disabled={pending}>{pending ? "Konto wird erstellt …" : "Kostenlos starten"}</button>
  </form>;
}
