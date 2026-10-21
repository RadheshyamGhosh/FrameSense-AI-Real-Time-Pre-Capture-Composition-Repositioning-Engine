import type { CompositionConfig } from "@framesense/config";
import type { SceneType } from "@framesense/core";
import type { MetricEvaluationResult, PrimarySubject } from "../types.js";

const THIRDS = [1 / 3, 2 / 3] as const;

/**
 * Evaluates Rule of Thirds alignment for the primary subject's focal point.
 */
export function evaluateRuleOfThirds(
  subject: PrimarySubject,
  scene: SceneType,
  config: CompositionConfig,
): MetricEvaluationResult {
  if (subject.source === "FRAME_CENTER" && subject.confidence === 0) {
    return {
      metric: {
        type: "RULE_OF_THIRDS",
        score: 50,
        confidence: 0,
        explanation: "No subject detected to evaluate Rule of Thirds.",
      },
    };
  }

  const { x, y } = subject.focalPoint;

  // In centered portraits or architecture, centering (x = 0.5) is also a valid compositional aesthetic
  const isCenteredAllowed = scene === "PORTRAIT" || scene === "ARCHITECTURE";

  // Calculate distance to closest vertical line (x = 1/3, 2/3, or optionally 0.5)
  const candidateX = isCenteredAllowed ? [...THIRDS, 0.5] : [...THIRDS];
  const distX = Math.min(...candidateX.map((target) => Math.abs(x - target)));

  // Calculate distance to closest horizontal line (y = 1/3 or 2/3)
  const distY = Math.min(...THIRDS.map((target) => Math.abs(y - target)));

  // Combined euclidean or manhattan distance to nearest guide
  const combinedDistance = Math.hypot(distX, distY);
  const tolerance = config.ruleOfThirdsTolerance;

  let score: number;
  if (combinedDistance <= tolerance) {
    score = 100;
  } else {
    // Maximum plausible distance in normalized [0, 1] grid to nearest third line is ~0.25
    const maxDistance = 0.25;
    const penaltyRatio = Math.min(1, Math.max(0, (combinedDistance - tolerance) / (maxDistance - tolerance)));
    score = Math.max(0, Math.round(100 * (1 - penaltyRatio)));
  }

  let issue;
  if (score < config.minimumAcceptableScore) {
    let message = "Subject focal point is off the Rule of Thirds grid.";
    if (x < 1 / 3 - tolerance) {
      message = "Subject is framed too far to the left. Shift frame left or reposition subject.";
    } else if (x > 2 / 3 + tolerance) {
      message = "Subject is framed too far to the right. Shift frame right or reposition subject.";
    } else if (y > 2 / 3 + tolerance) {
      message = "Subject is framed too low. Tilt camera up.";
    }

    const severity = score < config.minimumAcceptableScore * 0.6 ? ("HIGH" as const) : ("MEDIUM" as const);
    issue = {
      metricType: "RULE_OF_THIRDS" as const,
      severity,
      message,
    };
  }

  return {
    metric: {
      type: "RULE_OF_THIRDS",
      score,
      confidence: subject.confidence,
      errorMagnitude: combinedDistance,
      explanation:
        score >= config.excellentScore
          ? "Subject is well-aligned with Rule of Thirds guidelines."
          : `Distance to nearest gridline: ${(combinedDistance * 100).toFixed(1)}%.`,
    },
    issue,
  };
}
