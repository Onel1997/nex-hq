import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { XerianoAuthShell } from "@/components/xeriano/auth-shell";
import { hasXerianoOwnerAuthority, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { loginMaintenanceOwner } from "./actions";

export const metadata: Metadata = { title: "Owner-Zugang · Xeriamo" };

export default async function OwnerLoginPage() {
  const access = await resolveXerianoAccess();
  if (access.status === "AUTHENTICATED" && hasXerianoOwnerAuthority(access.context)) {
    redirect("/hq");
  }

  return (
    <XerianoAuthShell
      title="Owner-Zugang"
      description="Sicherer Zugang zum Xeriamo Owner-Bereich – auch während Wartungsarbeiten."
      footer={<Link href="/maintenance">Zum Xeriamo Status</Link>}
    >
      <LoginForm
        planIntent={null}
        action={loginMaintenanceOwner}
        forgotPasswordHref="/reset-password"
      />
    </XerianoAuthShell>
  );
}
