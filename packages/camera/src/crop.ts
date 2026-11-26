export type AspectRatioPreset = "VIEWPORT" | "16:9" | "4:3" | "1:1" | "9:16";

export interface CropRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/**
 * Returns the numeric width/height ratio for an AspectRatioPreset,
 * or null when matching the visible viewport dynamically.
 */
export function getAspectRatioValue(preset: AspectRatioPreset): number | null {
  switch (preset) {
    case "16:9":
      return 16 / 9;
    case "4:3":
      return 4 / 3;
    case "1:1":
      return 1;
    case "9:16":
      return 9 / 16;
    case "VIEWPORT":
    default:
      return null;
  }
}

/**
 * Computes a centered pixel crop rectangle inside source dimensions
 * matching either an explicit AspectRatioPreset or visible viewport cover bounds.
 */
export function computeAspectCropRect(
  sourceWidth: number,
  sourceHeight: number,
  preset: AspectRatioPreset,
  viewportWidth?: number,
  viewportHeight?: number,
  digitalZoom = 1,
): CropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 };
  }

  let targetRatio = getAspectRatioValue(preset);
  if (targetRatio === null) {
    if (viewportWidth && viewportHeight && viewportWidth > 0 && viewportHeight > 0) {
      targetRatio = viewportWidth / viewportHeight;
    } else {
      targetRatio = sourceWidth / sourceHeight;
    }
  }

  const sourceRatio = sourceWidth / sourceHeight;
  let baseSw = sourceWidth;
  let baseSh = sourceHeight;

  if (Math.abs(sourceRatio - targetRatio) >= 0.005) {
    if (sourceRatio > targetRatio) {
      baseSw = Math.max(1, Math.round(sourceHeight * targetRatio));
    } else {
      baseSh = Math.max(1, Math.round(sourceWidth / targetRatio));
    }
  }

  const safeZoom = Math.max(1, digitalZoom);
  const sw = Math.max(1, Math.round(baseSw / safeZoom));
  const sh = Math.max(1, Math.round(baseSh / safeZoom));
  const sx = Math.max(0, Math.round((sourceWidth - sw) / 2));
  const sy = Math.max(0, Math.round((sourceHeight - sh) / 2));

  return { sx, sy, sw, sh };
}
