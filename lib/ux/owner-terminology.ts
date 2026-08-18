export const OWNER_STATUS_LABELS: Readonly<Record<string, string>> = {
  UNSET: "Nicht ausgewählt",
  unset: "Nicht ausgewählt",
  WAITING: "Wartet",
  waiting: "Wartet",
  PREPARING: "Wird vorbereitet",
  preparing: "Wird vorbereitet",
  GENERATING: "Wird erstellt",
  generating: "Wird erstellt",
  COMPLETE: "Abgeschlossen",
  complete: "Abgeschlossen",
  READY_TO_GENERATE: "Bereit zur Generierung",
  ready_to_generate: "Bereit zur Generierung",
  "Ready to Generate": "Bereit zur Generierung",
  "In Production": "Wird erstellt",
  Preparing: "Wird vorbereitet",
  "Production Complete": "Produktion abgeschlossen",
  "Assets Staged": "Ergebnisse vorbereitet",
  Standby: "Bereit zum Start",
  AWAITING_CONFIRMATION: "Bestätigung erforderlich",
  awaiting_confirmation: "Bestätigung erforderlich",
  CONFIRMED: "Bestätigt",
  confirmed: "Bestätigt",
  RUNNING: "Wird erstellt",
  running: "Wird erstellt",
  SUCCEEDED: "Erfolgreich",
  succeeded: "Erfolgreich",
  FAILED: "Fehlgeschlagen",
  failed: "Fehlgeschlagen",
  APPROVED: "Freigegeben",
  approved: "Freigegeben",
  REJECTED: "Abgelehnt",
  rejected: "Abgelehnt",
  REVIEW_REQUIRED: "Prüfung erforderlich",
  GENERATED: "Erstellt",
  BASE_READY: "Basisbild bereit",
  COMPOSITING: "Artwork wird platziert",
  COMPOSITE_FAILED: "Platzierung fehlgeschlagen",
  NEEDS_REVISION: "Überarbeitung erforderlich",
  needs_revision: "Überarbeitung erforderlich",
  UNKNOWN_PROVIDER_OUTCOME: "Provider-Ergebnis unbekannt",
  CANCELLED: "Abgebrochen",
  cancelled: "Abgebrochen",
  READY: "Bereit",
  ready: "Bereit",
  Draft: "Entwurf",
  draft: "Entwurf",
  Review: "In Prüfung",
  review: "In Prüfung",
  Archived: "Archiviert",
  archived: "Archiviert",
  Selected: "Ausgewählt",
  selected: "Ausgewählt",
  ACTIVE: "Aktiv",
  active: "Aktiv",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
  AVAILABLE: "Verfügbar",
  UNAVAILABLE: "Nicht verfügbar",
  BASE_FAILED: "Basisbild fehlgeschlagen",
};

export const OWNER_SHOT_LABELS: Readonly<Record<string, string>> = {
  "Hero Image": "Hero-Aufnahme",
  "Product Mockup": "Produktansicht",
  "Flat Lay": "Flatlay",
  Lifestyle: "Lifestyle",
  Editorial: "Editorial",
  "Campaign Hero": "Kampagnen-Hero",
  "Instagram Feed": "Instagram-Beitrag",
  "Instagram Story": "Instagram-Story",
  Pinterest: "Pinterest",
  "TikTok Cover": "TikTok-Titelbild",
  Lookbook: "Lookbook",
  "Website Banner": "Website-Banner",
  "Studio front — primary": "Studio frontal",
  "Studio front — alternate": "Studio frontal · Alternative",
  "Studio front — crop": "Studio · Ausschnitt",
  "E-commerce garment view": "Produktansicht",
};

export const OWNER_AUTHORITY_LABELS: Readonly<Record<string, string>> = {
  SHOPIFY_LIVE: "Shopify verifiziert",
  MANUAL_PROFILE: "Manuelles Produkt",
  SEED: "Beispieldaten",
  BRAIN: "NexHQ-Wissensstand",
  UNKNOWN: "Quelle nicht verifiziert",
};

export const OWNER_PRODUCT_PROFILE_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "Aktiv",
  SAMPLE: "Muster",
  UPCOMING: "Geplant",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

