import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { XerianoAuthShell } from "@/components/xeriano/auth-shell";
import {
  hasXerianoOwnerAuthority,
  resolveXerianoAccess,
} from "@/lib/xeriano/auth";
import {
  getXerianoPlanIntentPresentation,
  withXerianoPlanIntent,
} from "@/lib/xeriano/plan-intent";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden · Xeriamo",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const query = await searchParams;
  const plan = getXerianoPlanIntentPresentation(query.plan);
  const access = await resolveXerianoAccess();
  if (access.status === "AUTHENTICATED") {
    const customerDestination = plan
      ? withXerianoPlanIntent("/app/credits", plan.productCode)
      : "/app";
    redirect(
      hasXerianoOwnerAuthority(access.context)
        ? "/hq"
        : customerDestination,
    );
  }

  return (
    <XerianoAuthShell
      title="Willkommen zurück"
      description="Melde dich bei Xeriamo an."
      plan={plan}
      footer={<>Noch kein Konto? <Link href={withXerianoPlanIntent("/register", plan?.productCode)}>Konto erstellen</Link></>}
    >
      <LoginForm planIntent={plan?.productCode ?? null} />
    </XerianoAuthShell>
  );
}
