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
}

export interface GuidanceConfig {
  readonly minimumGuidanceConfidence: number;
  readonly guidanceCooldownMs: number;
  readonly recommendationPersistenceMs: number;
  readonly stabilityDurationMs: number;
  readonly maximumRepeatedAnnouncements: number;
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
