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
    notFound: "Eintrag nicht gefunden.",
    workflow: "Ungültiger Workflow-Schritt.",
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
  },
} as const;
