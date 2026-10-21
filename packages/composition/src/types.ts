import type {
  BoundingBox,
  CompositionIssue,
  CompositionMetric,
  Point2D,
  SceneType,
} from "@framesense/core";
import type { CompositionConfig } from "@framesense/config";

export interface MetricEvaluationResult {
  readonly metric: CompositionMetric;
  readonly issue?: CompositionIssue;
}

export interface PrimarySubject {
  readonly boundingBox: BoundingBox;
  readonly center: Point2D;
  readonly focalPoint: Point2D;
  readonly confidence: number;
  readonly source: "FACE" | "POSE" | "DETECTION" | "FRAME_CENTER";
}

export interface CompositionEvaluationOptions {
  readonly config?: CompositionConfig;
  readonly profileOverride?: SceneType;
}

export type SceneWeights = Record<string, number>;
