"use client";
import { useActionState } from "react";
import { requestPasswordReset, updatePassword, type ResetState } from "./actions";

export function ResetPasswordForm({ update, planIntent }: { update: boolean; planIntent: string | null }) {
  const initial: ResetState = { success: false, error: null, mode: update ? "UPDATE" : "REQUEST" };
  const [state, action, pending] = useActionState(update ? updatePassword : requestPasswordReset, initial);
  if (state.success) return <div className="xeriano-auth-success"><strong>{update ? "Passwort gespeichert." : "E-Mail versendet."}</strong><p>{update ? "Du kannst dich jetzt mit deinem neuen Passwort anmelden." : "Wenn ein Konto existiert, erhältst du einen sicheren Link."}</p></div>;
  return <form action={action} className="xeriano-auth-form">
    {planIntent ? <input name="planIntent" type="hidden" value={planIntent} /> : null}
    {update ? <label>Neues Passwort<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label> : <label>E-Mail<input name="email" type="email" autoComplete="email" required /></label>}
    <p className="xeriano-form-error" aria-live="polite">{state.error}</p>
    <button className="xeriano-primary-button" disabled={pending}>{pending ? "Bitte warten …" : update ? "Passwort speichern" : "Reset-Link senden"}</button>
  </form>;
}
