export const persona = {
  errors: {
    supabaseNotConfigured:
      "Supabase ist nicht konfiguriert. Persona Studio benötigt Persistenz.",
    invalidRequest: "Ungültige Anfrage",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten",
    unauthorizedWorkspace: "Kein Zugriff auf diesen Workspace.",
    missingApprovalPrerequisites: "Freigabevoraussetzungen nicht erfüllt.",
    invalidReference: "Ungültige Referenzdatei.",
    invalidPrimary: "Ungültige Primärreferenz.",
    storageFailed: "Speicher-Upload fehlgeschlagen.",
    storageDeleteFailed:
      "Löschen fehlgeschlagen. Die Referenz wurde nicht entfernt.",
    migrationRequired:
      "Einrichtung erforderlich: Persona-Studio-Migrationen fehlen. Bitte die SQL-Migrationen anwenden.",
    bucketMissing:
      "Einrichtung erforderlich: Privater Storage-Bucket „persona-references“ fehlt.",
    notFound: "Eintrag nicht gefunden.",
    workflow: "Ungültiger Workflow-Schritt.",
    costConfirmationRequired:
      "Kostenbestätigung erforderlich vor bezahlter Generierung.",
    generationDisabled:
      "Generierung ist deaktiviert. Nutzen Sie manuellen Upload oder konfigurieren Sie OPENAI_API_KEY.",
    providerNotConfigured:
      "Image-Provider ist nicht konfiguriert. Manueller Upload ist verfügbar.",
    conversionFailed: "Kandidat konnte nicht in eine Persona überführt werden.",
    duplicateSelection:
      "Pro Creation-Projekt darf nur ein Kandidat ausgewählt werden.",
  },
  ui: {
    referenceLibrary: "Referenzbibliothek",
    upload: "Hochladen",
    markPrimary: "Als Primär setzen",
    approveAsset: "Freigeben",
    rejectAsset: "Ablehnen",
    archiveAsset: "Archivieren",
    deleteAsset: "Löschen",
    completeness: "Vollständigkeit",
    visuallyIncomplete: "Visuell unvollständig",
    visuallyComplete: "Visuell vollständig",
    healthReady: "Bereit",
    healthSetupRequired: "Einrichtung erforderlich",
    healthError: "Fehler",
    brandCast: "Brand Cast",
    personaCreator: "Persona Creator",
    creationProjects: "Creation Projects",
    candidates: "Kandidaten",
    costEstimate: "Kostenschätzung",
    confirmCost: "Kosten bestätigen und generieren",
    shortlist: "Shortlist",
    selectCandidate: "Auswählen",
    convertToPersona: "In Draft-Persona überführen",
    identityLock: "Identity Lock",
    immutableFeatures: "Unveränderlich",
    flexibleFeatures: "Flexibel",
    additionalDescription: "Zusätzliche Beschreibung",
  },
} as const;
