import { redirect } from "next/navigation";
import { FACILITY_ROUTES } from "@/lib/facility/facility-routes";

export default function BrainRedirectPage() {
  redirect(FACILITY_ROUTES.knowledge);
}
