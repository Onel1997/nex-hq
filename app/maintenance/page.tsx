import type { Metadata } from "next";
import { Check, Clock3, Wrench } from "lucide-react";
import { XeriamoBrandLockup } from "@/components/xeriano/brand-identity";
import { loadPublicMaintenanceStatus } from "@/lib/xeriano/maintenance/server";
import { isMaintenanceFrontendPath } from "@/lib/xeriano/maintenance/routing";
import { MaintenanceStatusCheck } from "./status-check";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wartungsarbeiten · Xeriamo",
  robots: { index: false, follow: false },
};

function safeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  const pathname = value.split(/[?#]/, 1)[0] ?? "/";
  return isMaintenanceFrontendPath(pathname) && value.length <= 1_000 ? value : "/";
}

function expectedBackLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; preview?: string }>;
}) {
  const query = await searchParams;
  const status = await loadPublicMaintenanceStatus();
  const showingMaintenance = status.state === "MAINTENANCE" || query.preview === "1";
  const expectedBack = expectedBackLabel(status.expectedBackAt);

  return (
    <main className="xeriano-maintenance-page">
      <div className="xeriano-maintenance-orbit is-one" aria-hidden="true" />
      <div className="xeriano-maintenance-orbit is-two" aria-hidden="true" />
      <section className="xeriano-maintenance-card">
        <header>
          <XeriamoBrandLockup />
        </header>
        <div className="xeriano-maintenance-icon" aria-hidden="true">{showingMaintenance ? <Wrench size={25} /> : <Check size={25} />}</div>
        <p className="xeriano-maintenance-eyebrow">{showingMaintenance ? query.preview === "1" && status.state === "ONLINE" ? "VORSCHAU · WARTUNGSARBEITEN" : "WARTUNGSARBEITEN" : "XERIAMO STATUS"}</p>
        <h1>{showingMaintenance ? "Wir sind gleich wieder da." : "Xeriamo ist online."}</h1>
        <h2>{showingMaintenance ? "Xeriamo wird gerade gewartet." : "Alle Bereiche sind wieder erreichbar."}</h2>
        <p className="xeriano-maintenance-copy">
          {showingMaintenance
            ? status.message ?? "Wir führen momentan Wartungsarbeiten durch, um Xeriamo zu verbessern. Bitte versuche es in Kürze erneut."
            : "Du kannst jetzt zu Xeriamo zurückkehren."}
        </p>
        {showingMaintenance && expectedBack ? (
          <p className="xeriano-maintenance-expected"><Clock3 size={17} aria-hidden="true" />Voraussichtlich wieder online: {expectedBack} Uhr</p>
        ) : null}
        <MaintenanceStatusCheck returnTo={safeReturnTo(query.returnTo)} online={!showingMaintenance} />
      </section>
    </main>
  );
}
