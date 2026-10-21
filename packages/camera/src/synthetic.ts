import type { CameraFrame, FrameOrientation } from "@framesense/core";

export interface SyntheticCameraOptions {
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
  readonly orientation?: FrameOrientation;
}

export class SyntheticCameraSource {
  private readonly width: number;
  private readonly height: number;
  private readonly fps: number;
  private readonly orientation: FrameOrientation;
  private readonly intervalMs: number;

  private frameCounter = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: SyntheticCameraOptions) {
    this.width = options?.width ?? 640;
    this.height = options?.height ?? 360;
    this.fps = options?.fps ?? 15;
    this.orientation = options?.orientation ?? "LANDSCAPE";
    this.intervalMs = Math.round(1000 / this.fps);
  }

  /**
   * Generates a single deterministic synthetic camera frame.
   */
  public createFrame(timestamp: number = Date.now()): CameraFrame {
    this.frameCounter++;
    const frameId = `synthetic_frame_${this.frameCounter}_${timestamp}`;

    return {
      frameId,
      timestamp,
      width: this.width,
      height: this.height,
      orientation: this.orientation,
      source: {
        type: "SYNTHETIC",
        deviceId: "synthetic_device_001",
        label: "Simulated Test Camera",
      },
      payload: {
        kind: "OPAQUE_REF",
        refId: frameId,
        metadata: {
          synthetic: true,
          resolution: `${this.width}x${this.height}`,
        },
      },
    };
  }

  /**
   * Starts continuous streaming of synthetic frames at target FPS.
   */
  public start(onFrame: (frame: CameraFrame) => void): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const frame = this.createFrame();
      onFrame(frame);
    }, this.intervalMs);
  }

  /**
   * Stops the synthetic camera streaming.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getFrameCount(): number {
    return this.frameCounter;
  }
}
