import type {
  CameraFrame,
  FaceResult,
  HorizonResult,
  PerceptionResult,
} from "@framesense/core";
import { classifyScene } from "./scene.js";
import type { PerceptionAdapter } from "./types.js";

export type MockPerceptionPreset =
  | "PERFECT_PORTRAIT"
  | "CUTOFF_HEADROOM"
  | "EXCESS_HEADROOM"
  | "SUBJECT_TOO_SMALL"
  | "SUBJECT_TOO_LARGE"
  | "TILTED_HORIZON"
  | "GROUP_PHOTO"
  | "LANDSCAPE"
  | "EMPTY";

export class MockPerceptionAdapter implements PerceptionAdapter {
  private preset: MockPerceptionPreset;
  private customOverrides: Partial<PerceptionResult> | null = null;

  constructor(initialPreset: MockPerceptionPreset = "PERFECT_PORTRAIT") {
    this.preset = initialPreset;
  }

  public setPreset(preset: MockPerceptionPreset): void {
    this.preset = preset;
    this.customOverrides = null;
  }

  public setCustomOverrides(overrides: Partial<PerceptionResult>): void {
    this.customOverrides = overrides;
  }

  public async processFrame(frame: CameraFrame): Promise<PerceptionResult> {
    const startTime = performance.now();

    if (this.customOverrides) {
      const faces = this.customOverrides.faces ?? [];
      const detections = this.customOverrides.detections ?? [];
      const horizon = this.customOverrides.horizon;
      const scene = this.customOverrides.scene ?? classifyScene({ faces, detections, horizon });

      return {
        frameId: frame.frameId,
        timestamp: frame.timestamp,
        detections,
        faces,
        poses: this.customOverrides.poses ?? [],
        horizon,
        scene,
        metadata: {
          processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
          backend: "mock",
        },
        ...this.customOverrides,
      };
    }

    const { faces, horizon, detections, poses } = this.getPresetData(this.preset);
    const scene = classifyScene({ faces, detections, horizon });

    return {
      frameId: frame.frameId,
      timestamp: frame.timestamp,
      detections,
      faces,
      poses,
      horizon,
      scene,
      metadata: {
        processingTimeMs: Number((performance.now() - startTime).toFixed(2)),
        backend: "mock",
      },
    };
  }

  private getPresetData(preset: MockPerceptionPreset) {
    switch (preset) {
      case "PERFECT_PORTRAIT":
        return {
          faces: [
            {
              boundingBox: { x: 0.35, y: 0.12, width: 0.3, height: 0.38 },
              confidence: 0.95,
            },
          ] as FaceResult[],
          horizon: {
            detected: true,
            angleDegrees: 0.5,
            confidence: 0.9,
          } as HorizonResult,
          detections: [],
          poses: [],
        };

      case "CUTOFF_HEADROOM":
        return {
          faces: [
            {
              boundingBox: { x: 0.35, y: 0.01, width: 0.3, height: 0.4 },
              confidence: 0.9,
            },
          ] as FaceResult[],
          horizon: undefined,
          detections: [],
          poses: [],
        };

      case "EXCESS_HEADROOM":
        return {
          faces: [
            {
              boundingBox: { x: 0.35, y: 0.45, width: 0.3, height: 0.3 },
              confidence: 0.9,
            },
          ] as FaceResult[],
          horizon: undefined,
          detections: [],
          poses: [],
        };

      case "SUBJECT_TOO_SMALL":
        return {
          faces: [
            {
              boundingBox: { x: 0.47, y: 0.2, width: 0.06, height: 0.08 },
              confidence: 0.85,
            },
          ] as FaceResult[],
          horizon: undefined,
          detections: [],
          poses: [],
        };

      case "SUBJECT_TOO_LARGE":
        return {
          faces: [
            {
              boundingBox: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
              confidence: 0.92,
            },
          ] as FaceResult[],
          horizon: undefined,
          detections: [],
          poses: [],
        };

      case "TILTED_HORIZON":
        return {
          faces: [],
          horizon: {
            detected: true,
            angleDegrees: 6.8,
            confidence: 0.92,
          } as HorizonResult,
          detections: [],
          poses: [],
        };

      case "GROUP_PHOTO":
        return {
          faces: [
            {
              boundingBox: { x: 0.2, y: 0.2, width: 0.2, height: 0.25 },
              confidence: 0.9,
            },
            {
              boundingBox: { x: 0.6, y: 0.2, width: 0.2, height: 0.25 },
              confidence: 0.9,
            },
          ] as FaceResult[],
          horizon: undefined,
          detections: [],
          poses: [],
        };

      case "LANDSCAPE":
        return {
          faces: [],
          horizon: {
            detected: true,
            angleDegrees: 0.2,
            confidence: 0.95,
          } as HorizonResult,
          detections: [],
          poses: [],
        };

      case "EMPTY":
      default:
        return {
          faces: [],
          horizon: undefined,
          detections: [],
          poses: [],
        };
    }
  }
}
