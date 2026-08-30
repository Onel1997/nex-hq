import type { Metadata } from "next";
import Link from "next/link";

import { XerianoAuthShell } from "@/components/xeriano/auth-shell";
import {
  getXerianoPlanIntentPresentation,
  withXerianoPlanIntent,
} from "@/lib/xeriano/plan-intent";
import { resolveActiveXerianoPlan } from "@/lib/xeriano/plans";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Konto erstellen · Xeriamo",
  description: "Erstelle dein kostenloses Xeriamo-Konto.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const query = await searchParams;
  const plan = getXerianoPlanIntentPresentation(query.plan);
  const freeCredits = resolveActiveXerianoPlan("FREE")?.grantedCredits ?? 30;
  return (
    <XerianoAuthShell
      title="Konto erstellen"
      description={`Starte mit ${freeCredits.toLocaleString("de-DE")} Credits und bringe dein Design in Bild und Video.`}
      plan={plan}
      footer={<>Bereits registriert? <Link href={withXerianoPlanIntent("/login", plan?.productCode)}>Anmelden</Link></>}
    >
      <RegisterForm planIntent={plan?.productCode ?? null} />
    </XerianoAuthShell>
  );
}
