import type { CompositionConfig } from "@framesense/config";
import type { HorizonResult, SceneType } from "@framesense/core";
import type { MetricEvaluationResult } from "../types.js";

/**
 * Evaluates horizon alignment and tilt angle.
 */
export function evaluateHorizon(
  horizon: HorizonResult | undefined,
  scene: SceneType,
  config: CompositionConfig,
): MetricEvaluationResult {
  // If horizon was not detected
  if (!horizon || !horizon.detected || horizon.angleDegrees === undefined) {
    // In portraits or food, horizon might naturally be absent or irrelevant
    const isCritical = scene === "LANDSCAPE" || scene === "ARCHITECTURE";
    return {
      metric: {
        type: "HORIZON_ALIGNMENT",
        score: isCritical ? 60 : 100,
        confidence: isCritical ? 0.3 : 0.8,
        explanation: isCritical
          ? "Horizon not clearly detected in landscape/architecture scene."
          : "Horizon detection not required for this scene.",
      },
    };
  }

  const angle = horizon.angleDegrees;
  const absAngle = Math.abs(angle);
  const maxAllowedAngle = config.maximumHorizonAngleDegrees; // e.g. 3 degrees

  let score: number;
  let errorMagnitude = 0;
  let issue;

  if (absAngle <= maxAllowedAngle) {
    score = 100;
  } else {
    errorMagnitude = absAngle - maxAllowedAngle;
    // At 15 degrees deviation beyond allowed, score drops to 0
    const penaltyRatio = Math.min(1, errorMagnitude / 15);
    score = Math.max(0, Math.round(100 * (1 - penaltyRatio)));

    const direction = angle > 0 ? "counter-clockwise" : "clockwise";
    const severity = absAngle >= 10 ? ("HIGH" as const) : absAngle >= 5 ? ("MEDIUM" as const) : ("LOW" as const);
    issue = {
      metricType: "HORIZON_ALIGNMENT" as const,
      severity,
      message: `Horizon is tilted by ${absAngle.toFixed(1)}°. Rotate camera ${direction} to level.`,
    };
  }

  return {
    metric: {
      type: "HORIZON_ALIGNMENT",
      score,
      confidence: horizon.confidence,
      errorMagnitude,
      explanation:
        score >= config.excellentScore
          ? "Horizon is perfectly level."
          : `Horizon tilt is ${absAngle.toFixed(1)}° (max allowed is ${maxAllowedAngle}°).`,
    },
    issue,
  };
}
