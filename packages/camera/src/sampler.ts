import type { CameraFrame, FrameOrientation } from "@framesense/core";
import type { ExtractedFrame } from "./types.js";

export interface FrameSamplerOptions {
  readonly targetFps?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly deviceId?: string;
  readonly orientation?: FrameOrientation;
}

export class FrameSampler {
  private readonly targetFps: number;
  private readonly maxWidth: number;
  private readonly maxHeight: number;
  private readonly deviceId?: string;
  private readonly orientation: FrameOrientation;
  private readonly minIntervalMs: number;

  private frameCounter = 0;
  private lastSampleTime = 0;
  private isSampling = false;
  private rafId: number | null = null;

  constructor(options?: FrameSamplerOptions) {
    this.targetFps = options?.targetFps ?? 15;
    this.maxWidth = options?.maxWidth ?? 640;
    this.maxHeight = options?.maxHeight ?? 360;
    this.deviceId = options?.deviceId;
    this.orientation = options?.orientation ?? "LANDSCAPE";
    this.minIntervalMs = 1000 / this.targetFps;
  }

  /**
   * Samples a single downscaled ImageBitmap and creates a domain CameraFrame.
   */
  public async captureFrameFromVideo(
    videoElement: HTMLVideoElement,
    timestamp: number = Date.now(),
  ): Promise<ExtractedFrame | null> {
    const videoWidth = videoElement.videoWidth || 1920;
    const videoHeight = videoElement.videoHeight || 1080;

    if (videoWidth === 0 || videoHeight === 0) {
      return null;
    }

    // Calculate aspect-preserving downscaled dimensions
    const scale = Math.min(1, this.maxWidth / videoWidth, this.maxHeight / videoHeight);
    const targetWidth = Math.round(videoWidth * scale);
    const targetHeight = Math.round(videoHeight * scale);

    this.frameCounter++;
    const frameId = `frame_${this.frameCounter}_${timestamp}`;

    let bitmap: ImageBitmap | undefined;

    // Use browser createImageBitmap if available
    if (typeof createImageBitmap !== "undefined") {
      try {
        bitmap = await createImageBitmap(videoElement, {
          resizeWidth: targetWidth,
          resizeHeight: targetHeight,
          resizeQuality: "medium",
        });
      } catch {
        // Fallback or ignore if video isn't ready
      }
    }

    const cameraFrame: CameraFrame = {
      frameId,
      timestamp,
      width: targetWidth,
      height: targetHeight,
      orientation: this.orientation,
      source: {
        type: "WEBCAM",
        deviceId: this.deviceId,
        label: "Primary Webcam",
      },
      payload: {
        kind: "OPAQUE_REF",
        refId: frameId,
        metadata: {
          originalWidth: videoWidth,
          originalHeight: videoHeight,
          scale,
        },
      },
    };

    return {
      cameraFrame,
      bitmap,
    };
  }

  /**
   * Starts an interval-throttled sampling loop from a video element.
   */
  public startSampling(
    videoElement: HTMLVideoElement,
    onFrame: (extracted: ExtractedFrame) => void,
  ): void {
    if (this.isSampling) return;
    this.isSampling = true;

    const loop = async () => {
      if (!this.isSampling) return;

      const now = performance.now();
      const elapsed = now - this.lastSampleTime;

      if (elapsed >= this.minIntervalMs) {
        this.lastSampleTime = now;
        const extracted = await this.captureFrameFromVideo(videoElement, Date.now());
        if (extracted) {
          onFrame(extracted);
        }
      }

      if (this.isSampling) {
        if (typeof requestAnimationFrame !== "undefined") {
          this.rafId = requestAnimationFrame(loop);
        } else {
          setTimeout(loop, this.minIntervalMs);
        }
      }
    };

    if (typeof requestAnimationFrame !== "undefined") {
      this.rafId = requestAnimationFrame(loop);
    } else {
      setTimeout(loop, this.minIntervalMs);
    }
  }

  /**
   * Stops the sampling loop.
   */
  public stopSampling(): void {
    this.isSampling = false;
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
