export const FACILITY_QUOTA_DEGRADED_HEADER = "X-Facility-Quota-Degraded";

export function isQuotaDegradedResponse(response: Response): boolean {
  return response.headers.get(FACILITY_QUOTA_DEGRADED_HEADER) === "true";
}
