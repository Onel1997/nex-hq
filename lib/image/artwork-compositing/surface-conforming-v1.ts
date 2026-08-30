import type {
  FabricAwareIntegrationSettings,
  SurfaceIntegrationEvidence,
  TypographyDeformationAnalysis,
} from "@/lib/image/artwork-compositing/types";
import { TYPOGRAPHY_DEFORMATION_METRIC_VERSION_V1 } from "@/lib/image/artwork-compositing/types";
import type { PixelRect } from "@/lib/image/artwork-compositing/fabric-aware-v1";

type SurfaceSettings = NonNullable<
  FabricAwareIntegrationSettings["surfaceConforming"]
>;

export type MeshNode = {
  displacementX: number;
  displacementY: number;
};

export type ArtworkSurfaceContentAnalysis = {
  boundsNormalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  cellCoverage: number[];
};

export type SurfaceConformingPlan = {
  rect: PixelRect;
  columns: number;
  rows: number;
  nodes: MeshNode[];
  evidence: SurfaceIntegrationEvidence;
};

export class SurfaceIntegrationUnsafeError extends Error {
  readonly code = "SURFACE_INTEGRATION_UNSAFE" as const;

  constructor(readonly evidence: SurfaceIntegrationEvidence) {
    super(
      "Die Shirt-Oberfläche konnte für eine sichere Druckintegration nicht zuverlässig ausgewertet werden.",
    );
    this.name = "SurfaceIntegrationUnsafeError";
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function luminanceAt(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
}): number {
  const x = clamp(Math.round(input.x), 0, input.width - 1);
  const y = clamp(Math.round(input.y), 0, input.height - 1);
  const offset = (y * input.width + x) * 4;
  return (
    input.pixels[offset]! * 0.2126 +
    input.pixels[offset + 1]! * 0.7152 +
    input.pixels[offset + 2]! * 0.0722
  );
}

function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[
    clamp(Math.round((ordered.length - 1) * fraction), 0, ordered.length - 1)
  ]!;
}

function rms(values: number[]): number {
  if (!values.length) return 0;
  return Math.sqrt(
    values.reduce((total, value) => total + value * value, 0) /
      values.length,
  );
}

/**
 * Alpha is used only to decide which mesh cells can affect visible Artwork.
 * Canonical pixels and transparent padding remain untouched in placement and
 * compositing; this analysis never crops or rewrites the source raster.
 */
