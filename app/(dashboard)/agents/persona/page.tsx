import { PersonaStudio } from "@/components/persona/persona-studio";
import type { Metadata } from "next";
import "@/app/persona-studio.css";

export const metadata: Metadata = {
  title: "Persona Studio",
  description: "Milaene Brand Cast — official persona management for NexHQ.",
};

export default function PersonaStudioPage() {
  return <PersonaStudio />;
}
