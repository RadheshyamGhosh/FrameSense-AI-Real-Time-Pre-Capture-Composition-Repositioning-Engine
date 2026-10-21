import type { CaptureDecision, CompositionResult, StabilityState } from "@framesense/core";

export interface StabilityEvaluationResult {
  readonly captureDecision: CaptureDecision;
  readonly nextStabilityStartTime: number | null;
  readonly stabilityState: StabilityState;
}

/**
 * Tracks stability duration and determines auto-shutter capture readiness.
 */
export function evaluateCaptureStability(
  composition: CompositionResult,
  acceptableScore: number,
  stabilityStartTime: number | null,
  stabilityDurationMs: number,
  timestamp: number,
): StabilityEvaluationResult {
  const hasSevereIssue = composition.issues.some((i) => i.severity === "HIGH");
  const isSatisfactory = composition.overallScore >= acceptableScore && !hasSevereIssue;

  if (!isSatisfactory) {
    const reason =
      composition.issues[0]?.message ??
      `Composition score (${composition.overallScore}) below required threshold (${acceptableScore}).`;

    return {
      captureDecision: {
        ready: false,
        reason,
        score: composition.overallScore,
        stability: "UNSTABLE",
        confidence: 0.8,
        timestamp,
      },
      nextStabilityStartTime: null,
      stabilityState: "UNSTABLE",
    };
  }

  // Framing is satisfactory!
  if (stabilityStartTime === null) {
    return {
      captureDecision: {
        ready: false,
        reason: "Framing achieved. Holding steady to confirm stability...",
        score: composition.overallScore,
        stability: "STABILIZING",
        confidence: 0.9,
        timestamp,
      },
      nextStabilityStartTime: timestamp,
      stabilityState: "STABILIZING",
    };
  }

  const elapsed = timestamp - stabilityStartTime;
  if (elapsed < stabilityDurationMs) {
    const remainingMs = stabilityDurationMs - elapsed;
    return {
      captureDecision: {
        ready: false,
        reason: `Stabilizing frame... ${remainingMs}ms remaining.`,
        score: composition.overallScore,
        stability: "STABILIZING",
        confidence: 0.95,
        timestamp,
      },
      nextStabilityStartTime: stabilityStartTime,
      stabilityState: "STABILIZING",
    };
  }

  // Sustained stability duration met -> CAPTURE READY!
  return {
    captureDecision: {
      ready: true,
      reason: `Optimal framing sustained for ${elapsed}ms. Auto-shutter ready!`,
      score: composition.overallScore,
      stability: "STABLE",
      confidence: 1.0,
      timestamp,
    },
    nextStabilityStartTime: stabilityStartTime,
    stabilityState: "STABLE",
  };
}
