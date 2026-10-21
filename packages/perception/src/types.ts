import type {
  CameraFrame,
  CaptureDecision,
  CompositionResult,
  GuidanceResult,
  PerceptionResult,
} from "@framesense/core";

export interface PixelDataBuffer {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface PerceptionProcessOptions {
  readonly detectFaces?: boolean;
  readonly detectPoses?: boolean;
  readonly detectHorizon?: boolean;
  readonly classifyScene?: boolean;
  readonly pixelData?: PixelDataBuffer;
}

export interface PerceptionAdapter {
  processFrame(
    frame: CameraFrame,
    options?: PerceptionProcessOptions,
  ): Promise<PerceptionResult>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}

export interface PipelineExecutionResult {
  readonly frameId: string;
  readonly timestamp: number;
  readonly perception: PerceptionResult;
  readonly composition: CompositionResult;
  readonly guidance: GuidanceResult;
  readonly capture: CaptureDecision;
  readonly processingTimeMs: number;
}
