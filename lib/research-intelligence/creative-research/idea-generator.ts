/**
 * Deterministic creative idea generator — diverse structures, garment-ready phrases.
 * Source is always exposed as deterministic_fallback unless an LLM path is wired later.
 */

import { MILAENE_BRAND_PROFILE } from "../confidence/brand-profile";
import { evaluateRunDiversity, planVisualDiversity } from "./diversity-planner";
import {
  isExcludedByHistory,
  recentPhrases,
  recordCreativeRunIdeas,
} from "./history-store";
import { evaluatePhraseQuality } from "./phrase-quality";
import { filterQualityDesignIdeas } from "./quality-layer";
import type {
  DesignIdea,
  ExecutionDifficulty,
  FrontBackConfiguration,
  GeneratorSource,
  OptionalPatternEvidence,
  TypographyFamily,
  VisualStructureId,
  WeeklyDesignIdeasInput,
} from "./types";
import { DRAFT_SELECTION_NEXT_STEP, NO_PATTERN_EVIDENCE_NOTE } from "./types";

interface IdeaSeed {
  designTitle: string;
  primaryPhrase: string;
  alternativePhrases: [string, string, string];
  meaning: string;
  wearReason: string;
  emotionalDirection: string;
  emotionalTheme: string;
  designConcept: string;
  typographyDirection: string;
  typographyFamily: TypographyFamily;
  graphicElements: string[];
  placement: string;
  visualStructure: VisualStructureId;
  printTechniqueSuggestion: string;
  artworkColors: string[];
  recommendedGarmentColors: string[];
  recommendedProductType: string;
  frontBackConfiguration: FrontBackConfiguration;
  originalityNotes: string;
  brandFitScore: number;
  commercialClarityScore: number;
  executionDifficulty: ExecutionDifficulty;
  whyItFitsMilaene: string;
  themes: string[];
}

