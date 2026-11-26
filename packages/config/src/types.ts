export interface CompositionConfig {
  /**
   * Scores use a 0..100 scale. Initial tuning values are not empirically validated.
   */
  readonly minimumAcceptableScore: number;
  readonly excellentScore: number;
  /**
   * Normalized 0..1 tolerance around rule-of-thirds guide lines.
   */
  readonly ruleOfThirdsTolerance: number;
  readonly minimumHeadroomRatio: number;
  readonly maximumHeadroomRatio?: number;
  readonly minimumSubjectSizeRatio: number;
  readonly maximumSubjectSizeRatio: number;
  /**
   * Maximum acceptable horizon deviation in degrees.
   */
  readonly maximumHorizonAngleDegrees: number;
  readonly minimumConfidence: number;
}

export interface InferenceConfig {
  /**
   * Target FPS is a desired scheduling value, not measured runtime FPS.
   */
  readonly targetInferenceFps: number;
  readonly minimumInferenceIntervalMs: number;
  readonly modelConfidenceThreshold: number;
  readonly maximumProcessingWidth: number;
  readonly maximumProcessingHeight: number;
  readonly inferenceEnabled: boolean;
  readonly lowLightThreshold?: number;
  readonly overexposedThreshold?: number;
  readonly clippedHighlightRatio?: number;
  readonly backlitSubjectThreshold?: number;
  readonly backlitDeltaThreshold?: number;
  readonly blurSharpnessThreshold?: number;
  readonly blurMaxEdgeThreshold?: number;
  readonly horizonContrastThresholdDefault?: number;
  readonly horizonContrastThresholdWithFaces?: number;
}

export interface GuidanceConfig {
  readonly minimumGuidanceConfidence: number;
  readonly guidanceCooldownMs: number;
  readonly recommendationPersistenceMs: number;
  readonly stabilityDurationMs: number;
  readonly maximumRepeatedAnnouncements: number;
  readonly voiceMinIntervalMs?: number;
}

export interface PerformanceConfig {
  /**
   * These are engineering targets, not measured benchmark results.
   */
  readonly targetCameraFps: number;
  readonly targetProcessingFps: number;
  readonly targetInferenceLatencyMs: number;
  readonly targetEndToEndLatencyMs: number;
  readonly diagnosticsSamplingIntervalMs: number;
}

export interface FrameSenseConfig {
  readonly composition: CompositionConfig;
  readonly inference: InferenceConfig;
  readonly guidance: GuidanceConfig;
  readonly performance: PerformanceConfig;
}

export interface ConfigValidationIssue {
  readonly path: string;
  readonly message: string;
}
