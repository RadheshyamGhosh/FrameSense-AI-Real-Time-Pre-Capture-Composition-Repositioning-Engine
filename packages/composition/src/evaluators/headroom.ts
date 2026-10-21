import type { CompositionConfig } from "@framesense/config";
import type { MetricEvaluationResult, PrimarySubject } from "../types.js";

/**
 * Evaluates headroom (distance between top of frame and top of head/subject).
 */
export function evaluateHeadroom(
  subject: PrimarySubject,
  config: CompositionConfig,
): MetricEvaluationResult {
  if (subject.source === "FRAME_CENTER" && subject.confidence === 0) {
    return {
      metric: {
        type: "HEADROOM",
        score: 50,
        confidence: 0,
        explanation: "No subject detected to evaluate headroom.",
      },
    };
  }

  const headroom = subject.boundingBox.y;
  const minHeadroom = config.minimumHeadroomRatio; // e.g. 0.08
  // Maximum desirable headroom before subject looks dropped down into the bottom of the frame
  const maxHeadroom = 0.22;

  let score: number;
  let errorMagnitude = 0;
  let issue;

  if (headroom < minHeadroom) {
    // Headroom is too small (head near/exceeding top crop)
    errorMagnitude = minHeadroom - headroom;
    const penalty = Math.min(1, errorMagnitude / minHeadroom);
    score = Math.max(0, Math.round(100 * (1 - penalty)));

    const severity = headroom <= 0.02 ? ("HIGH" as const) : ("MEDIUM" as const);
    issue = {
      metricType: "HEADROOM" as const,
      severity,
      message:
        headroom <= 0.02
          ? "Head is cut off at the top. Tilt up or step back."
          : "Not enough headroom above subject. Tilt camera up slightly.",
    };
  } else if (headroom > maxHeadroom) {
    // Too much headroom (wasted space above, body dropped low)
    errorMagnitude = headroom - maxHeadroom;
    const excessSpan = 0.3; // at 0.52 headroom, penalty is 100%
    const penalty = Math.min(1, errorMagnitude / excessSpan);
    score = Math.max(0, Math.round(100 * (1 - penalty)));

    if (score < config.minimumAcceptableScore) {
      const severity = headroom > 0.35 ? ("HIGH" as const) : ("MEDIUM" as const);
      issue = {
        metricType: "HEADROOM" as const,
        severity,
        message: "Excessive empty space above head. Tilt camera down or raise camera.",
      };
    }
  } else {
    // Ideal headroom range
    score = 100;
  }

  return {
    metric: {
      type: "HEADROOM",
      score,
      confidence: subject.confidence,
      errorMagnitude,
      explanation:
        score >= config.excellentScore
          ? "Headroom is properly balanced."
          : `Headroom ratio is ${(headroom * 100).toFixed(1)}% of frame height.`,
    },
    issue,
  };
}
