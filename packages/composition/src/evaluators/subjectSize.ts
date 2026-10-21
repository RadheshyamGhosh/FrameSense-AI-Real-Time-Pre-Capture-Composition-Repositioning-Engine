import type { CompositionConfig } from "@framesense/config";
import type { MetricEvaluationResult, PrimarySubject } from "../types.js";

/**
 * Evaluates subject sizing relative to the frame boundaries.
 */
export function evaluateSubjectSize(
  subject: PrimarySubject,
  config: CompositionConfig,
): MetricEvaluationResult {
  if (subject.source === "FRAME_CENTER" && subject.confidence === 0) {
    return {
      metric: {
        type: "SUBJECT_SIZE",
        score: 50,
        confidence: 0,
        explanation: "No subject detected to evaluate size.",
      },
    };
  }

  const { width, height } = subject.boundingBox;
  // Use maximum bounding span as the primary scale indicator
  const sizeRatio = Math.max(width, height);
  const minSize = config.minimumSubjectSizeRatio; // e.g. 0.18
  const maxSize = config.maximumSubjectSizeRatio; // e.g. 0.72

  let score: number;
  let errorMagnitude = 0;
  let issue;

  if (sizeRatio < minSize) {
    errorMagnitude = minSize - sizeRatio;
    const penalty = Math.min(1, errorMagnitude / minSize);
    score = Math.max(0, Math.round(100 * (1 - penalty)));

    if (score < config.minimumAcceptableScore) {
      issue = {
        metricType: "SUBJECT_SIZE" as const,
        severity: sizeRatio < minSize * 0.5 ? ("HIGH" as const) : ("MEDIUM" as const),
        message: "Subject is too small in frame. Move closer or zoom in.",
      };
    }
  } else if (sizeRatio > maxSize) {
    errorMagnitude = sizeRatio - maxSize;
    const overageSpan = 1.0 - maxSize;
    const penalty = Math.min(1, errorMagnitude / Math.max(0.01, overageSpan));
    score = Math.max(0, Math.round(100 * (1 - penalty)));

    if (score < config.minimumAcceptableScore) {
      issue = {
        metricType: "SUBJECT_SIZE" as const,
        severity: sizeRatio > 0.9 ? ("HIGH" as const) : ("MEDIUM" as const),
        message: "Subject is too close or cropped. Step back.",
      };
    }
  } else {
    score = 100;
  }

  return {
    metric: {
      type: "SUBJECT_SIZE",
      score,
      confidence: subject.confidence,
      errorMagnitude,
      explanation:
        score >= config.excellentScore
          ? "Subject scale is well-proportioned."
          : `Subject scale is ${(sizeRatio * 100).toFixed(1)}% of frame dimensions.`,
    },
    issue,
  };
}
