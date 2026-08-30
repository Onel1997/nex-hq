import type { Metadata } from "next";
import Link from "next/link";

import { XerianoAuthShell } from "@/components/xeriano/auth-shell";
import {
  getXerianoPlanIntentPresentation,
  withXerianoPlanIntent,
} from "@/lib/xeriano/plan-intent";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Passwort zurücksetzen · Xeriamo" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; plan?: string }>;
}) {
  const query = await searchParams;
  const update = query.mode === "update";
  const plan = getXerianoPlanIntentPresentation(query.plan);
  return (
    <XerianoAuthShell
      title={update ? "Neues Passwort" : "Passwort vergessen?"}
      description={update ? "Lege ein neues, sicheres Passwort fest." : "Wir senden dir einen sicheren Link zum Zurücksetzen."}
      plan={plan}
      footer={<Link href={withXerianoPlanIntent("/login", plan?.productCode)}>Zurück zur Anmeldung</Link>}
    >
      <ResetPasswordForm update={update} planIntent={plan?.productCode ?? null} />
    </XerianoAuthShell>
  );
}