export function analyzeArtworkSurfaceContent(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  columns: number;
  rows: number;
}): ArtworkSurfaceContentAnalysis {
  const cellColumns = input.columns - 1;
  const cellRows = input.rows - 1;
  const visible = new Uint32Array(cellColumns * cellRows);
  const total = new Uint32Array(cellColumns * cellRows);
  let minimumX = input.width;
  let minimumY = input.height;
  let maximumX = -1;
  let maximumY = -1;
  for (let y = 0; y < input.height; y += 1) {
    const row = Math.min(
      cellRows - 1,
      Math.floor((y / input.height) * cellRows),
    );
    for (let x = 0; x < input.width; x += 1) {
      const column = Math.min(
        cellColumns - 1,
        Math.floor((x / input.width) * cellColumns),
      );
      const cell = row * cellColumns + column;
      total[cell] += 1;
      if (input.pixels[(y * input.width + x) * 4 + 3]! < 8) continue;
      visible[cell] += 1;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }
  return {
    boundsNormalized:
      maximumX < minimumX || maximumY < minimumY
        ? null
        : {
            x: minimumX / input.width,
            y: minimumY / input.height,
            width: (maximumX - minimumX + 1) / input.width,
            height: (maximumY - minimumY + 1) / input.height,
          },
    cellCoverage: Array.from(visible, (count, index) =>
      total[index] ? count / total[index]! : 0,
    ),
  };
}

type CellDeformation = TypographyDeformationAnalysis["dominantCells"][number] & {
  strain: [number, number, number];
};

function singularValues2x2(
  a: number,
  b: number,
  c: number,
  d: number,
): [number, number] {
  const trace = a * a + b * b + c * c + d * d;
  const determinant = (a * d - b * c) ** 2;
  const discriminant = Math.sqrt(Math.max(0, trace * trace - 4 * determinant));
  return [
    Math.sqrt(Math.max(0, (trace + discriminant) / 2)),
    Math.sqrt(Math.max(0, (trace - discriminant) / 2)),
  ];
}

function regularizeSurfaceMesh(input: {
  nodes: MeshNode[];
  columns: number;
  rows: number;
  passes?: number;
}): MeshNode[] {
  let nodes = input.nodes.map((node) => ({ ...node }));
  for (let pass = 0; pass < (input.passes ?? 3); pass += 1) {
    const previous = nodes;
    nodes = previous.map((node, index) => {
      const row = Math.floor(index / input.columns);
      const column = index % input.columns;
      if (
        row === 0 ||
        column === 0 ||
        row === input.rows - 1 ||
        column === input.columns - 1
      ) {
        return { displacementX: 0, displacementY: 0 };
      }
      const neighbors = [
        previous[index - 1]!,
        previous[index + 1]!,
        previous[index - input.columns]!,
        previous[index + input.columns]!,
      ];
      return {
        displacementX:
          node.displacementX * 0.5 +
          neighbors.reduce(
            (sum, neighbor) => sum + neighbor.displacementX,
            0,
          ) *
            0.125,
        displacementY:
          node.displacementY * 0.5 +
          neighbors.reduce(
            (sum, neighbor) => sum + neighbor.displacementY,
            0,
          ) *
            0.125,
      };
    });
  }
  return nodes;
}

function legacyNeighborGradientDiagnostics(input: {
  nodes: MeshNode[];
  columns: number;
  rows: number;
  rect: PixelRect;
}): {
  estimate: number;
  dominantEdges: NonNullable<
    SurfaceIntegrationEvidence["meshRegularization"]
  >["dominantLegacyEdges"];
} {
  const cellWidth = input.rect.width / (input.columns - 1);
  const cellHeight = input.rect.height / (input.rows - 1);
  const edges: NonNullable<
    SurfaceIntegrationEvidence["meshRegularization"]
  >["dominantLegacyEdges"] = [];
  const at = (column: number, row: number) =>
    input.nodes[row * input.columns + column]!;
  for (let row = 0; row < input.rows; row += 1) {
    for (let column = 0; column < input.columns; column += 1) {
      const node = at(column, row);
      if (column + 1 < input.columns) {
        const next = at(column + 1, row);
        const displacementDeltaPx = Math.hypot(
          next.displacementX - node.displacementX,
          next.displacementY - node.displacementY,
        );
        edges.push({
          direction: "HORIZONTAL",
          row,
          column,
          displacementDeltaPx,
          cellSpanPx: cellWidth,
          normalizedGradient: displacementDeltaPx / cellWidth,
        });
      }
      if (row + 1 < input.rows) {
        const next = at(column, row + 1);
        const displacementDeltaPx = Math.hypot(
          next.displacementX - node.displacementX,
          next.displacementY - node.displacementY,
        );
        edges.push({
          direction: "VERTICAL",
          row,
          column,
          displacementDeltaPx,
          cellSpanPx: cellHeight,
          normalizedGradient: displacementDeltaPx / cellHeight,
        });
      }
    }
  }
  const dominantEdges = edges
    .sort(
      (left, right) => right.normalizedGradient - left.normalizedGradient,
    )
    .slice(0, 6);
  return {
    estimate: dominantEdges[0]?.normalizedGradient ?? 0,
    dominantEdges,
  };
}

/**
 * Measures the actual local sampling transform applied by the compositor.
 * Rigid local rotation is recorded but is not treated as typography damage;
 * principal stretch, axis-angle change, area change and strain discontinuity
 * are. Only cells carrying visible Artwork alpha participate in the gate.
 */
export function analyzeTypographyDeformation(input: {
  nodes: MeshNode[];
  columns: number;
  rows: number;
  rect: PixelRect;
  artworkContent?: ArtworkSurfaceContentAnalysis;
}): {
  distortion: number;
  analysis: TypographyDeformationAnalysis;
} {
  const cellColumns = input.columns - 1;
  const cellRows = input.rows - 1;
  const cellWidth = input.rect.width / cellColumns;
  const cellHeight = input.rect.height / cellRows;
  const at = (column: number, row: number) =>
    input.nodes[row * input.columns + column]!;
  const cells: CellDeformation[] = [];
  for (let row = 0; row < cellRows; row += 1) {
    for (let column = 0; column < cellColumns; column += 1) {
      const topLeft = at(column, row);
      const topRight = at(column + 1, row);
      const bottomLeft = at(column, row + 1);
      const bottomRight = at(column + 1, row + 1);
      const derivativeXByX =
        ((topRight.displacementX - topLeft.displacementX) +
          (bottomRight.displacementX - bottomLeft.displacementX)) /
        (2 * cellWidth);
      const derivativeYByX =
        ((topRight.displacementY - topLeft.displacementY) +
          (bottomRight.displacementY - bottomLeft.displacementY)) /
        (2 * cellWidth);
      const derivativeXByY =
        ((bottomLeft.displacementX - topLeft.displacementX) +
          (bottomRight.displacementX - topRight.displacementX)) /
        (2 * cellHeight);
      const derivativeYByY =
        ((bottomLeft.displacementY - topLeft.displacementY) +
          (bottomRight.displacementY - topRight.displacementY)) /
        (2 * cellHeight);

      // source = nominal source - displacement: this is the transform that is
      // actually sampled in compositor.ts, after removing uniform base scale.
      const a = 1 - derivativeXByX;
      const b = -derivativeXByY;
      const c = -derivativeYByX;
      const d = 1 - derivativeYByY;
      const horizontalScale = Math.hypot(a, c);
      const verticalScale = Math.hypot(b, d);
      const [maximumPrincipalScale, minimumPrincipalScale] =
        singularValues2x2(a, b, c, d);
      const dot = a * b + c * d;
      const normalizedAxisDot =
        horizontalScale > 1e-9 && verticalScale > 1e-9
          ? clamp(dot / (horizontalScale * verticalScale), -1, 1)
          : 1;
      const angularDistortionRadians = Math.abs(
        Math.PI / 2 - Math.acos(normalizedAxisDot),
      );
      const rotationRadians = Math.atan2(c - b, a + d);
      const areaScaleDeviation = Math.abs(a * d - b * c - 1);
      const principalScaleDeviation = Math.max(
        Math.abs(maximumPrincipalScale - 1),
        Math.abs(minimumPrincipalScale - 1),
      );
      const coverage =
        input.artworkContent?.cellCoverage[row * cellColumns + column] ?? 1;
      cells.push({
        row,
        column,
        artworkContentCoverage: coverage,
        localHorizontalScaleDeviation: Math.abs(horizontalScale - 1),
        localVerticalScaleDeviation: Math.abs(verticalScale - 1),
        principalScaleDeviation,
        localShear: Math.abs(normalizedAxisDot),
        localAngularDistortionDegrees:
          (angularDistortionRadians * 180) / Math.PI,
        localRotationDegrees: (rotationRadians * 180) / Math.PI,
        localAreaScaleDeviation: areaScaleDeviation,
        neighborJacobianDiscontinuity: 0,
        risk: 0,
        // Green-Lagrange strain is rotation invariant and is therefore a
        // suitable discontinuity signal between neighboring mesh cells.
        strain: [
          (a * a + c * c - 1) / 2,
          (a * b + c * d) / 2,
          (b * b + d * d - 1) / 2,
        ],
      });
    }
  }

  const cellAt = (column: number, row: number) =>
    cells[row * cellColumns + column]!;
  for (const cell of cells) {
    for (const [column, row] of [
      [cell.column - 1, cell.row],
      [cell.column + 1, cell.row],
      [cell.column, cell.row - 1],
      [cell.column, cell.row + 1],
    ] as Array<[number, number]>) {
      if (column < 0 || row < 0 || column >= cellColumns || row >= cellRows)
        continue;
      const neighbor = cellAt(column, row);
      const discontinuity = Math.hypot(
        cell.strain[0] - neighbor.strain[0],
        Math.SQRT2 * (cell.strain[1] - neighbor.strain[1]),
        cell.strain[2] - neighbor.strain[2],
      );
      cell.neighborJacobianDiscontinuity = Math.max(
        cell.neighborJacobianDiscontinuity,
        discontinuity,
      );
    }
    cell.risk = Math.max(
      cell.principalScaleDeviation,
      cell.localShear,
      cell.localAreaScaleDeviation * 0.5,
      cell.neighborJacobianDiscontinuity * 0.5,
    );
  }

  // Every cell containing any canonical visible alpha remains protected; only
  // completely transparent padding cells are excluded from typography risk.
  const activeCells = cells.filter((cell) => cell.artworkContentCoverage > 0);
  const measuredCells = activeCells.length ? activeCells : cells;
  const maximum = (field: keyof CellDeformation) =>
    Math.max(...measuredCells.map((cell) => Number(cell[field])));
  const dominantCells = [...measuredCells]
    .sort((left, right) => right.risk - left.risk)
    .slice(0, 6)
    .map((cell) => ({
      row: cell.row,
      column: cell.column,
      artworkContentCoverage: cell.artworkContentCoverage,
      localHorizontalScaleDeviation: cell.localHorizontalScaleDeviation,
      localVerticalScaleDeviation: cell.localVerticalScaleDeviation,
      principalScaleDeviation: cell.principalScaleDeviation,
      localShear: cell.localShear,
      localAngularDistortionDegrees: cell.localAngularDistortionDegrees,
      localRotationDegrees: cell.localRotationDegrees,
      localAreaScaleDeviation: cell.localAreaScaleDeviation,
      neighborJacobianDiscontinuity:
        cell.neighborJacobianDiscontinuity,
      risk: cell.risk,
    }));
  const distortion = clamp(maximum("risk"), 0, 1);
  return {
    distortion,
    analysis: {
      metricVersion: TYPOGRAPHY_DEFORMATION_METRIC_VERSION_V1,
      contentBoundsNormalized: input.artworkContent?.boundsNormalized ?? null,
      activeCellCount: activeCells.length,
      ignoredTransparentCellCount: cells.length - activeCells.length,
      maximumLocalHorizontalScaleDeviation: maximum(
        "localHorizontalScaleDeviation",
      ),
      maximumLocalVerticalScaleDeviation: maximum(
        "localVerticalScaleDeviation",
      ),
      maximumPrincipalScaleDeviation: maximum("principalScaleDeviation"),
      maximumLocalShear: maximum("localShear"),
      maximumLocalAngularDistortionDegrees: maximum(
        "localAngularDistortionDegrees",
      ),
      maximumLocalRotationDegrees: Math.max(
        ...measuredCells.map((cell) => Math.abs(cell.localRotationDegrees)),
      ),
      maximumLocalAreaScaleDeviation: maximum("localAreaScaleDeviation"),
      maximumNeighborJacobianDiscontinuity: maximum(
        "neighborJacobianDiscontinuity",
      ),
      dominantCells,
    },
  };
}

function refusal(input: {
  settings: SurfaceSettings;
  reason: Exclude<SurfaceIntegrationEvidence["reason"], "READY">;
  maskCoverage?: number;
  confidence?: number;
  surfaceEvidenceConfidence?: NonNullable<
    SurfaceIntegrationEvidence["surfaceEvidenceConfidence"]
  >;
  curvature?: number;
  fold?: number;
  shading?: number;
  texture?: number;
  flatOverlayRisk?: number;
  typographyDistortion?: number;
  typographyDeformation?: TypographyDeformationAnalysis;
  meshRegularization?: NonNullable<
    SurfaceIntegrationEvidence["meshRegularization"]
  >;
  maximumAppliedWarpPx?: number;
  warpStrength?: number;
  clampReasons?: SurfaceIntegrationEvidence["clampReasons"];
}): SurfaceIntegrationEvidence {
  return {
    contractVersion: input.settings.contractVersion,
    status: "REFUSED",
    reason: input.reason,
    warpEnabled: (input.maximumAppliedWarpPx ?? 0) >= 0.05,
    warpStrength: clamp(input.warpStrength ?? 0, 0, 0.02),
    maximumAppliedWarpPx: Math.max(0, input.maximumAppliedWarpPx ?? 0),
    clampReasons: input.clampReasons ?? [],
    curvatureEvidence: clamp(input.curvature ?? 0, 0, 1),
    foldResponseEvidence: clamp(input.fold ?? 0, 0, 1),
    shadingResponseEvidence: clamp(input.shading ?? 0, 0, 1),
    textureResponseEvidence: clamp(input.texture ?? 0, 0, 1),
    maskClippingCoverage: clamp(input.maskCoverage ?? 0, 0, 1),
    effectivePrintRealismConfidence: clamp(input.confidence ?? 0, 0, 1),
    ...(input.surfaceEvidenceConfidence
      ? { surfaceEvidenceConfidence: input.surfaceEvidenceConfidence }
      : {}),
    flatOverlayRisk: clamp(input.flatOverlayRisk ?? 1, 0, 1),
    typographyDistortionEstimate: clamp(
      input.typographyDistortion ?? 0,
      0,
      1,
    ),
    ...(input.typographyDeformation
      ? { typographyDeformation: input.typographyDeformation }
      : {}),
    ...(input.meshRegularization
      ? { meshRegularization: input.meshRegularization }
      : {}),
    gridColumns: input.settings.gridColumns,
    gridRows: input.settings.gridRows,
    deterministic: true,
    sourceAuthorityPreserved: true,
    failClosedReason: input.reason,
  };
}

function rowSpan(input: {
  y: number;
  centerX: number;
  searchLeft: number;
  searchRight: number;
  maskContains: (x: number, y: number) => boolean;
}): { left: number; right: number; center: number; width: number } | null {
  const y = Math.round(input.y);
  let seed = Math.round(input.centerX);
  if (!input.maskContains(seed, y)) {
    let found: number | null = null;
    for (
      let distance = 1;
      distance <= input.searchRight - input.searchLeft;
      distance += 1
    ) {
      const left = seed - distance;
      const right = seed + distance;
      if (left >= input.searchLeft && input.maskContains(left, y)) {
        found = left;
        break;
      }
      if (right <= input.searchRight && input.maskContains(right, y)) {
        found = right;
        break;
      }
    }
    if (found === null) return null;
    seed = found;
  }
  let left = seed;
  let right = seed;
  while (left > input.searchLeft && input.maskContains(left - 1, y)) left -= 1;
  while (right < input.searchRight && input.maskContains(right + 1, y))
    right += 1;
  return {
    left,
    right,
    center: (left + right) / 2,
    width: right - left + 1,
  };
}

/**
 * Builds a deterministic low-resolution displacement mesh from the exact
 * Stage-A raster and validated garment mask. The placement rectangle remains
 * the authority: the mesh is zero at its boundary and can only introduce a
 * small, locally varying physical response inside it.
 */
export function buildSurfaceConformingPlan(input: {
  pixels: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  artworkRect: PixelRect;
  maskContains: ((x: number, y: number) => boolean) | null;
  settings: SurfaceSettings;
  artworkContent?: ArtworkSurfaceContentAnalysis;
}):
  | { status: "READY"; plan: SurfaceConformingPlan }
  | { status: "REFUSED"; evidence: SurfaceIntegrationEvidence } {
  const { artworkRect: rect, settings } = input;
  if (!input.maskContains) {
    return {
      status: "REFUSED",
      evidence: refusal({ settings, reason: "GARMENT_MASK_REQUIRED" }),
    };
  }
  if (rect.width < 24 || rect.height < 24) {
    return {
      status: "REFUSED",
      evidence: refusal({ settings, reason: "PRINT_REGION_TOO_SMALL" }),
    };
  }

  const left = clamp(Math.floor(rect.x), 0, input.imageWidth - 1);
  const right = clamp(
    Math.ceil(rect.x + rect.width),
    left + 1,
    input.imageWidth - 1,
  );
  const top = clamp(Math.floor(rect.y), 0, input.imageHeight - 1);
  const bottom = clamp(
    Math.ceil(rect.y + rect.height),
    top + 1,
    input.imageHeight - 1,
  );
  let maskInside = 0;
  let maskTotal = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      maskTotal += 1;
      if (input.maskContains(x, y)) maskInside += 1;
    }
  }
  const maskCoverage = maskTotal ? maskInside / maskTotal : 0;
  if (maskCoverage < settings.minimumMaskCoverage) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "MASK_COVERAGE_UNSAFE",
        maskCoverage,
      }),
    };
  }

  const centerX = rect.x + rect.width / 2;
  const searchLeft = clamp(
    Math.floor(centerX - rect.width * 1.05),
    0,
    input.imageWidth - 1,
  );
  const searchRight = clamp(
    Math.ceil(centerX + rect.width * 1.05),
    searchLeft + 1,
    input.imageWidth - 1,
  );
  const rowSpans = Array.from({ length: settings.gridRows }, (_, row) => {
    const v = row / (settings.gridRows - 1);
    return rowSpan({
      y: rect.y + v * rect.height,
      centerX,
      searchLeft,
      searchRight,
      maskContains: input.maskContains!,
    });
  });
  if (rowSpans.some((span) => !span)) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "SURFACE_EVIDENCE_INSUFFICIENT",
        maskCoverage,
      }),
    };
  }
  const spans = rowSpans as Array<NonNullable<(typeof rowSpans)[number]>>;
  const meanCenter =
    spans.reduce((total, span) => total + span.center, 0) / spans.length;
  const meanWidth =
    spans.reduce((total, span) => total + span.width, 0) / spans.length;
  const centerDrift =
    (Math.max(...spans.map((span) => span.center)) -
      Math.min(...spans.map((span) => span.center))) /
    rect.width;
  const widthVariation =
    (Math.max(...spans.map((span) => span.width)) -
      Math.min(...spans.map((span) => span.width))) /
    Math.max(1, meanWidth);
  if (centerDrift > 0.24 || widthVariation > 0.58) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "EXTREME_SURFACE_GEOMETRY",
        maskCoverage,
        confidence: 0.35,
      }),
    };
  }

  const luminances: number[] = [];
  const gradientMagnitudes: number[] = [];
  const textureResiduals: number[] = [];
  const curvatureSignals: number[] = [];
  const rawNodes: MeshNode[] = [];
  let clampedNodes = 0;
  const maxX = rect.width * settings.maximumWarpRatio;
  const maxY = rect.height * settings.maximumWarpRatio * 0.72;
  const radius = clamp(
    Math.round(Math.min(rect.width, rect.height) * 0.025),
    2,
    14,
  );
  const sample = (x: number, y: number) =>
    luminanceAt({
      pixels: input.pixels,
      width: input.imageWidth,
      height: input.imageHeight,
      x,
      y,
    });

  for (let row = 0; row < settings.gridRows; row += 1) {
    const v = row / (settings.gridRows - 1);
    const span = spans[row]!;
    const silhouetteCenterShift = span.center - meanCenter;
    const silhouetteWidthDelta = (span.width - meanWidth) / meanWidth;
    const rowY = rect.y + v * rect.height;
    const rowLeftLuminance = sample(rect.x + rect.width * 0.2, rowY);
    const rowCenterLuminance = sample(centerX, rowY);
    const rowRightLuminance = sample(rect.x + rect.width * 0.8, rowY);
    const rowCurvature =
      (rowCenterLuminance -
        (rowLeftLuminance + rowRightLuminance) / 2) /
      255;
    curvatureSignals.push(rowCurvature);

    for (let column = 0; column < settings.gridColumns; column += 1) {
      const u = column / (settings.gridColumns - 1);
      const x = rect.x + u * rect.width;
      const y = rowY;
      const center = sample(x, y);
      const leftLuminance = sample(x - radius, y);
      const rightLuminance = sample(x + radius, y);
      const topLuminance = sample(x, y - radius);
      const bottomLuminance = sample(x, y + radius);
      const lowFrequency =
        (center * 2 +
          leftLuminance +
          rightLuminance +
          topLuminance +
          bottomLuminance) /
        6;
      const gradientX = (rightLuminance - leftLuminance) / 255;
      const gradientY = (bottomLuminance - topLuminance) / 255;
      const texture = (center - lowFrequency) / 255;
      const boundaryEnvelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      luminances.push(center);
      gradientMagnitudes.push(Math.hypot(gradientX, gradientY));
      textureResiduals.push(texture);

      const silhouetteX =
        (silhouetteCenterShift +
          (u - 0.5) * rect.width * silhouetteWidthDelta * 0.22) *
        settings.silhouetteResponse;
      const curvatureX =
        (u - 0.5) *
        rowCurvature *
        rect.width *
        settings.curvatureResponse *
        0.32;
      const foldX =
        gradientX * maxX * settings.foldResponse * 1.25 +
        texture * maxX * settings.foldResponse * 0.6;
      const foldY =
        gradientY * maxY * settings.foldResponse * 1.05 +
        texture * maxY * settings.foldResponse * 0.42;
      const rawX =
        (silhouetteX + curvatureX + foldX) * boundaryEnvelope;
      const rawY = foldY * boundaryEnvelope;
      const displacementX = clamp(rawX, -maxX, maxX);
      const displacementY = clamp(rawY, -maxY, maxY);
      if (
        Math.abs(displacementX - rawX) > 1e-9 ||
        Math.abs(displacementY - rawY) > 1e-9
      ) {
        clampedNodes += 1;
      }
      rawNodes.push({ displacementX, displacementY });
    }
  }

  const clampFraction = clampedNodes / rawNodes.length;
  const rawMaximumAppliedWarpPx = Math.max(
    ...rawNodes.map((node) =>
      Math.hypot(node.displacementX, node.displacementY),
    ),
  );
  // Raster gradients can alternate sharply between adjacent samples even when
  // the physical shirt surface is smooth. Applying those raw samples directly
  // created local shear. Regularization is part of the actual frozen transform,
  // not a reporting adjustment: the validator evaluates these exact nodes.
  const nodes = regularizeSurfaceMesh({
    nodes: rawNodes,
    columns: settings.gridColumns,
    rows: settings.gridRows,
  });
  const maximumAppliedWarpPx = Math.max(
    ...nodes.map((node) =>
      Math.hypot(node.displacementX, node.displacementY),
    ),
  );
  const warpStrength = clamp(
    maximumAppliedWarpPx / Math.min(rect.width, rect.height),
    0,
    0.02,
  );
  const typography = analyzeTypographyDeformation({
    nodes,
    columns: settings.gridColumns,
    rows: settings.gridRows,
    rect,
    ...(input.artworkContent ? { artworkContent: input.artworkContent } : {}),
  });
  const typographyDistortion = typography.distortion;

  const curvatureEvidence = clamp(
    rms(curvatureSignals) * 4 + centerDrift + widthVariation * 0.5,
    0,
    1,
  );
  const foldEvidence = clamp(rms(gradientMagnitudes) * 2.6, 0, 1);
  const shadingEvidence = clamp(
    ((quantile(luminances, 0.9) - quantile(luminances, 0.1)) / 255) *
      1.65,
    0,
    1,
  );
  const textureEvidence = clamp(rms(textureResiduals) * 5, 0, 1);
  const geometryConfidence = clamp(
    1 - Math.max(centerDrift / 0.24, widthVariation / 0.58),
    0,
    1,
  );
  const surfaceEvidenceConfidence = {
    metricVersion: "nexhq-surface-evidence-confidence-v1" as const,
    interpretation: "SURFACE_EVIDENCE_RELIABILITY" as const,
    maskReliability: maskCoverage,
    geometryStability: geometryConfidence,
    unclampedNodeFraction: 1 - clampFraction,
    typographyUsesSeparateHardGate: true as const,
  };
  const confidence = clamp(
    maskCoverage * 0.6 +
      geometryConfidence * 0.25 +
      (1 - clampFraction) * 0.15,
    0,
    1,
  );
  const flatOverlayRisk = clamp(
    0.82 -
      (warpStrength / settings.maximumWarpRatio) * 0.3 -
      foldEvidence * 0.18 -
      shadingEvidence * 0.18 -
      textureEvidence * 0.12 -
      curvatureEvidence * 0.12,
    0,
    1,
  );
  const clampReasons: SurfaceIntegrationEvidence["clampReasons"] = [];
  if (clampedNodes > 0) clampReasons.push("MAXIMUM_WARP_BOUND");
  const rawTypography = analyzeTypographyDeformation({
    nodes: rawNodes,
    columns: settings.gridColumns,
    rows: settings.gridRows,
    rect,
    ...(input.artworkContent ? { artworkContent: input.artworkContent } : {}),
  });
  const legacyTypography = legacyNeighborGradientDiagnostics({
    nodes: rawNodes,
    columns: settings.gridColumns,
    rows: settings.gridRows,
    rect,
  });
  const meshRegularization = {
    passes: 3,
    rawMaximumAppliedWarpPx,
    appliedMaximumWarpPx: maximumAppliedWarpPx,
    rawLegacyNeighborGradientEstimate: legacyTypography.estimate,
    rawJacobianDistortionEstimate: rawTypography.distortion,
    appliedJacobianDistortionEstimate: typographyDistortion,
    dominantLegacyEdges: legacyTypography.dominantEdges,
  };
  if (rawTypography.distortion > typographyDistortion + 1e-9) {
    clampReasons.push("TYPOGRAPHY_SAFETY_BOUND");
  }
  // Boundary pinning is always active and is evidence of the placement safety
  // envelope, not an indication that owner placement was changed.
  clampReasons.push("GARMENT_EDGE_ENVELOPE");

  const common = {
    settings,
    maskCoverage,
    confidence,
    surfaceEvidenceConfidence,
    curvature: curvatureEvidence,
    fold: foldEvidence,
    shading: shadingEvidence,
    texture: textureEvidence,
    flatOverlayRisk,
    typographyDistortion,
    typographyDeformation: typography.analysis,
    meshRegularization,
    maximumAppliedWarpPx,
    warpStrength,
    clampReasons,
  };
  if (clampFraction > 0.35) {
    return {
      status: "REFUSED",
      evidence: refusal({
        ...common,
        reason: "EXCESSIVE_WARP_REQUIRED",
      }),
    };
  }
  if (typographyDistortion > settings.maximumTypographyDistortion) {
    return {
      status: "REFUSED",
      evidence: refusal({
        ...common,
        reason: "TYPOGRAPHY_DISTORTION_RISK",
        clampReasons: clampReasons.includes("TYPOGRAPHY_SAFETY_BOUND")
          ? clampReasons
          : [...clampReasons, "TYPOGRAPHY_SAFETY_BOUND"],
      }),
    };
  }
  if (confidence < settings.minimumRealismConfidence) {
    return {
      status: "REFUSED",
      evidence: refusal({
        ...common,
        reason: "SURFACE_EVIDENCE_INSUFFICIENT",
      }),
    };
  }

  const evidence: SurfaceIntegrationEvidence = {
    contractVersion: settings.contractVersion,
    status: "READY",
    reason: "READY",
    warpEnabled: maximumAppliedWarpPx >= 0.05,
    warpStrength,
    maximumAppliedWarpPx,
    clampReasons,
    curvatureEvidence,
    foldResponseEvidence: foldEvidence,
    shadingResponseEvidence: shadingEvidence,
    textureResponseEvidence: textureEvidence,
    maskClippingCoverage: maskCoverage,
    effectivePrintRealismConfidence: confidence,
    surfaceEvidenceConfidence,
    flatOverlayRisk,
    typographyDistortionEstimate: typographyDistortion,
    typographyDeformation: typography.analysis,
    meshRegularization,
    gridColumns: settings.gridColumns,
    gridRows: settings.gridRows,
    deterministic: true,
    sourceAuthorityPreserved: true,
    failClosedReason: null,
  };
  return {
    status: "READY",
    plan: {
      rect,
      columns: settings.gridColumns,
      rows: settings.gridRows,
      nodes,
      evidence,
    },
  };
}

