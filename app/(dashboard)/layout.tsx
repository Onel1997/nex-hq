import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  hasXerianoOwnerAuthority,
  resolveXerianoAccess,
} from "@/lib/xeriano/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Xeriamo Owner", template: "%s · Xeriamo Owner" }, robots: { index: false, follow: false } };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") redirect("/login");
  if (access.status !== "AUTHENTICATED" || !hasXerianoOwnerAuthority(access.context)) {
    redirect("/app");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
