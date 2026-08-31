const OWNER_PRODUCT_ROUTE_ROOTS = [
  "/hq/home",
  "/hq/design-studio",
  "/hq/creative-studio",
  "/hq/ugc-video-studio",
  "/hq/library",
  "/hq/credits",
] as const;

export function isXeriamoOwnerProductRoute(pathname: string) {
  return OWNER_PRODUCT_ROUTE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
