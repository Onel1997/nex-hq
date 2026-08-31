export const XERIAMO_BRANDING_ROLES = [
  "LOGO",
  "ICON",
  "FAVICON",
  "APPLE_TOUCH_ICON",
] as const;

export type XeriamoBrandingRole = (typeof XERIAMO_BRANDING_ROLES)[number];

export type XeriamoBrandingAsset = {
  id: string;
  role: XeriamoBrandingRole;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteLength: number;
  originalFilename: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  previewUrl: string;
};

export type XeriamoPublicBrandAsset = {
  role: XeriamoBrandingRole;
  url: string;
  version: string;
  mimeType: string;
  width: number | null;
  height: number | null;
};

export type XeriamoPublicBranding = Partial<
  Record<XeriamoBrandingRole, XeriamoPublicBrandAsset>
>;

export function isXeriamoBrandingRole(value: unknown): value is XeriamoBrandingRole {
  return typeof value === "string" && XERIAMO_BRANDING_ROLES.includes(value as XeriamoBrandingRole);
}

export function brandingRoleSlug(role: XeriamoBrandingRole) {
  return role.toLowerCase().replaceAll("_", "-");
}

export function brandingRoleFromSlug(value: string): XeriamoBrandingRole | null {
  const normalized = value.toUpperCase().replaceAll("-", "_");
  return isXeriamoBrandingRole(normalized) ? normalized : null;
}