export const OWNER_PRODUCT_REFERENCE_ROLE_LABELS: Readonly<Record<string, string>> = {
  FEATURED: "Hauptbild",
  FRONT: "Vorderseite",
  BACK: "Rückseite",
  LEFT_SIDE: "Linke Seite",
  RIGHT_SIDE: "Rechte Seite",
  SIDE: "Seitenansicht",
  DETAIL: "Detail",
  MATERIAL: "Material",
  COLLAR: "Kragen",
  SLEEVE: "Ärmel",
  ZIPPER: "Reißverschluss",
  POCKET: "Tasche",
  WAISTBAND: "Bund",
  OTHER: "Sonstige",
  UNCLASSIFIED: "Nicht klassifiziert",
};

export const OWNER_ANALYSIS_LABELS: Readonly<Record<string, string>> = {
  Luxury: "Premium",
  Editorial: "Editorial",
  Streetwear: "Streetwear",
  Vintage: "Vintage",
  Technical: "Technisch",
  Minimal: "Minimal",
  Bold: "Kräftig",
  Industrial: "Industrial",
  Mixed: "Gemischt",
  Illustration: "Illustration",
  Badge: "Badge",
  Monogram: "Monogramm",
  Grunge: "Grunge",
  "Typography driven": "Typografiegeführt",
  Tight: "Eng",
  Normal: "Normal",
  Wide: "Weit",
  Unknown: "Unbekannt",
  Left: "Links",
  Center: "Mittig",
  Right: "Rechts",
  Light: "Leicht",
  Balanced: "Ausgewogen",
  Heavy: "Schwer",
  "Top-down": "Von oben",
  "Center-out": "Vom Zentrum",
  "Left-right": "Von links nach rechts",
  Radial: "Radial",
  Symmetric: "Symmetrisch",
  Asymmetric: "Asymmetrisch",
  Centered: "Zentriert",
  "Center chest": "Brustmitte",
  "Back panel": "Rücken",
  Sleeve: "Ärmel",
  "Oversized front": "Übergröße vorne",
  Pocket: "Tasche",
  "Full back": "Ganzer Rücken",
  Low: "Niedrig",
  Medium: "Mittel",
  High: "Hoch",
  Premium: "Premium",
  primary: "Primär",
  secondary: "Sekundär",
  accent: "Akzent",
  neutral: "Neutral",
  background: "Hintergrund",
  headline: "Headline",
  subheadline: "Unterzeile",
  supporting: "Begleittext",
  unknown: "Unbekannt",
};

export function ownerStatusLabel(value: string | null | undefined): string {
  if (!value) return "Status unbekannt";
  return OWNER_STATUS_LABELS[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("de-DE");
}

export function ownerAuthorityLabel(value: string | null | undefined): string {
  if (!value) return OWNER_AUTHORITY_LABELS.UNKNOWN;
  return OWNER_AUTHORITY_LABELS[value] ?? OWNER_AUTHORITY_LABELS.UNKNOWN;
}

export function ownerShotLabel(value: string | null | undefined): string {
  if (!value) return "Keine Aufnahme ausgewählt";
  return OWNER_SHOT_LABELS[value] ?? value;
}

export function ownerProductProfileStatusLabel(value: string | null | undefined): string {
  if (!value) return "Status unbekannt";
  return OWNER_PRODUCT_PROFILE_STATUS_LABELS[value] ?? ownerStatusLabel(value);
}

export function ownerProductReferenceRoleLabel(value: string | null | undefined): string {
  if (!value) return OWNER_PRODUCT_REFERENCE_ROLE_LABELS.UNCLASSIFIED;
  return OWNER_PRODUCT_REFERENCE_ROLE_LABELS[value] ?? OWNER_PRODUCT_REFERENCE_ROLE_LABELS.UNCLASSIFIED;
}

export function ownerProductStatusLabel(value: string | null | undefined): string {
  if (!value) return "Status unbekannt";
  return ownerStatusLabel(value);
}

export function ownerAnalysisLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return OWNER_ANALYSIS_LABELS[value] ?? value;
}

export const IMAGE_PRODUCTION_STEPS = [
  "Artwork",
  "Produkt",
  "Variante",
  "Markenmodel",
  "Platzierung",
  "Aufnahme",
  "Prüfen",
  "Generieren",
  "Ergebnis",
] as const;

export const PERSONA_PROGRESS_STEPS = [
  "Entdeckung",
  "Auswahl",
  "Referenzpaket",
  "Identitätsprüfung",
  "Referenzrechte",
  "Image-Freigabe",
  "Brand Cast",
] as const;
