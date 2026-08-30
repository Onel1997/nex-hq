export type OwnerProductionActionPhase =
  | "confirming"
  | "base"
  | "composite"
  | "review";

export type OwnerProductionState = {
  phase:
    | "IDLE"
    | "PREPARING"
    | "CONFIRMING"
    | "BASE_RUNNING"
    | "COMPOSITING"
    | "SAVING"
    | "REVIEW_REQUIRED"
    | "SUCCEEDED"
    | "FAILED"
    | "UNKNOWN_OUTCOME"
    | "CONTINUATION";
  title: string;
  detail: string;
  busy: boolean;
  showContinuation: boolean;
  tone: "neutral" | "success" | "danger" | "warning";
};

export function resolveOwnerProductionState(input: {
  busy: boolean;
  actionPhase: OwnerProductionActionPhase | null;
  prepareStatus: string;
  recoveryState?: string | null;
  jobStatus?: string | null;
  reviewStatus?: string | null;
  recoveredContinuation?: boolean;
  duplicateClickIgnored?: boolean;
  hasError?: boolean;
  depthAnalysisPending?: boolean;
}): OwnerProductionState {
  const detail = input.duplicateClickIgnored
    ? "Der Auftrag läuft bereits. Bitte warte auf das Ergebnis."
    : "Du kannst diese Seite geöffnet lassen. Das Ergebnis erscheint automatisch, sobald es bereit ist.";
  if (input.hasError) {
    return {
      phase: "FAILED",
      title: "Bild konnte nicht fertiggestellt werden.",
      detail: "Prüfe den Hinweis. Starte keinen zweiten Auftrag, solange der Ausgang des aktuellen Auftrags unklar ist.",
      busy: false,
      showContinuation: false,
      tone: "danger",
    };
  }
  if (input.actionPhase === "review") {
    return {
      phase: "SAVING",
      title: "Prüfung wird gespeichert …",
      detail: "Deine Entscheidung wird sicher gespeichert.",
      busy: true,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (input.recoveryState === "UNKNOWN_PROVIDER_OUTCOME") {
    return {
      phase: "UNKNOWN_OUTCOME",
      title: "Der Provider-Ausgang ist noch unklar.",
      detail:
        "NexHQ startet keinen zweiten bezahlten Versuch. Der Auftrag muss zuerst geprüft werden.",
      busy: false,
      showContinuation: false,
      tone: "warning",
    };
  }
  if (input.reviewStatus === "APPROVED") {
    return {
      phase: "SUCCEEDED",
      title: "Bild erfolgreich erstellt und freigegeben.",
      detail: "Das Ergebnis ist gespeichert.",
      busy: false,
      showContinuation: false,
      tone: "success",
    };
  }
  if (input.reviewStatus === "REJECTED") {
    return {
      phase: "SUCCEEDED",
      title: "Bild erstellt und abgelehnt.",
      detail: "Das Ergebnis bleibt im Verlauf erhalten.",
      busy: false,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (input.reviewStatus === "REVIEW_REQUIRED") {
    return {
      phase: "REVIEW_REQUIRED",
      title: "Ergebnis ist zur Prüfung bereit.",
      detail: "Prüfe Identität, Produkt, Artwork und Bildqualität.",
      busy: false,
      showContinuation: false,
      tone: "success",
    };
  }
  if (
    input.recoveryState === "BASE_FAILED" ||
    input.recoveryState === "COMPOSITE_FAILED" ||
    input.jobStatus === "failed"
  ) {
    return {
      phase: "FAILED",
      title:
        input.recoveryState === "COMPOSITE_FAILED"
          ? "Artwork konnte nicht angewendet werden."
          : "Bild konnte nicht fertiggestellt werden.",
      detail:
        input.recoveryState === "COMPOSITE_FAILED"
          ? "Das Basisbild bleibt gespeichert. Ein erneutes Anwenden verursacht keinen neuen Provider-Aufruf."
          : "Öffne die technischen Details nur, wenn du die Ursache prüfen möchtest.",
      busy: false,
      showContinuation: false,
      tone: "danger",
    };
  }
  if (
    input.recoveryState === "SAVING_RESULT" ||
    (input.busy && input.recoveryState === "SAVING_RESULT")
  ) {
    return {
      phase: "SAVING",
      title: "Ergebnis wird gespeichert …",
      detail,
      busy: true,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (
    input.recoveryState === "COMPOSITING" ||
    input.recoveryState === "BASE_READY" ||
    input.actionPhase === "composite"
  ) {
    return {
      phase: "COMPOSITING",
      title:
        input.depthAnalysisPending
          ? "Stofftiefe wird analysiert …"
          : input.recoveryState === "BASE_READY"
          ? "Kleidungsstück erkannt. Artwork wird angewendet …"
          : "Artwork wird auf das Produkt angewendet …",
      detail,
      busy: true,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (
    input.recoveryState === "BASE_RUNNING" ||
    input.jobStatus === "running" ||
    input.actionPhase === "base"
  ) {
    return {
      phase: "BASE_RUNNING",
      title:
        input.recoveryState === "BASE_RUNNING" || input.jobStatus === "running"
          ? "Basisbild wird erstellt …"
          : "Markenmodell und Produkt werden verarbeitet …",
      detail:
        input.duplicateClickIgnored
          ? detail
          : input.jobStatus === "running" || input.recoveryState === "BASE_RUNNING"
          ? "Danach: Kleidungsstück wird erkannt … Bitte warte auf das Ergebnis."
          : detail,
      busy: true,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (input.actionPhase === "confirming") {
    return {
      phase: "CONFIRMING",
      title: "Auftrag wird bestätigt …",
      detail,
      busy: true,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (
    input.prepareStatus === "validating" ||
    input.prepareStatus === "freezing" ||
    input.prepareStatus === "preparing"
  ) {
    return {
      phase: "PREPARING",
      title:
        input.prepareStatus === "freezing"
          ? "Referenzen werden vorbereitet …"
          : input.prepareStatus === "validating"
            ? "Produktdaten und Platzierung werden geprüft …"
            : "Bild wird vorbereitet …",
      detail: "NexHQ prüft alle Produktionsgrundlagen vor der Bestätigung.",
      busy: true,
      showContinuation: false,
      tone: "neutral",
    };
  }
  if (
    input.recoveryState === "CONFIRMED" &&
    input.recoveredContinuation
  ) {
    return {
      phase: "CONTINUATION",
      title: "Bestätigter Auftrag wartet auf Fortsetzung.",
      detail:
        "Dieser Auftrag wurde nach einem Seitenwechsel wiederhergestellt und kann sicher fortgesetzt werden.",
      busy: false,
      showContinuation: true,
      tone: "neutral",
    };
  }
  return {
    phase: "IDLE",
    title: "Bereit",
    detail: "",
    busy: input.busy,
    showContinuation: false,
    tone: "neutral",
  };
}

export function ownerFacingProductionError(details: string): string {
  if (/MIDAS_NORMAL_|NORMAL_(?:EVIDENCE|FIELD|SILHOUETTE|ASSISTED)/i.test(details)) {
    return "Die Shirt-Oberflächenrichtung konnte nicht sicher bestimmt werden. Es wurde kein Ergebnis zur Freigabe erstellt.";
  }
  if (/ORIENTED_PLANE_|sichtbare Shirt-Ausrichtung/i.test(details)) {
    return "Die Front-Druckfläche konnte nicht sicher an die sichtbare Shirt-Ausrichtung angepasst werden.";
  }
  if (/DEPTH_ESTIMATION_FAILED|Stofftiefe.*nicht.*zuverlässig/i.test(details)) {
    return "Die Stofftiefe konnte für dieses Bild nicht zuverlässig bestimmt werden.";
  }
  if (/STAGE_A_NOT_PRINT_READY|nicht genügend freie Shirt-Frontfläche/i.test(details)) {
    return "Das Basisbild zeigt nicht genügend freie Shirt-Frontfläche für den gewählten großen Frontprint.";
  }
  if (/OWNER_VERTICAL_PLACEMENT_UNSAFE|gewählte Höhe/i.test(details)) {
    return "Die gewählte Höhe konnte auf diesem Bild nicht sicher beibehalten werden.";
  }
  if (/SURFACE_REALISM_REFINEMENT_UNSAFE|stärker.*Perspektive.*Stoffrichtung.*Shirt-Oberfläche/i.test(details)) {
    return "Das Artwork konnte nicht sicher stärker an Perspektive, Stoffrichtung und Shirt-Oberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.";
  }
  if (/DEPTH_AWARE_SURFACE_UNSAFE|Perspektive.*Körperneigung.*Stoffoberfläche/i.test(details)) {
    return "Das Artwork konnte nicht sicher an Perspektive, Körperneigung und Stoffoberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.";
  }
  if (/GARMENT_REGISTRATION_FRONT_TORSO_UNSAFE|Front-Druckfläche.*Shirt-Torso/i.test(details)) {
    return "Die Front-Druckfläche konnte auf diesem Bild nicht zuverlässig auf den Shirt-Torso begrenzt werden.";
  }
  if (/große Frontprint.*gewünschten Größe|owner-print-footprint/i.test(details)) {
    return "Der gewählte große Frontprint konnte auf diesem Bild nicht in der gewünschten Größe sicher erhalten werden.";
  }
  if (/ohne Verzerrung oder Beschnitt|strict-artwork-contain-fit/i.test(details)) {
    return "Das Artwork konnte in dieser Druckfläche nicht ohne Verzerrung oder Beschnitt platziert werden.";
  }
  if (/SURFACE_INTEGRATION_UNSAFE|Shirt-Oberfläche.*nicht.*zuverlässig/i.test(details)) {
    return "Das Artwork konnte nicht sicher an Falten, Licht und Stoffoberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.";
  }
  if (/BRAND_MODEL_IDENTITY_MISMATCH|identity.*mismatch|Markenmodel.*nicht.*überein/i.test(details)) {
    return "Das erzeugte Bild stimmt nicht sicher genug mit dem gewählten Markenmodel überein. Es wurde kein Ergebnis zur Freigabe erstellt.";
  }
  if (/GARMENT_SEGMENTATION_UNSAFE|Kleidungsstück.*nicht sicher erkannt/i.test(details)) {
    return "Kleidungsstück konnte auf diesem Bild nicht sicher erkannt werden. Das Artwork wurde nicht angewendet.";
  }
  if (/GARMENT_REGISTRATION_LARGE_FRONT_UNSAFE|LARGE_FRONT_UNSAFE/i.test(details)) {
    return "Der gewählte große Frontprint konnte auf diesem Bild nicht sicher innerhalb der tatsächlichen Shirt-Frontfläche erhalten werden.";
  }
  if (/GARMENT_REGISTRATION_LOW_CONFIDENCE|Druckfläche.*nicht sicher erkannt/i.test(details)) {
    return "Druckfläche konnte auf diesem Bild nicht sicher erkannt werden. Das Artwork wurde nicht angewendet.";
  }
  if (/BASE_PRINT_ZONE_CONTAMINATED|blank|Fremd|contaminat/i.test(details)) {
    return "Im Basisbild wurde ein fremder Aufdruck erkannt. Das Artwork wurde nicht angewendet.";
  }
  if (/fingerprint|snapshot|passt nicht|version mismatch/i.test(details)) {
    return "Die vorbereiteten Produktionsdaten sind nicht mehr aktuell. Bitte bereite das Bild neu vor.";
  }
  if (/unknown outcome|Ausgang.*unklar|reconcil/i.test(details)) {
    return "Der Ausgang des Provider-Auftrags ist unklar. NexHQ startet aus Sicherheitsgründen keinen zweiten Versuch.";
  }
  if (/already claimed|already running|bereits.*läuft/i.test(details)) {
    return "Dieser Auftrag läuft bereits. Bitte warte auf den aktuellen Produktionsstand.";
  }
  return "Bild konnte nicht fertiggestellt werden. Die technischen Details enthalten die Ursache.";
}
