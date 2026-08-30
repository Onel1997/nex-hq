import { redirect } from "next/navigation";

/** Retired Owner surface. Research infrastructure remains available to active dependants. */
export default function RetiredResearchAgentPage() {
  redirect("/hq/customers");
}
