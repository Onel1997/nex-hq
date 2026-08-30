export type UgcPopoverPlacement = "above" | "below";

export type UgcPopoverRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function resolveUgcPopoverPosition(input: {
  anchor: UgcPopoverRect;
  popover: Pick<UgcPopoverRect, "width" | "height">;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  gap?: number;
}) {
  const margin = input.margin ?? 10;
  const gap = input.gap ?? 8;
  const below = Math.max(
    0,
    input.viewportHeight - input.anchor.bottom - margin - gap,
  );
  const above = Math.max(0, input.anchor.top - margin - gap);
  const placement: UgcPopoverPlacement =
    below < input.popover.height && above > below ? "above" : "below";
  const width = Math.min(
    input.popover.width,
    Math.max(0, input.viewportWidth - margin * 2),
  );
  const left = Math.min(
    Math.max(input.anchor.left, margin),
    Math.max(margin, input.viewportWidth - margin - width),
  );
  return {
    placement,
    xOffset: left - input.anchor.left,
    availableHeight: placement === "above" ? above : below,
  };
}
