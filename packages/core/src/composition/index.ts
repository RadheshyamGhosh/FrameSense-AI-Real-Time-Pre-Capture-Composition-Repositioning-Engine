import type { BoundingBox, Point2D } from "../geometry";
import type { FrameQualityMetrics, PerceptionResult, SceneType } from "../perception";

export interface FrameDimensions {
  readonly width: number;
  readonly height: number;
}

export interface CompositionContext {
  readonly frameId: string;
  readonly timestamp: number;
  readonly frame: FrameDimensions;
  readonly perception: PerceptionResult;
  readonly scene?: SceneType;
}

export type CompositionMetricType =
  | "RULE_OF_THIRDS"
  | "HEADROOM"
  | "SUBJECT_POSITION"
  | "SUBJECT_SIZE"
  | "HORIZON_ALIGNMENT"
  | "SYMMETRY"
  | "NEGATIVE_SPACE";

export interface CompositionMetric {
  readonly type: CompositionMetricType;
  readonly score: number;
  readonly confidence: number;
  readonly errorMagnitude?: number;
  readonly explanation?: string;
}

export interface CompositionIssue {
  readonly metricType: CompositionMetricType;
  readonly severity: "LOW" | "MEDIUM" | "HIGH";
  readonly message: string;
}

export interface CompositionResult {
  readonly frameId: string;
  readonly timestamp: number;
  readonly overallScore: number;
  readonly metrics: readonly CompositionMetric[];
  readonly issues: readonly CompositionIssue[];
  readonly profile: SceneType;
  /** Primary tracked subject box in normalized 0..1 coordinates (when detected). */
  readonly primarySubjectBounds?: BoundingBox;
  /** Visual focal point (e.g. eye-line) in normalized 0..1 coordinates (when detected). */
  readonly primaryFocalPoint?: Point2D;
  /** Signed horizon tilt angle in degrees (when detected). */
  readonly horizonAngleDegrees?: number;
  /** Deterministic lighting, exposure, and motion-blur assessment. */
  readonly frameQuality?: FrameQualityMetrics;
}