/** Bilinear interpolation across the frozen deterministic displacement mesh. */
export function resolveSurfaceConformingDisplacement(input: {
  plan: SurfaceConformingPlan;
  x: number;
  y: number;
}): MeshNode {
  const u = clamp(
    (input.x + 0.5 - input.plan.rect.x) / input.plan.rect.width,
    0,
    1,
  );
  const v = clamp(
    (input.y + 0.5 - input.plan.rect.y) / input.plan.rect.height,
    0,
    1,
  );
  const gridX = u * (input.plan.columns - 1);
  const gridY = v * (input.plan.rows - 1);
  const left = Math.floor(gridX);
  const top = Math.floor(gridY);
  const right = Math.min(left + 1, input.plan.columns - 1);
  const bottom = Math.min(top + 1, input.plan.rows - 1);
  const tx = gridX - left;
  const ty = gridY - top;
  const at = (column: number, row: number) =>
    input.plan.nodes[row * input.plan.columns + column]!;
  const topLeft = at(left, top);
  const topRight = at(right, top);
  const bottomLeft = at(left, bottom);
  const bottomRight = at(right, bottom);
  const interpolate = (field: keyof MeshNode) => {
    const upper = topLeft[field] * (1 - tx) + topRight[field] * tx;
    const lower = bottomLeft[field] * (1 - tx) + bottomRight[field] * tx;
    return upper * (1 - ty) + lower * ty;
  };
  return {
    displacementX: interpolate("displacementX"),
    displacementY: interpolate("displacementY"),
  };
}

export function surfaceIntegrationEvidenceFromError(
  error: unknown,
): SurfaceIntegrationEvidence | null {
  return error instanceof SurfaceIntegrationUnsafeError
    ? error.evidence
    : null;
}
