export type FrameOrientation =
  "LANDSCAPE" | "PORTRAIT" | "LANDSCAPE_INVERTED" | "PORTRAIT_INVERTED";

export type CameraFrameSourceType = "WEBCAM" | "FILE" | "SYNTHETIC" | "UNKNOWN";

export interface CameraFrameSource {
  readonly type: CameraFrameSourceType;
  readonly label?: string;
  readonly deviceId?: string;
}

/**
 * Implementation-independent reference to frame data.
 *
 * Browser-specific objects such as HTMLVideoElement, Canvas, ImageBitmap, VideoFrame, and
 * MediaStream must stay in adapters outside the domain layer.
 */
export interface FramePayloadRef {
  readonly kind: "OPAQUE_REF";
  readonly refId: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface CameraFrame {
  readonly frameId: string;
  readonly timestamp: number;
  readonly width: number;
  readonly height: number;
  readonly orientation: FrameOrientation;
  readonly source: CameraFrameSource;
  readonly payload: FramePayloadRef;
}
