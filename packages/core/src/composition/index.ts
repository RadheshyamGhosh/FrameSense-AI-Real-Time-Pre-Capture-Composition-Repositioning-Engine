import type { PerceptionResult, SceneType } from "../perception";

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
}