const IDEA_SEEDS: IdeaSeed[] = [
  {
    designTitle: "Private Circuit",
    primaryPhrase: "No audience required.",
    alternativePhrases: [
      "Close the circuit.",
      "This room has no stage.",
      "Perform nowhere.",
    ],
    meaning:
      "Selbstgenügsamkeit ohne Pose — Identität, die keine Bühne braucht, um gültig zu sein.",
    wearReason:
      "Für Tage, an denen man präsent sein will, ohne etwas beweisen zu müssen.",
    emotionalDirection: "Ruhige Selbstsicherheit ohne Show",
    emotionalTheme: "anti-performance",
    designConcept:
      "Hierarchie: Einzige Fokuszone Center Chest (ca. 9×7 cm). Hauptelement: zweizeilige Phrase in ruhiger Sans, darunter ein gestrichelter Kreis (Ø ~5 cm) als geschlossener Kreislauf. Maßstab klein und lesbar aus Armlänge. Beziehung Text↔Grafik: Kreis rahmt die Idee, nicht das Wort. Leer lassen: gesamte restliche Front, kompletter Rücken, Ärmel. Nicht hinzufügen: Icons, Gradienten, zweite Phrase, Outline-Stroke am Kreis. Passt zum Spruch, weil der geschlossene Kreis die ‚kein Publikum‘-These visuell abschließt.",
    typographyDirection: "Zweizeilige ruhige Sans, mittleres Tracking, keine Caps-Schreie",
    typographyFamily: "sans",
    graphicElements: ["gestrichelter Kreis", "zweizeilige Phrase"],
    placement: "Center chest, kompakt",
    visualStructure: "chest_only_minimal",
    printTechniqueSuggestion: "Screen Print einfarbig",
    artworkColors: ["Off-White"],
    recommendedGarmentColors: ["Black", "Charcoal"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "front",
    originalityNotes: "Anti-Audience Haltung als System, nicht als Aggression",
    brandFitScore: 88,
    commercialClarityScore: 85,
    executionDifficulty: "low",
    whyItFitsMilaene: "Quiet confidence, emblem-light, premium restraint",
    themes: ["audience", "circuit", "self"],
  },
  {
    designTitle: "Measured Pace",
    primaryPhrase: "Walk slower than the room.",
    alternativePhrases: [
      "Leave speed to the crowd.",
      "Choose the longer route.",
      "Arrive without rushing.",
    ],
    meaning:
      "Tempo als bewusste Entscheidung — Langsamkeit als Kontrolle in einem schnellen Umfeld.",
    wearReason:
      "Weil der Spruch eine Haltung gibt, die im Alltag sichtbar wird, ohne laut zu sein.",
    emotionalDirection: "Urbane Gelassenheit, bewusste Verlangsamung",
    emotionalTheme: "tempo-control",
    designConcept:
      "Hierarchie: Linke Brust Phrase (Micro, ~2.5 cm Zeilenhöhe), rechts daneben drei kurze Horizontalstriche mit steigendem Abstand (Rhythmus-Metronom). Maßstab: gesamtes Paar max. 12 cm breit. Beziehung: Striche übersetzen ‚slower‘ in Zeitintervall. Leer: Mitte, Saum, Rücken. Nicht hinzufügen: Stoppuhr-Icons, Straßenmotive, Back-Print. Die Komposition passt, weil Rhythmus statt Motivationssymbol die Phrase trägt.",
    typographyDirection: "Micro Sans, links bündig, kein Display-Gewicht",
    typographyFamily: "sans",
    graphicElements: ["Rhythmus-Striche", "Micro Phrase"],
    placement: "Linke und rechte Brust als Paar",
    visualStructure: "asymmetric_placement",
    printTechniqueSuggestion: "Feiner Screen Print oder Stickerei",
    artworkColors: ["Bone"],
    recommendedGarmentColors: ["Black", "Washed Black", "Stone"],
    recommendedProductType: "Longsleeve",
    frontBackConfiguration: "front",
    originalityNotes: "Tempo als grafischer Rhythmus",
    brandFitScore: 84,
    commercialClarityScore: 83,
    executionDifficulty: "low",
    whyItFitsMilaene: "Understated, wearable, anti-noise",
    themes: ["pace", "walk", "rhythm"],
  },
  {
    designTitle: "Stone Index",
    primaryPhrase: "Remember what the stone kept.",
    alternativePhrases: [
      "Memory without ornament.",
      "What remains after the noise.",
      "Keep the weight, lose the spectacle.",
    ],
    meaning:
      "Erinnerung als Materie — beständig, unsentimental, ohne Dekor.",
    wearReason:
      "Für Menschen, die Beständigkeit tragen wollen, nicht Nostalgie-Kitsch.",
    emotionalDirection: "Erhabene Ruhe, materielle Beständigkeit",
    emotionalTheme: "material-memory",
    designConcept:
      "Hierarchie: Rücken als Hauptfläche. Hauptelement: reduzierter Platten-/Stein-Umriss (ca. 18 cm hoch), Phrase in Serif darüber in einer Zeile. Maßstab großzügig, Linienstärke dünn (0.5–0.8 pt optisch). Front optional nur 8 mm Mark rechts. Leer: Front bis auf Micro-Mark, Ärmel, untere 30 % des Rückens. Nicht: Grabstein-Details, Texturen, Schattenfüllung. Passt, weil Stein-Umriss die Phrase wörtlich ‚aufbewahrt‘.",
    typographyDirection: "Steinige Editorial-Serif, großzügig gesetzt",
    typographyFamily: "serif",
    graphicElements: ["Platten-Umriss", "Serif Typo"],
    placement: "Rücken groß · optional Micro-Mark vorne",
    visualStructure: "large_back_graphic",
    printTechniqueSuggestion: "Matte Screen Print",
    artworkColors: ["Limestone", "Soft Black"],
    recommendedGarmentColors: ["Stone", "Sand", "Black"],
    recommendedProductType: "Heavyweight Hoodie",
    frontBackConfiguration: "back",
    originalityNotes: "Materielle Metapher ohne Grabstein-Klischee",
    brandFitScore: 86,
    commercialClarityScore: 78,
    executionDifficulty: "medium",
    whyItFitsMilaene: "Earth tones, heritage craft, quiet symbolism",
    themes: ["stone", "memory", "earth"],
  },
  {
    designTitle: "Archive Margin",
    primaryPhrase: "Written in the margin, not the headline.",
    alternativePhrases: [
      "Leave the center empty.",
      "Notes over announcements.",
      "The side column tells the truth.",
    ],
    meaning:
      "Wichtigkeit sitzt nicht im Zentrum der Aufmerksamkeit — Randnotizen tragen die eigentliche Haltung.",
    wearReason:
      "Weil es intelligent wirkt und dennoch alltagstauglich bleibt — wie ein privates Manuskript.",
    emotionalDirection: "Intellektuelle Zurückhaltung, editoriale Klarheit",
    emotionalTheme: "margin-note",
    designConcept:
      "Hierarchie: Vertikale Phrase entlang der linken Front, 4 cm vom Seitennaht, von Brustmitte nach unten (~16 cm). Hauptelement: reine Typografie + ein dünner Marginalstrich (1 pt) parallel zur Text. Kein Rücken. Maßstab schmal. Leer: Center Chest, Schultern, Rücken. Nicht: Stempel, Nummernblöcke, ‚ARCHIVE‘-Wortmarken. Passt, weil die Platzierung selbst die ‚Margin‘-These ist.",
    typographyDirection: "Vertikale Mono/Sans, enger Satz, kleine Kegel",
    typographyFamily: "mono",
    graphicElements: ["Marginalstrich", "vertikale Typo"],
    placement: "Linke Front vertikal, nahtnah",
    visualStructure: "vertical_typography",
    printTechniqueSuggestion: "Discharge oder Soft-Hand Print",
    artworkColors: ["Warm White"],
    recommendedGarmentColors: ["Ink Navy", "Black", "Espresso"],
    recommendedProductType: "Crewneck",
    frontBackConfiguration: "front",
    originalityNotes: "Platzierung = Konzept",
    brandFitScore: 87,
    commercialClarityScore: 80,
    executionDifficulty: "medium",
    whyItFitsMilaene: "Editorial archive language without catalog recreation",
    themes: ["archive", "margin", "editorial"],
  },
  {
    designTitle: "Blueprint Quiet",
    primaryPhrase: "Draft the day before you announce it.",
    alternativePhrases: [
      "Plan in pencil.",
      "Build privately first.",
      "Public comes later.",
    ],
    meaning:
      "Vorbereitung vor Darstellung — Arbeit im Entwurf, nicht in der Ankündigung.",
    wearReason:
      "Spricht Menschen an, die Prozess und Handwerk höher werten als Launch-Theater.",
    emotionalDirection: "Disziplinierte Ruhe, handwerkliche Klarheit",
    emotionalTheme: "draft-first",
    designConcept:
      "Hierarchie: Center-Front technisches Diagramm (ca. 11 cm): drei Bemaßungslinien + kleiner Winkel, Phrase darunter in Micro Caps. Maßstab wie eine Bauzeichnung, keine Illustration. Leer: Rücken, Ärmel, untere Front. Nicht: Logos, QR, echte Architekturfotos. Beziehung: Diagramm visualisiert ‚draft‘; Phrase bleibt Instruktion. Passt, weil technische Sprache den Inhalt trägt ohne Motivationspathos.",
    typographyDirection: "Micro Caps + technische Annotation",
    typographyFamily: "mono",
    graphicElements: ["Bemaßungslinien", "Winkelmarke", "Micro Caps"],
    placement: "Center chest als Diagrammblock",
    visualStructure: "technical_diagram",
    printTechniqueSuggestion: "Feiner einlagiger Screen Print",
    artworkColors: ["Blueprint Grey", "Bone"],
    recommendedGarmentColors: ["Fog Grey", "Black"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "front",
    originalityNotes: "Technische Zeichensprache statt Emblem",
    brandFitScore: 85,
    commercialClarityScore: 81,
    executionDifficulty: "medium",
    whyItFitsMilaene: "Craft, precision, quiet luxury without noise",
    themes: ["draft", "blueprint", "process"],
  },
  {
    designTitle: "Sleeve Note",
    primaryPhrase: "Keep one sentence for yourself.",
    alternativePhrases: [
      "Not everything needs a front.",
      "Private text travels farther.",
      "A quiet line on the sleeve.",
    ],
    meaning:
      "Manche Wahrheiten gehören nicht auf die Brust — sie wandern nah am Körper.",
    wearReason:
      "Weil der Ärmel-Print intim wirkt und im Gespräch entdeckt wird, nicht geschrien.",
    emotionalDirection: "Intimität, diskrete Präsenz",
    emotionalTheme: "private-line",
    designConcept:
      "Hierarchie: Einzige Markierung auf dem linken Ärmel, 6–8 cm unter der Schulternaht, Phrase parallel zum Ärmelverlauf (max. 9 cm Länge). Handschriftliche/annotierte Sans, dünn. Front und Rücken komplett leer. Nicht: zweite Sleeve-Linie, Chest-Print, Icons. Leerbleiben ist Teil des Konzepts. Passt, weil ‚für dich behalten‘ durch unsichtbare Front bestätigt wird.",
    typographyDirection: "Handnahe Annotation, klein, unregelmäßig leicht",
    typographyFamily: "script",
    graphicElements: ["Sleeve-Typo", "Annotation"],
    placement: "Linker Ärmel, unter Schulternaht",
    visualStructure: "sleeve_detail",
    printTechniqueSuggestion: "Stickerei oder feiner Print",
    artworkColors: ["Bone"],
    recommendedGarmentColors: ["Charcoal", "Espresso"],
    recommendedProductType: "Heavyweight Hoodie",
    frontBackConfiguration: "front",
    originalityNotes: "Ärmel als private Schreibfläche",
    brandFitScore: 83,
    commercialClarityScore: 79,
    executionDifficulty: "medium",
    whyItFitsMilaene: "Discrete luxury placement, anti-spectacle",
    themes: ["sleeve", "private", "sentence"],
  },
  {
    designTitle: "Seal of Restraint",
    primaryPhrase: "Fewer marks. Cleaner intent.",
    alternativePhrases: [
      "Reduce until it holds.",
      "One seal is enough.",
      "Clarity over decoration.",
    ],
    meaning:
      "Reduktion als Qualitätsversprechen — weniger Zeichen, klarere Absicht.",
    wearReason:
      "Für Käufer, die Premium über Zurückhaltung erkennen, nicht über Printfläche.",
    emotionalDirection: "Präzise Zurückhaltung",
    emotionalTheme: "restraint-seal",
    designConcept:
      "Hierarchie: Links Brust ein kleines Siegel/Badge (Ø 2.8 cm) mit Inneninitiale ‚M‘-freier Geometrie (zwei konzentrische Bögen), Phrase rechts daneben in Micro Caps (max. 4 cm). Kein Rücken. Leer: alles außer dieser 8 cm Zone. Nicht: florale Wappen, Kronen, fremde Markensiegel. Passt, weil das Siegel die ‚fewer marks‘-These wörtlich einlöst.",
    typographyDirection: "Micro Caps neben Siegel, nie größer als das Badge",
    typographyFamily: "sans",
    graphicElements: ["konzentrische Bögen", "Micro Caps Siegelzone"],
    placement: "Links Brust Badge + Text",
    visualStructure: "badge_or_seal",
    printTechniqueSuggestion: "Stickerei bevorzugt",
    artworkColors: ["Bone", "Soft Graphite"],
    recommendedGarmentColors: ["Black", "Olive Soft"],
    recommendedProductType: "Crewneck",
    frontBackConfiguration: "front",
    originalityNotes: "Siegel ohne Heraldik-Klischee",
    brandFitScore: 89,
    commercialClarityScore: 84,
    executionDifficulty: "low",
    whyItFitsMilaene: "Minimal emblem language, premium craft",
    themes: ["seal", "restraint", "clarity"],
  },
  {
    designTitle: "Halftone Distance",
    primaryPhrase: "Seen from far, held from near.",
    alternativePhrases: [
      "Distance keeps the shape honest.",
      "Close enough to feel, far enough to stay.",
      "Soft focus, hard boundary.",
    ],
    meaning:
      "Nähe und Distanz gleichzeitig — Präsenz ohne Übergriffigkeit.",
    wearReason:
      "Wirkt fotografisch und modern, bleibt aber in der Milaene-Ruhe.",
    emotionalDirection: "Kühle Nähe, kontrollierte Distanz",
    emotionalTheme: "near-far",
    designConcept:
      "Hierarchie: Rücken großes Halftone-/Punktkreis-Feld (Ø ~20 cm), Phrase in Sans darunter zentriert. Front leer. Maßstab: Halftone als Atmosphäre, nicht als Porträt. Leer: Front, Ärmel, untere 20 % Rücken. Nicht: Gesichter, Logos, Vollflächen-Foto. Beziehung: Halftone = ‚from far‘, scharfe Phrase = ‚from near‘. Passt als visuelle Übersetzung der Doppelthese.",
    typographyDirection: "Ruhige Sans unter dem Halftone, nicht darüberlegen",
    typographyFamily: "sans",
    graphicElements: ["Halftone-Kreis", "Rücken-Phrase"],
    placement: "Rücken zentriert, groß",
    visualStructure: "halftone_direction",
    printTechniqueSuggestion: "Halftone Screen Print",
    artworkColors: ["Soft Graphite", "Ivory"],
    recommendedGarmentColors: ["Black", "Washed Grey"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "back",
    originalityNotes: "Halftone als Distanzmetapher",
    brandFitScore: 82,
    commercialClarityScore: 77,
    executionDifficulty: "high",
    whyItFitsMilaene: "Photographic restraint without loud graphics",
    themes: ["distance", "halftone", "focus"],
  },
  {
    designTitle: "Geometry Cut",
    primaryPhrase: "Cut where the noise starts.",
    alternativePhrases: [
      "Leave the excess outside the frame.",
      "Edit the silhouette first.",
      "Sharp edge, quiet body.",
    ],
    meaning:
      "Präzision als ethische Geste — schneiden, wo Überfluss beginnt.",
    wearReason:
      "Klar, modern und ‚design-aware‘ — gut für Capsule-Looks.",
    emotionalDirection: "Kühle Präzision",
    emotionalTheme: "precision-cut",
    designConcept:
      "Hierarchie: Rechte Brust abstraktes L-/Winkel-Geometrie-Mark (2.2 cm), Phrase darunter Micro Caps. Kein Rücken. Maßstab winzig-präzise. Leer: 95 % der Fläche. Nicht: zusätzliche Formen, Farbflächen, Serif. Passt, weil der Schnitt als Geometrie den Spruch ‚cut‘ materialisiert.",
    typographyDirection: "Micro Caps, technisch-ruhig",
    typographyFamily: "sans",
    graphicElements: ["L-Mark Geometrie", "Micro Caps"],
    placement: "Rechte Brust, kompakt",
    visualStructure: "abstract_geometric",
    printTechniqueSuggestion: "Stickerei oder feiner Screen Print",
    artworkColors: ["Bone"],
    recommendedGarmentColors: ["Black", "Grey", "Cream"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "front",
    originalityNotes: "Geometrie statt Logo",
    brandFitScore: 87,
    commercialClarityScore: 84,
    executionDifficulty: "low",
    whyItFitsMilaene: "Minimal geometric language",
    themes: ["geometry", "cut", "noise"],
  },
  {
    designTitle: "Monument Line",
    primaryPhrase: "Unfinished still stands.",
    alternativePhrases: [
      "Structure before applause.",
      "Hold the line until it holds you.",
      "An incomplete form can be final.",
    ],
    meaning:
      "Unfertigkeit als Stärke — Konstruktion, die auch ohne Abschluss trägt.",
    wearReason:
      "Architektonische Aura ohne Kostüm — gut für ruhige Statement-Pieces.",
    emotionalDirection: "Ruhige Autorität",
    emotionalTheme: "unfinished-strength",
    designConcept:
      "Hierarchie: Front Micro-Phrase links Brust. Rücken: architektonische Linienzeichnung eines unfertigen Pfeilers/Monuments (Höhe ~22 cm), Phrase darunter größer. Beziehung Front/Back: Front = Hinweis, Back = Beweis. Leer: Seiten, Ärmel, untere Front. Nicht: fotorealistische Ruinen, Skyline-Klischees, dritte Textzeile. Passt, weil Unfertigkeit gezeichnet — nicht dramatisiert — wird.",
    typographyDirection: "Serif klein vorne, größere ruhige Serif hinten",
    typographyFamily: "serif",
    graphicElements: ["architektonische Linien", "unfertiger Pfeiler"],
    placement: "Links Brust klein · Rücken groß",
    visualStructure: "architectural_line_art",
    printTechniqueSuggestion: "Line art Screen Print",
    artworkColors: ["Bone", "Soft Graphite"],
    recommendedGarmentColors: ["Black", "Stone"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "front_and_back",
    originalityNotes: "Architektur ohne Motivationspfad",
    brandFitScore: 88,
    commercialClarityScore: 82,
    executionDifficulty: "medium",
    whyItFitsMilaene: "Quiet luxury architecture language",
    themes: ["monument", "unfinished", "structure"],
  },
  {
    designTitle: "Hand Note Night",
    primaryPhrase: "I filed the night under unfinished business.",
    alternativePhrases: [
      "Tonight stays in draft.",
      "No closing statement after midnight.",
      "Leave the night open.",
    ],
    meaning:
      "Nacht als offener Prozess — nicht romantisiert, sondern als Arbeit am Selbst.",
    wearReason:
      "Längerer Spruch wirkt literarisch und einzigartig auf Premium-Streetwear.",
    emotionalDirection: "Nächtliche Klarheit, leise Unruhe",
    emotionalTheme: "night-draft",
    designConcept:
      "Hierarchie: Center Chest handschriftliche Annotation (2–3 Zeilen, max. 10 cm breit), daneben ein kleines Kreuz/Checkbox-Häkchen wie in einem Notizbuch. Kein Rücken. Leer: alles außer Annotation. Nicht: Monde, Sterne, Skyline. Passt, weil Handschrift ‚filed/unfinished‘ wie eine echte Randnotiz liest.",
    typographyDirection: "Handwritten annotation, unregelmäßig, lesbar",
    typographyFamily: "script",
    graphicElements: ["Handnotiz", "Checkbox-Mark"],
    placement: "Center chest Annotation",
    visualStructure: "handwritten_annotation",
    printTechniqueSuggestion: "Wasserbasierter Print",
    artworkColors: ["Warm White"],
    recommendedGarmentColors: ["Black", "Ink Navy"],
    recommendedProductType: "Longsleeve",
    frontBackConfiguration: "front",
    originalityNotes: "Nacht ohne Klischee-Ikonografie",
    brandFitScore: 84,
    commercialClarityScore: 76,
    executionDifficulty: "medium",
    whyItFitsMilaene: "Editorial night mood without costume",
    themes: ["night", "draft", "note"],
  },
  {
    designTitle: "Emblem of Quiet",
    primaryPhrase: "Carry less. Mean more.",
    alternativePhrases: [
      "One symbol. Full weight.",
      "Travel light, speak clearly.",
      "Reduce the load, keep the meaning.",
    ],
    meaning:
      "Weniger mitführen, mehr bedeuten — Reduktion als Ausdruckskraft.",
    wearReason:
      "Kurzer, tragbarer Satz mit starkem Emblem — Capsule-tauglich.",
    emotionalDirection: "Konzentrierte Ruhe",
    emotionalTheme: "carry-less",
    designConcept:
      "Hierarchie: Symbolisches Emblem Center Chest (5 cm): zwei versetzte Bögen + Punkt — kein Buchstabe. Phrase darunter in einer Zeile Sans. Maßstab mittel, klar. Leer: Rücken, Ärmel. Nicht: Text im Emblem, Schatten, Metallic. Beziehung: Emblem = ‚carry less‘, Phrase = Imperativ. Passt als symbolische Verdichtung.",
    typographyDirection: "Sans unter Emblem, nie im Emblem",
    typographyFamily: "sans",
    graphicElements: ["Bogen-Emblem", "Punkt-Akzent"],
    placement: "Center chest Emblem + Phrase",
    visualStructure: "symbolic_emblem",
    printTechniqueSuggestion: "Screen Print oder Stickerei",
    artworkColors: ["Ivory"],
    recommendedGarmentColors: ["Black", "Cream"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "front",
    originalityNotes: "Eigenes Emblem, keine Katalogkopie",
    brandFitScore: 90,
    commercialClarityScore: 86,
    executionDifficulty: "low",
    whyItFitsMilaene: "Symbolic minimalism on-brand",
    themes: ["emblem", "reduce", "meaning"],
  },
  {
    designTitle: "Typography Alone",
    primaryPhrase: "Let the sentence do the work.",
    alternativePhrases: [
      "No drawing required.",
      "Type is the graphic.",
      "Trust the line of words.",
    ],
    meaning:
      "Typografie als alleiniges Gestaltungsmittel — Vertrauen in Sprache statt Illustration.",
    wearReason:
      "Maximal klar und luxuriös-reduziert — ideal für Typografie-Fans.",
    emotionalDirection: "Editorial Confidence",
    emotionalTheme: "type-only",
    designConcept:
      "Hierarchie: Nur Typografie, Center Chest, eine Zeile, ca. 14 cm breit, mittlere Kegelgröße. Kein Strich, kein Icon, kein Rücken. Negativraum ist das zweite Element. Leer: alles außer der Zeile. Nicht: Unterstreichung, Box, zweite Zeile, Drop Shadow. Passt, weil der Spruch selbst die Designregel ist.",
    typographyDirection: "Editorial Sans oder Serif — eine Familie, ein Schnitt",
    typographyFamily: "mixed",
    graphicElements: ["reine Typografie"],
    placement: "Center chest, eine Zeile",
    visualStructure: "typography_only",
    printTechniqueSuggestion: "Soft-Hand Screen Print",
    artworkColors: ["Off-White"],
    recommendedGarmentColors: ["Black", "Stone"],
    recommendedProductType: "Oversized T-Shirt",
    frontBackConfiguration: "front",
    originalityNotes: "Strikt typography-only",
    brandFitScore: 91,
    commercialClarityScore: 88,
    executionDifficulty: "low",
    whyItFitsMilaene: "Editorial type-first luxury",
    themes: ["typography", "sentence", "work"],
  },
  {
    designTitle: "Front Back Chapter",
    primaryPhrase: "Start quiet. Finish clearer.",
    alternativePhrases: [
      "Begin with almost nothing.",
      "End with one true line.",
      "Chapter one is smaller than chapter two.",
    ],
    meaning:
      "Erzählung über zwei Seiten des Garments — Einstieg leise, Abschluss klarer.",
    wearReason:
      "Front/Back-Narrativ macht das Stück sammelwürdig und campaignfähig.",
    emotionalDirection: "Narrative Klarheit",
    emotionalTheme: "chapter-arc",
    designConcept:
      "Hierarchie: Front nur ‚Start quiet.‘ in Micro Caps links (Kapitel 1). Rücken volle Phrase größer zentriert (Kapitel 2) ohne Grafik. Beziehung: Front = Auftakt, Back = Auflösung. Leer: Ärmel, untere Flächen. Nicht: Illustrationen, Seitenzahlen als Dekor-Overload (max. eine dezente ‚01/02‘ Micro-Marke optional vorne). Passt als literarisches Front/Back-System.",
    typographyDirection: "Micro Caps vorne, Display-Sans hinten",
    typographyFamily: "sans",
    graphicElements: ["Front Micro", "Back Display Phrase"],
    placement: "Links Brust Micro · Rücken Phrase groß",
    visualStructure: "front_back_narrative",
    printTechniqueSuggestion: "Screen Print zweifach gleichfarbig",
    artworkColors: ["Bone"],
    recommendedGarmentColors: ["Black", "Charcoal"],
    recommendedProductType: "Heavyweight Hoodie",
    frontBackConfiguration: "front_and_back",
    originalityNotes: "Narrativ über Platzierung",
    brandFitScore: 85,
    commercialClarityScore: 83,
    executionDifficulty: "low",
    whyItFitsMilaene: "Storytelling without loud graphics",
    themes: ["chapter", "quiet", "clear"],
  },
  {
    designTitle: "Editorial File",
    primaryPhrase: "Keep the proof off the cover.",
    alternativePhrases: [
      "Evidence lives inside.",
      "Cover stays calm.",
      "File the loud parts away.",
    ],
    meaning:
      "Äußere Ruhe, innere Belege — wie ein Editorial-Cover ohne Spoiler.",
    wearReason:
      "Archive-/Editorial-Feeling ohne Produktkopie — stark für Quiet Luxury.",
    emotionalDirection: "Kuratierte Distanz",
    emotionalTheme: "editorial-file",
    designConcept:
      "Hierarchie: Links Brust Archivrahmen 3×2.2 cm mit Micro-Phrase innen. Optional Rücken nur eine dünne Indexziffer (nicht groß-display). Leer: Center, Ärmel. Nicht: echte Katalogtitel, Barcodes, bestehende Produktnamen. Passt als Editorial-File-Metaphorik.",
    typographyDirection: "Micro Mono im Rahmen",
    typographyFamily: "mono",
    graphicElements: ["Archivrahmen", "Micro Phrase"],
    placement: "Links Brust Stempelrahmen",
    visualStructure: "editorial_archive",
    printTechniqueSuggestion: "Screen Print ein Farbton",
    artworkColors: ["Warm White", "Graphite"],
    recommendedGarmentColors: ["Black", "Ink Navy"],
    recommendedProductType: "Crewneck",
    frontBackConfiguration: "front",
    originalityNotes: "Archive ohne Katalogreplik",
    brandFitScore: 86,
    commercialClarityScore: 80,
    executionDifficulty: "low",
    whyItFitsMilaene: "Archive signals without product recreation",
    themes: ["editorial", "file", "proof"],
  },
];

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function toDesignIdea(
  seed: IdeaSeed,
  createdAt: string,
  index: number,
  patternEvidence: OptionalPatternEvidence | null,
  overrides?: Partial<
    Pick<
      DesignIdea,
      | "recommendedProductType"
      | "frontBackConfiguration"
      | "visualStructure"
      | "typographyFamily"
    >
  >,
): DesignIdea {
  const primaryPhrase = seed.primaryPhrase;
  const phraseQuality = evaluatePhraseQuality(primaryPhrase, {
    meaning: seed.meaning,
    recentPhrases: recentPhrases(),
    alternatives: seed.alternativePhrases,
  });

  return {
    id: `idea-${createdAt.slice(0, 10)}-${index + 1}-${hashSeed(primaryPhrase).toString(36)}`,
    designTitle: seed.designTitle,
    primaryPhrase,
    alternativePhrases: [...seed.alternativePhrases],
    meaning: seed.meaning,
    wearReason: seed.wearReason,
    emotionalDirection: seed.emotionalDirection,
    emotionalTheme: seed.emotionalTheme,
    designConcept: seed.designConcept,
    typographyDirection: seed.typographyDirection,
    typographyFamily: overrides?.typographyFamily ?? seed.typographyFamily,
    graphicElements: [...seed.graphicElements],
    placement: seed.placement,
    visualStructure: overrides?.visualStructure ?? seed.visualStructure,
    printTechniqueSuggestion: seed.printTechniqueSuggestion,
    artworkColors: [...seed.artworkColors],
    recommendedGarmentColors: [...seed.recommendedGarmentColors],
    recommendedProductType:
      overrides?.recommendedProductType ?? seed.recommendedProductType,
    frontBackConfiguration:
      overrides?.frontBackConfiguration ?? seed.frontBackConfiguration,
    originalityNotes: seed.originalityNotes,
    brandFitScore: seed.brandFitScore,
    commercialClarityScore: seed.commercialClarityScore,
    executionDifficulty: seed.executionDifficulty,
    whyItFitsMilaene: seed.whyItFitsMilaene,
    phraseQuality,
    optionalPatternEvidence: patternEvidence,
    status: "draft",
    createdAt,
  };
}

export function emptyPatternEvidence(): OptionalPatternEvidence {
  return {
    available: false,
    notes: [],
    honestyNote: NO_PATTERN_EVIDENCE_NOTE,
  };
}

export function buildPatternEvidenceFromTraits(traits: {
  colorWorld?: string[];
  placements?: string[];
  printTechniques?: string[];
  materials?: string[];
  visualStructures?: string[];
  historicalNotes?: string[];
}): OptionalPatternEvidence {
  const hasReal =
    (traits.colorWorld?.length ?? 0) +
      (traits.placements?.length ?? 0) +
      (traits.printTechniques?.length ?? 0) +
      (traits.materials?.length ?? 0) +
      (traits.visualStructures?.length ?? 0) +
      (traits.historicalNotes?.length ?? 0) >
    0;

  if (!hasReal) return emptyPatternEvidence();

  return {
    available: true,
    notes: [
      "Pattern Evidence stammt aus vorhandenen Shopify-/Design-Signalen und ersetzt nicht die kreative Idee.",
    ],
    colorWorld: traits.colorWorld?.slice(0, 4),
    placements: traits.placements?.slice(0, 4),
    printTechniques: traits.printTechniques?.slice(0, 3),
    materialPreferences: traits.materials?.slice(0, 3),
    visualStructures: traits.visualStructures?.slice(0, 4),
    historicalShopifyPatterns: traits.historicalNotes?.slice(0, 3),
  };
}

export function generateWeeklyDesignIdeas(
  input: WeeklyDesignIdeasInput = {},
  options: {
    createdAt?: string;
    patternEvidence?: OptionalPatternEvidence | null;
    recordHistory?: boolean;
  } = {},
): { ideas: DesignIdea[]; diversityScore: number; generatorSource: GeneratorSource } {
  const count = Math.max(1, Math.min(input.count ?? 4, 12));
  const createdAt = options.createdAt ?? new Date().toISOString();
  const patternEvidence = options.patternEvidence ?? emptyPatternEvidence();
  const rotation = hashSeed(
    [input.theme, input.style, input.productType, input.freeformDescription, createdAt.slice(0, 13)]
      .filter(Boolean)
      .join("|"),
  );

  const plan = planVisualDiversity(count, rotation);
  const historyPhrases = recentPhrases();

  const rankedSeeds = [...IDEA_SEEDS]
    .map((seed, index) => ({
      seed,
      score:
        seed.brandFitScore +
        ((index + rotation) % 11) -
        (historyPhrases.some((phrase) =>
          phrase.toLowerCase() === seed.primaryPhrase.toLowerCase(),
        )
          ? 40
          : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const usedStructures = new Set<VisualStructureId>();
  const usedThemes = new Set<string>();
  const candidates: DesignIdea[] = [];

  for (const slot of plan) {
    const match = rankedSeeds.find(({ seed }) => {
      if (usedStructures.has(seed.visualStructure) && seed.visualStructure !== slot.visualStructure) {
        // prefer exact structure match
      }
      const structureOk =
        seed.visualStructure === slot.visualStructure ||
        (!usedStructures.has(seed.visualStructure) && usedStructures.size < count);
      if (!structureOk && seed.visualStructure !== slot.visualStructure) return false;
      if (usedThemes.has(seed.emotionalTheme)) return false;
      if (usedStructures.has(seed.visualStructure)) return false;
      const draft = toDesignIdea(seed, createdAt, candidates.length, patternEvidence);
      if (isExcludedByHistory(draft)) return false;
      if (!draft.phraseQuality.passed) return false;
      return true;
    });

    const fallback = rankedSeeds.find(({ seed }) => {
      if (usedStructures.has(seed.visualStructure)) return false;
      if (usedThemes.has(seed.emotionalTheme)) return false;
      const draft = toDesignIdea(seed, createdAt, candidates.length, patternEvidence);
      return draft.phraseQuality.passed && !isExcludedByHistory(draft);
    });

    const chosen = match ?? fallback;
    if (!chosen) continue;

    const idea = toDesignIdea(chosen.seed, createdAt, candidates.length, patternEvidence, {
      visualStructure: slot.visualStructure,
      typographyFamily: slot.typographyFamily,
      frontBackConfiguration: slot.frontBack,
      recommendedProductType: input.productType || slot.productHint || chosen.seed.recommendedProductType,
    });

    // Re-bind placement notes when forcing front-only
    if (slot.prefersNoBackPrint && idea.frontBackConfiguration === "front") {
      idea.placement = idea.placement.includes("Rücken")
        ? idea.placement.split("·")[0]?.trim() || "Center chest"
        : idea.placement;
    }

    usedStructures.add(idea.visualStructure);
    usedThemes.add(idea.emotionalTheme);
    candidates.push(idea);
  }

  // Fill remaining from unused high-quality seeds
  if (candidates.length < count) {
    for (const { seed } of rankedSeeds) {
      if (candidates.length >= count) break;
      if (usedStructures.has(seed.visualStructure)) continue;
      if (usedThemes.has(seed.emotionalTheme)) continue;
      const idea = toDesignIdea(seed, createdAt, candidates.length, patternEvidence);
      if (!idea.phraseQuality.passed || isExcludedByHistory(idea)) continue;
      usedStructures.add(idea.visualStructure);
      usedThemes.add(idea.emotionalTheme);
      candidates.push(idea);
    }
  }

  const filtered = filterQualityDesignIdeas(candidates, {
    ...input,
    recentPhrases: historyPhrases,
  }).slice(0, count);

  let diversity = evaluateRunDiversity(filtered);
  // If diversity fails, try one regeneration pass with alternate rotation
  if (!diversity.passed && filtered.length >= 2) {
    const altPlan = planVisualDiversity(count, rotation + 5);
    const regenerated: DesignIdea[] = [];
    const used = new Set<string>();
    for (let i = 0; i < altPlan.length; i += 1) {
      const slot = altPlan[i];
      const seed = IDEA_SEEDS.find(
        (item) =>
          item.visualStructure === slot.visualStructure &&
          !used.has(item.primaryPhrase) &&
          evaluatePhraseQuality(item.primaryPhrase, { meaning: item.meaning }).passed,
      );
      if (!seed) continue;
      used.add(seed.primaryPhrase);
      regenerated.push(
        toDesignIdea(seed, createdAt, regenerated.length, patternEvidence, {
          typographyFamily: slot.typographyFamily,
          frontBackConfiguration: slot.frontBack,
          recommendedProductType: slot.productHint,
        }),
      );
    }
    const altFiltered = filterQualityDesignIdeas(regenerated, {
      ...input,
      recentPhrases: historyPhrases,
    }).slice(0, count);
    const altDiversity = evaluateRunDiversity(altFiltered);
    if (altDiversity.score >= diversity.score) {
      diversity = altDiversity;
      filtered.splice(0, filtered.length, ...altFiltered);
    }
  }

  if (options.recordHistory !== false) {
    recordCreativeRunIdeas(filtered);
  }

  return {
    ideas: filtered,
    diversityScore: diversity.score,
    generatorSource: "deterministic_fallback",
  };
}

export function creativeDirectionSummaryFromIdeas(
  ideas: DesignIdea[],
  options: { selectedIdeaId?: string | null; generatorSource?: GeneratorSource } = {},
): string {
  if (ideas.length === 0) {
    return "Keine Designideen erzeugt. Eingaben prüfen oder Ausschlüsse lockern.";
  }

  const selected = options.selectedIdeaId
    ? ideas.find((idea) => idea.id === options.selectedIdeaId)
    : null;

  if (selected) {
    return (
      `Ausgewählte Richtung: „${selected.primaryPhrase}“ (${selected.designTitle}). ` +
      `Visual Structure: ${selected.visualStructure}. ` +
      `Generator: ${options.generatorSource ?? "deterministic_fallback"}.`
    );
  }

  const titles = ideas.map((idea) => idea.designTitle).join(", ");
  return (
    `${ideas.length} kreative Richtungen für ${MILAENE_BRAND_PROFILE.name}: ${titles}. ` +
    `Jede Idee hat einen eigenständigen Spruch, eine eigene Visual Structure und konkrete Umsetzungsangaben. ` +
    `Generator: ${options.generatorSource ?? "deterministic_fallback"} (kein Live-Intelligence-Claim). ` +
    DRAFT_SELECTION_NEXT_STEP
  );
}

export function draftNextStepForCount(count: number): string {
  if (count === 1) {
    return "Eine kreative Richtung wurde erstellt. Wähle die Idee aus, um sie für den Artwork-Upload im Design Studio vorzubereiten.";
  }
  return `${count} kreative Richtungen wurden erstellt. Wähle eine Idee aus, um sie für den Artwork-Upload im Design Studio vorzubereiten.`;
}

export function selectedNextStep(idea: DesignIdea): string {
  return (
    `Ausgewählt: „${idea.primaryPhrase}“ — ${idea.designTitle}. ` +
    `Der Nutzer erstellt das finale Artwork selbst. Öffne das Design Studio für den Upload und speichere diese Designidee als Referenz für die anschließende Artwork-Prüfung und Asset-Produktion.`
  );
}
