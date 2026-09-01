"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { XeriamoPublicMaintenanceStatus } from "@/lib/xeriano/maintenance/contracts";

function safeReturnTo(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && value.length <= 1_000
    ? value
    : "/";
}

export function MaintenanceStatusCheck({
  returnTo,
  online = false,
}: {
  returnTo: string;
  online?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/public/maintenance?fresh=${Date.now()}`, {
        cache: "no-store",
      });
      const body = await response.json() as { status?: XeriamoPublicMaintenanceStatus };
      if (response.ok && body.status?.state === "ONLINE") {
        const destination = new URL(safeReturnTo(returnTo), window.location.origin);
        destination.searchParams.set("maintenance_recheck", Date.now().toString());
        window.location.assign(`${destination.pathname}${destination.search}${destination.hash}`);
        return;
      }
      setNotice("Die Wartungsarbeiten laufen noch. Bitte versuche es in Kürze erneut.");
    } catch {
      setNotice("Der Status konnte gerade nicht geprüft werden.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="xeriano-maintenance-actions">
      <button type="button" onClick={() => void check()} disabled={checking}>
        <RefreshCw size={18} className={checking ? "spin" : undefined} aria-hidden="true" />
        {checking ? "Status wird geprüft …" : online ? "Xeriamo öffnen" : "Status prüfen"}
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  );
}
