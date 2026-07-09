export {
  SVG_ASSETS_COMMENT,
  type SvgAssetDefinition,
  type SvgAssetFamily,
  type SvgAssetPack,
  type SvgAssetPlacement,
  type SvgAssetRenderContext,
  type SvgAssetSelectionInput,
} from "@/lib/design/svg-assets/types";

export {
  getSvgAsset,
  getSvgAssetRegistry,
  getSvgAssetsByFamily,
  getSvgAssetFamilyCount,
  SVG_ASSET_REGISTRY,
} from "@/lib/design/svg-assets/registry";

export { selectAssetsForComposition, selectAssetsFromPremiumContext } from "@/lib/design/svg-assets/select";

export {
  renderSvgAsset,
  renderSvgAssetPack,
  renderSvgAssetPlacement,
  type SvgAssetRenderInput,
} from "@/lib/design/svg-assets/render";

export { validateAssetPack, validateFullRegistry } from "@/lib/design/svg-assets/quality";
