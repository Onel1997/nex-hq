export const NEXHQ_VERIFIED_USER_ID_HEADER = "x-nexhq-verified-user-id";
export const NEXHQ_VERIFIED_USER_EMAIL_HEADER = "x-nexhq-verified-user-email";

/** Remove caller-controlled values before middleware adds verified identity. */
export function clearVerifiedIdentityHeaders(headers: Headers): void {
  headers.delete(NEXHQ_VERIFIED_USER_ID_HEADER);
  headers.delete(NEXHQ_VERIFIED_USER_EMAIL_HEADER);
}
