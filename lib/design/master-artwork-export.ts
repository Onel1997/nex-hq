import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  downloadPngFromSvg,
  downloadPngFromUrl,
  downloadSvgAsset,
  resolveMasterArtworkView,
  resolveTransparentExportUrl,
  type MasterArtworkState,
  type MasterArtworkViewModel,
} from "@/lib/design/master-artwork";

import {
  sanitizePrintArtworkSvg,
} from "@/lib/design/sanitize-print-artwork";

/** Artwork exports are always transparent — preview canvas and mockup backgrounds never apply. */
export interface MasterArtworkTransparentExports {
  pngUrl?: string;
  printUrl?: string;
  svgMarkup?: string;
}

export function resolveMasterArtworkTransparentExports(
  assets: DesignMissionAssets,
  view?: MasterArtworkViewModel,
): MasterArtworkTransparentExports {
  const resolved = view ?? resolveMasterArtworkView(assets);
  const state = resolved.state;
  const transparentUrl = resolveTransparentExportUrl(state);
  const svgMarkup =
    state.approvedSvgMarkup ?? resolved.previewSvgMarkup ?? assets.svgMarkup;

  return {
    pngUrl: transparentUrl,
    printUrl:
      state.transparentPngUrl ??
      state.productionPngUrl ??
      state.approvedProductionFileUrl ??
      transparentUrl,
    svgMarkup: svgMarkup?.trim()
      ? sanitizePrintArtworkSvg(svgMarkup).svg
      : undefined,
  };
}

export async function downloadMasterArtworkPng(
  _state: MasterArtworkState,
  assets: DesignMissionAssets,
  filename: string,
  view?: MasterArtworkViewModel,
): Promise<void> {
  const exports = resolveMasterArtworkTransparentExports(assets, view);
  if (exports.pngUrl) {
    await downloadPngFromUrl(exports.pngUrl, filename);
    return;
  }
  if (exports.svgMarkup) {
    await downloadPngFromSvg(exports.svgMarkup, filename);
  }
}

export async function downloadMasterArtworkPrintFile(
  _state: MasterArtworkState,
  assets: DesignMissionAssets,
  filename: string,
  view?: MasterArtworkViewModel,
): Promise<void> {
  const exports = resolveMasterArtworkTransparentExports(assets, view);
  if (exports.printUrl) {
    await downloadPngFromUrl(exports.printUrl, filename);
    return;
  }
  if (exports.svgMarkup) {
    await downloadPngFromSvg(exports.svgMarkup, filename);
  }
}

export async function downloadMasterArtworkSvg(
  assets: DesignMissionAssets,
  filename: string,
  view?: MasterArtworkViewModel,
): Promise<void> {
  const exports = resolveMasterArtworkTransparentExports(assets, view);
  if (!exports.svgMarkup) return;
  await downloadSvgAsset(exports.svgMarkup, filename);
}
