import type { BoundingBox, Point2D } from "../geometry";

export type DetectionCategory = string;

export interface Detection {
  readonly category: DetectionCategory;
  readonly confidence: number;
  readonly boundingBox: BoundingBox;
  readonly trackingId?: string;
}

export interface FaceResult {
  readonly boundingBox: BoundingBox;
  readonly confidence: number;
  readonly landmarks?: readonly Point2D[];
}

export interface PoseLandmark {
  readonly position: Point2D;
  readonly visibility?: number;
  readonly confidence?: number;
}

export interface PoseResult {
  readonly landmarks: readonly PoseLandmark[];
  readonly confidence: number;
  readonly boundingBox?: BoundingBox;
}

export interface HorizonLine {
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface HorizonResult {
  readonly detected: boolean;
  /**
   * Horizon angle in degrees.
   */
  readonly angleDegrees?: number;
  readonly confidence: number;
  readonly line?: HorizonLine;
}

export type SceneType = "PORTRAIT" | "GROUP" | "LANDSCAPE" | "ARCHITECTURE" | "FOOD" | "UNKNOWN";

export interface SceneResult {
  readonly type: SceneType;
  readonly confidence: number;
}

export interface PerceptionMetadata {
  readonly processingTimeMs?: number;
  readonly frameAgeMs?: number;
  readonly backend?: string;
}

export interface PerceptionResult {
  readonly frameId: string;
  readonly timestamp: number;
  readonly detections: readonly Detection[];
  readonly faces: readonly FaceResult[];
  readonly poses: readonly PoseResult[];
  readonly horizon?: HorizonResult;
  readonly scene?: SceneResult;
  readonly metadata?: PerceptionMetadata;
}
