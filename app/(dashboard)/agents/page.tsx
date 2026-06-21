import { redirect } from "next/navigation";
import { FACILITY_ROUTES } from "@/lib/facility/facility-routes";

export default function AgentsRedirectPage() {
  redirect(FACILITY_ROUTES.agents);
}
