import type { CompositionConfig } from "@framesense/config";
import type { SceneType } from "@framesense/core";
import type { MetricEvaluationResult, PrimarySubject } from "../types.js";

/**
 * Evaluates subject positioning and horizontal symmetry balance.
 */
export function evaluateSymmetryAndPosition(
  subject: PrimarySubject,
  scene: SceneType,
  config: CompositionConfig,
): { position: MetricEvaluationResult; symmetry: MetricEvaluationResult } {
  if (subject.source === "FRAME_CENTER" && subject.confidence === 0) {
    return {
      position: {
        metric: {
          type: "SUBJECT_POSITION",
          score: 50,
          confidence: 0,
          explanation: "No subject detected to evaluate position.",
        },
      },
      symmetry: {
        metric: {
          type: "SYMMETRY",
          score: 50,
          confidence: 0,
          explanation: "No subject detected to evaluate symmetry.",
        },
      },
    };
  }

  const { x, width } = subject.boundingBox;
  const centerX = x + width / 2;
  const centerOffset = Math.abs(centerX - 0.5);

  // Symmetry scoring
  // Distance from center line: 0 is perfect symmetry, > 0.25 is asymmetric
  const symmetryPenalty = Math.min(1, centerOffset / 0.25);
  const symmetryScore = Math.max(0, Math.round(100 * (1 - symmetryPenalty)));

  // Position scoring depends on scene profile:
  // For centered profiles (Architecture, Solo Portrait Headshot): centered is optimal
  // For other profiles: placement on thirds (0.33 or 0.67) is optimal
  let positionScore: number;
  let positionIssue;

  if (scene === "ARCHITECTURE" || (scene === "PORTRAIT" && centerOffset <= 0.12)) {
    // Prefer central symmetry
    positionScore = symmetryScore;
    if (positionScore < config.minimumAcceptableScore) {
      positionIssue = {
        metricType: "SUBJECT_POSITION" as const,
        severity: "LOW" as const,
        message: centerX < 0.5 ? "Center subject: shift slightly right." : "Center subject: shift slightly left.",
      };
    }
  } else {
    // Prefer rule of thirds horizontal positioning (x ~= 0.33 or 0.67)
    const distToThird = Math.min(Math.abs(centerX - 1 / 3), Math.abs(centerX - 2 / 3));
    const thirdPenalty = Math.min(1, distToThird / 0.2);
    positionScore = Math.max(0, Math.round(100 * (1 - thirdPenalty)));
  }

  return {
    position: {
      metric: {
        type: "SUBJECT_POSITION",
        score: positionScore,
        confidence: subject.confidence,
        errorMagnitude: centerOffset,
        explanation: `Subject center is ${(centerX * 100).toFixed(1)}% across frame.`,
      },
      issue: positionIssue,
    },
    symmetry: {
      metric: {
        type: "SYMMETRY",
        score: symmetryScore,
        confidence: subject.confidence,
        errorMagnitude: centerOffset,
        explanation:
          symmetryScore >= config.excellentScore
            ? "Frame exhibits strong visual balance."
            : `Horizontal symmetry offset is ${(centerOffset * 100).toFixed(1)}%.`,
      },
    },
  };
}
