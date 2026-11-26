import { DEFAULT_FRAMESENSE_CONFIG } from "@framesense/config/defaults";
import type { BoundingBox, FrameQualityMetrics } from "@framesense/core";
import type { FrameQualityThresholds, PixelDataBuffer } from "./types.js";

/**
 * Evaluates frame exposure, backlighting, and Laplacian edge sharpness
 * deterministically from an RGBA pixel buffer.
 */
export function evaluateFrameQuality(
  buffer: PixelDataBuffer,
  subjectBox?: BoundingBox,
  thresholds?: FrameQualityThresholds,
): FrameQualityMetrics {
  const inf = DEFAULT_FRAMESENSE_CONFIG.inference;
  const lowLightThreshold = thresholds?.lowLightThreshold ?? inf.lowLightThreshold ?? 0.18;
  const overexposedThreshold = thresholds?.overexposedThreshold ?? inf.overexposedThreshold ?? 0.88;
  const clippedRatioThreshold = thresholds?.clippedHighlightRatio ?? inf.clippedHighlightRatio ?? 0.4;
  const backlitSubjectThreshold =
    thresholds?.backlitSubjectThreshold ?? inf.backlitSubjectThreshold ?? 0.3;
  const backlitDeltaThreshold =
    thresholds?.backlitDeltaThreshold ?? inf.backlitDeltaThreshold ?? 0.32;
  const blurSharpnessThreshold =
    thresholds?.blurSharpnessThreshold ?? inf.blurSharpnessThreshold ?? 3.5;
  const blurMaxEdgeThreshold = thresholds?.blurMaxEdgeThreshold ?? inf.blurMaxEdgeThreshold ?? 28;
  const { data, width, height } = buffer;
  const totalPixels = width * height;
  if (width < 4 || height < 4 || data.length < totalPixels * 4) {
    return { brightness: 0.5, sharpness: 20, status: "OPTIMAL" };
  }

  let lumSum = 0;
  let clippedCount = 0;
  let subjectLumSum = 0;
  let subjectCount = 0;
  let bgLumSum = 0;
  let bgCount = 0;

  const subMinX = subjectBox ? Math.floor(subjectBox.x * width) : -1;
  const subMaxX = subjectBox ? Math.ceil((subjectBox.x + subjectBox.width) * width) : -1;
  const subMinY = subjectBox ? Math.floor(subjectBox.y * height) : -1;
  const subMaxY = subjectBox ? Math.ceil((subjectBox.y + subjectBox.height) * height) : -1;

  const lums = new Float32Array(totalPixels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const idx = pIdx * 4;
      const lum =
        (0.299 * (data[idx] ?? 0) +
          0.587 * (data[idx + 1] ?? 0) +
          0.114 * (data[idx + 2] ?? 0)) /
        255;

      lums[pIdx] = lum;
      lumSum += lum;
      if (lum > 0.96) clippedCount++;

      if (subjectBox) {
        if (x >= subMinX && x <= subMaxX && y >= subMinY && y <= subMaxY) {
          subjectLumSum += lum;
          subjectCount++;
        } else {
          bgLumSum += lum;
          bgCount++;
        }
      }
    }
  }

  const brightness = Number((lumSum / totalPixels).toFixed(3));
  const clippedRatio = clippedCount / totalPixels;

  // Compute 4-neighbor Laplacian sharpness inside subject ROI (or center 60% if no subject)
  const roiMinX = Math.max(1, subjectBox ? Math.max(1, subMinX - 2) : Math.floor(width * 0.2));
  const roiMaxX = Math.min(
    width - 2,
    subjectBox ? Math.min(width - 2, subMaxX + 2) : Math.floor(width * 0.8),
  );
  const roiMinY = Math.max(1, subjectBox ? Math.max(1, subMinY - 2) : Math.floor(height * 0.2));
  const roiMaxY = Math.min(
    height - 2,
    subjectBox ? Math.min(height - 2, subMaxY + 2) : Math.floor(height * 0.8),
  );

  let lapSum = 0;
  let lapCount = 0;
  let maxEdge = 0;

  for (let y = roiMinY; y <= roiMaxY; y++) {
    for (let x = roiMinX; x <= roiMaxX; x++) {
      const p = y * width + x;
      const lap =
        Math.abs(
          4 * (lums[p] ?? 0) -
            (lums[p - 1] ?? 0) -
            (lums[p + 1] ?? 0) -
            (lums[p - width] ?? 0) -
            (lums[p + width] ?? 0),
        ) * 255;
      lapSum += lap;
      if (lap > maxEdge) maxEdge = lap;
      lapCount++;
    }
  }

  const sharpness = lapCount > 0 ? Number((lapSum / lapCount).toFixed(2)) : 0;

  if (brightness < lowLightThreshold) {
    return {
      brightness,
      sharpness,
      status: "LOW_LIGHT",
      warning: "Low light — move toward a brighter light source.",
    };
  }

  if (brightness > overexposedThreshold || clippedRatio > clippedRatioThreshold) {
    return {
      brightness,
      sharpness,
      status: "OVEREXPOSED",
      warning: "Too bright — avoid direct bright glare.",
    };
  }

  if (subjectBox && subjectCount > 0 && bgCount > 0) {
    const subMean = subjectLumSum / subjectCount;
    const bgMean = bgLumSum / bgCount;
    if (subMean < backlitSubjectThreshold && bgMean - subMean > backlitDeltaThreshold) {
      return {
        brightness,
        sharpness,
        status: "BACKLIT",
        warning: "Strong backlight — face toward the light.",
      };
    }
  }

  // Flag soft focus or motion blur on active subjects when both mean and peak local edges collapse
  if (subjectBox && sharpness < blurSharpnessThreshold && maxEdge < blurMaxEdgeThreshold) {
    return {
      brightness,
      sharpness,
      status: "BLURRY",
      warning: "Soft focus or motion blur — hold camera steady.",
    };
  }

  return {
    brightness,
    sharpness,
    status: "OPTIMAL",
  };
}
