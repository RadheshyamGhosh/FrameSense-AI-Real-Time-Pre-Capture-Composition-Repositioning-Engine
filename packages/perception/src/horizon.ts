import type { HorizonLine, HorizonResult, Point2D } from "@framesense/core";
import type { PixelDataBuffer } from "./types.js";

export interface HorizonDetectionOptions {
  readonly contrastThreshold?: number;
  readonly minLineLength?: number;
}

/**
 * Calculates horizon tilt from two normalized points along the horizon line.
 */
export function estimateHorizonFromPoints(p1: Point2D, p2: Point2D): HorizonResult {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (Math.abs(dx) < 1e-6) {
    // Nearly vertical line is not a valid horizon
    return {
      detected: false,
      confidence: 0,
    };
  }

  // Calculate angle in degrees relative to horizontal axis
  // Positive angle indicates counter-clockwise tilt in screen coordinates
  const radians = Math.atan2(dy, dx);
  const angleDegrees = Number(((radians * 180) / Math.PI).toFixed(2));

  const line: HorizonLine = {
    start: p1,
    end: p2,
  };

  return {
    detected: true,
    angleDegrees,
    confidence: 0.9,
    line,
  };
}

/**
 * Deterministically estimates horizon tilt from raw image pixel data using gradient boundary detection.
 */
export function detectHorizonFromPixels(
  buffer: PixelDataBuffer,
  options?: HorizonDetectionOptions,
): HorizonResult {
  const { data, width, height } = buffer;
  const contrastThreshold = options?.contrastThreshold ?? 25;

  if (width < 20 || height < 20 || data.length < width * height * 4) {
    return { detected: false, confidence: 0 };
  }

  // Sample across 5 vertical scanlines: 15%, 32%, 50%, 68%, 85% width
  const sampleXs = [
    Math.round(width * 0.15),
    Math.round(width * 0.32),
    Math.round(width * 0.50),
    Math.round(width * 0.68),
    Math.round(width * 0.85),
  ];

  const detectedPoints: { x: number; y: number; gradient: number }[] = [];

  // Look for prominent horizontal boundary in the middle 60% of the frame
  const startY = Math.round(height * 0.2);
  const endY = Math.round(height * 0.8);

  for (const x of sampleXs) {
    let maxGrad = 0;
    let bestY = -1;

    for (let y = startY; y < endY; y++) {
      const idxAbove = ((y - 1) * width + x) * 4;
      const idxBelow = ((y + 1) * width + x) * 4;

      // Luminance approx: 0.299 R + 0.587 G + 0.114 B
      const lumAbove = 0.299 * data[idxAbove] + 0.587 * data[idxAbove + 1] + 0.114 * data[idxAbove + 2];
      const lumBelow = 0.299 * data[idxBelow] + 0.587 * data[idxBelow + 1] + 0.114 * data[idxBelow + 2];

      const grad = Math.abs(lumBelow - lumAbove);
      if (grad > maxGrad && grad > contrastThreshold) {
        maxGrad = grad;
        bestY = y;
      }
    }

    if (bestY !== -1) {
      detectedPoints.push({ x, y: bestY, gradient: maxGrad });
    }
  }

  // Need at least 3 consistent boundary points to reliably fit a horizon line
  if (detectedPoints.length < 3) {
    return {
      detected: false,
      confidence: 0,
    };
  }

  // Simple linear regression: y = m * x + c
  const n = detectedPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const pt of detectedPoints) {
    sumX += pt.x;
    sumY += pt.y;
    sumXY += pt.x * pt.y;
    sumX2 += pt.x * pt.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-6) {
    return { detected: false, confidence: 0 };
  }

  const m = (n * sumXY - sumX * sumY) / denominator;
  const c = (sumY - m * sumX) / n;

  // Angle in degrees
  const radians = Math.atan(m);
  const angleDegrees = Number(((radians * 180) / Math.PI).toFixed(2));

  // If slope is extreme (> 45 degrees), it's likely a vertical pillar or wall, not a horizon
  if (Math.abs(angleDegrees) > 45) {
    return { detected: false, confidence: 0.2 };
  }

  // Normalized line points across the frame
  const yStartNorm = Math.max(0, Math.min(1, c / height));
  const yEndNorm = Math.max(0, Math.min(1, (m * width + c) / height));

  const line: HorizonLine = {
    start: { x: 0, y: yStartNorm },
    end: { x: 1, y: yEndNorm },
  };

  const confidence = Math.min(0.95, 0.5 + (detectedPoints.length / sampleXs.length) * 0.45);

  return {
    detected: true,
    angleDegrees,
    confidence,
    line,
  };
}
