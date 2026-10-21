import type {
  CameraFrame,
  CaptureDecision,
  CompositionResult,
  GuidanceResult,
} from "@framesense/core";
import type { FrameSenseConfig } from "@framesense/config";

export type CameraStatus =
  | "IDLE"
  | "INITIALIZING"
  | "STREAMING"
  | "PAUSED"
  | "ERROR";

export interface CameraDeviceInfo {
  readonly deviceId: string;
  readonly label: string;
  readonly groupId?: string;
}

export interface CameraConstraintsConfig {
  readonly deviceId?: string;
  readonly width?: number;
  readonly height?: number;
  readonly targetFps?: number;
  readonly facingMode?: "user" | "environment";
  readonly aspectRatio?: number;
}

export type CameraErrorCode =
  | "NOT_SUPPORTED"
  | "PERMISSION_DENIED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_IN_USE"
  | "OVERCONSTRAINED"
  | "UNKNOWN";

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.name = "CameraError";
    this.code = code;
  }
}

export interface ExtractedFrame {
  readonly cameraFrame: CameraFrame;
  readonly bitmap?: ImageBitmap;
}

export type WorkerInboundMessage =
  | { readonly type: "INIT"; readonly config: FrameSenseConfig }
  | {
      readonly type: "PROCESS_FRAME";
      readonly frameId: string;
      readonly timestamp: number;
      readonly width: number;
      readonly height: number;
      readonly bitmap?: ImageBitmap;
    }
  | { readonly type: "RESET" };

export type WorkerOutboundMessage =
  | { readonly type: "READY" }
  | {
      readonly type: "FRAME_PROCESSED";
      readonly frameId: string;
      readonly timestamp: number;
      readonly processingTimeMs: number;
      readonly composition: CompositionResult;
      readonly guidance: GuidanceResult;
      readonly capture: CaptureDecision;
    }
  | { readonly type: "ERROR"; readonly error: string };
