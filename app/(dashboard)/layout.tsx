import { DashboardShell } from "@/components/layout/dashboard-shell";
import { resolveServerNexhqAuthentication } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authentication = await resolveServerNexhqAuthentication();
  if (!authentication.authenticated) redirect("/login");

  return <DashboardShell>{children}</DashboardShell>;
}
