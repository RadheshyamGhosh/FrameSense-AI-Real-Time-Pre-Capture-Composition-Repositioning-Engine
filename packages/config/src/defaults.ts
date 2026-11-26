import type { FrameSenseConfig } from "./types.js";

/**
 * Browser-safe default configuration matching configs/{composition,guidance,inference,performance}/default.json.
 */
export const DEFAULT_FRAMESENSE_CONFIG: FrameSenseConfig = Object.freeze({
  composition: {
    minimumAcceptableScore: 70,
    excellentScore: 90,
    ruleOfThirdsTolerance: 0.08,
    minimumHeadroomRatio: 0.08,
    maximumHeadroomRatio: 0.22,
    minimumSubjectSizeRatio: 0.18,
    maximumSubjectSizeRatio: 0.72,
    maximumHorizonAngleDegrees: 3,
    minimumConfidence: 0.6,
  },
  guidance: {
    minimumGuidanceConfidence: 0.65,
    guidanceCooldownMs: 1200,
    recommendationPersistenceMs: 500,
    stabilityDurationMs: 750,
    maximumRepeatedAnnouncements: 2,
    voiceMinIntervalMs: 2200,
  },
  inference: {
    targetInferenceFps: 10,
    minimumInferenceIntervalMs: 100,
    modelConfidenceThreshold: 0.55,
    maximumProcessingWidth: 640,
    maximumProcessingHeight: 360,
    inferenceEnabled: true,
    lowLightThreshold: 0.18,
    overexposedThreshold: 0.88,
    clippedHighlightRatio: 0.4,
    backlitSubjectThreshold: 0.3,
    backlitDeltaThreshold: 0.32,
    blurSharpnessThreshold: 3.5,
    blurMaxEdgeThreshold: 28,
    horizonContrastThresholdDefault: 25,
    horizonContrastThresholdWithFaces: 42,
  },
  performance: {
    targetCameraFps: 30,
    targetProcessingFps: 15,
    targetInferenceLatencyMs: 75,
    targetEndToEndLatencyMs: 150,
    diagnosticsSamplingIntervalMs: 1000,
  },
});
