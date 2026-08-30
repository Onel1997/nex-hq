import { redirect } from "next/navigation";

/** Retired Owner surface. Backend orchestration remains available to active dependants. */
export default function RetiredCeoAgentPage() {
  redirect("/hq/customers");
}
