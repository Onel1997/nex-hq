export type CreativePopoverPlacement = "above" | "below";

export type CreativePopoverRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export function resolveCreativePopoverPosition(input: {
  anchor: CreativePopoverRect;
  popover: Pick<CreativePopoverRect, "width" | "height">;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  gap?: number;
}) {
  const margin = input.margin ?? 10;
  const gap = input.gap ?? 8;
  const spaceBelow = Math.max(
    0,
    input.viewportHeight - input.anchor.bottom - margin - gap,
  );
  const spaceAbove = Math.max(0, input.anchor.top - margin - gap);
  const placement: CreativePopoverPlacement =
    spaceBelow < input.popover.height && spaceAbove > spaceBelow
      ? "above"
      : "below";

  const widestAllowed = Math.max(0, input.viewportWidth - margin * 2);
  const renderedWidth = Math.min(input.popover.width, widestAllowed);
  const preferredLeft = input.anchor.left;
  const maximumLeft = Math.max(margin, input.viewportWidth - margin - renderedWidth);
  const clampedLeft = Math.min(
    Math.max(preferredLeft, margin),
    maximumLeft,
  );

  return {
    placement,
    xOffset: clampedLeft - preferredLeft,
    availableHeight:
      placement === "above" ? spaceAbove : spaceBelow,
  };
}
