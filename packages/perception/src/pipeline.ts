import { evaluateComposition } from "@framesense/composition";
import type { FrameSenseConfig } from "@framesense/config";
import type {
  BoundingBox,
  CameraFrame,
  CompositionContext,
  PerceptionResult,
} from "@framesense/core";
import { createGuidanceEngine } from "@framesense/guidance";
import type {
  PerceptionAdapter,
  PerceptionProcessOptions,
  PipelineExecutionResult,
} from "./types.js";

function projectBoxToCrop(box: BoundingBox, crop: BoundingBox): BoundingBox | null {
  const cw = Math.max(0.01, crop.width);
  const ch = Math.max(0.01, crop.height);
  const x0 = (box.x - crop.x) / cw;
  const y0 = (box.y - crop.y) / ch;
  const x1 = (box.x + box.width - crop.x) / cw;
  const y1 = (box.y + box.height - crop.y) / ch;

  if (x1 <= 0 || x0 >= 1 || y1 <= 0 || y0 >= 1) {
    return null;
  }

  const clampedX0 = Math.max(0, Math.min(1, x0));
  const clampedY0 = Math.max(0, Math.min(1, y0));
  const clampedX1 = Math.max(0, Math.min(1, x1));
  const clampedY1 = Math.max(0, Math.min(1, y1));

  return {
    x: Number(clampedX0.toFixed(3)),
    y: Number(clampedY0.toFixed(3)),
    width: Number(Math.max(0, clampedX1 - clampedX0).toFixed(3)),
    height: Number(Math.max(0, clampedY1 - clampedY0).toFixed(3)),
  };
}

function projectPerceptionToCrop(
  perception: PerceptionResult,
  crop: BoundingBox | undefined,
): PerceptionResult {
  if (
    !crop ||
    (crop.x <= 0.002 && crop.y <= 0.002 && crop.width >= 0.996 && crop.height >= 0.996)
  ) {
    return perception;
  }

  const faces = perception.faces.flatMap((face) => {
    const projected = projectBoxToCrop(face.boundingBox, crop);
    return projected ? [{ ...face, boundingBox: projected }] : [];
  });

  const detections = perception.detections.flatMap((det) => {
    const projected = projectBoxToCrop(det.boundingBox, crop);
    return projected ? [{ ...det, boundingBox: projected }] : [];
  });

  return {
    ...perception,
    faces,
    detections,
  };
}

export interface PipelineProcessorOptions {
  readonly adapter: PerceptionAdapter;
  readonly config: FrameSenseConfig;
}

export class PipelineProcessor {
  private readonly adapter: PerceptionAdapter;
  private readonly config: FrameSenseConfig;
  private readonly guidanceEngine: ReturnType<typeof createGuidanceEngine>;

  constructor(options: PipelineProcessorOptions) {
    this.adapter = options.adapter;
    this.config = options.config;
    this.guidanceEngine = createGuidanceEngine({
      config: options.config.guidance,
      acceptableScore: options.config.composition.minimumAcceptableScore,
    });
  }

  /**
   * Executes the full pipeline for a camera frame:
   * CameraFrame -> Perception -> Composition -> Guidance -> Capture Decision
   */
  public async processFrame(
    frame: CameraFrame,
    options?: PerceptionProcessOptions,
  ): Promise<PipelineExecutionResult> {
    const startTime = performance.now();

    // 1. Perception & active crop/zoom projection
    const infCfg = this.config.inference;
    const rawPerception = await this.adapter.processFrame(frame, {
      ...options,
      horizonContrastThresholdDefault:
        options?.horizonContrastThresholdDefault ?? infCfg.horizonContrastThresholdDefault,
      horizonContrastThresholdWithFaces:
        options?.horizonContrastThresholdWithFaces ?? infCfg.horizonContrastThresholdWithFaces,
      qualityThresholds: options?.qualityThresholds ?? {
        lowLightThreshold: infCfg.lowLightThreshold,
        overexposedThreshold: infCfg.overexposedThreshold,
        clippedHighlightRatio: infCfg.clippedHighlightRatio,
        backlitSubjectThreshold: infCfg.backlitSubjectThreshold,
        backlitDeltaThreshold: infCfg.backlitDeltaThreshold,
        blurSharpnessThreshold: infCfg.blurSharpnessThreshold,
        blurMaxEdgeThreshold: infCfg.blurMaxEdgeThreshold,
      },
    });
    const perception = projectPerceptionToCrop(rawPerception, options?.cropRegion);
    const inferenceLatencyMs = Number((performance.now() - startTime).toFixed(2));

    // 2. Composition
    const compositionContext: CompositionContext = {
      frameId: frame.frameId,
      timestamp: frame.timestamp,
      frame: {
        width: frame.width,
        height: frame.height,
      },
      perception,
      scene: perception.scene?.type,
      template: options?.template,
    };

    const guidanceStart = performance.now();
    const composition = evaluateComposition(compositionContext, {
      config: this.config.composition,
      profileOverride: options?.profileOverride ?? perception.scene?.type,
      template: options?.template,
    });

    // 3. Guidance & Capture Decision
    const guidanceOutput = this.guidanceEngine.update(composition);
    const guidanceLatencyMs = Number((performance.now() - guidanceStart).toFixed(2));

    const processingTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      frameId: frame.frameId,
      timestamp: frame.timestamp,
      perception,
      composition,
      guidance: guidanceOutput.guidance,
      capture: guidanceOutput.capture,
      processingTimeMs,
      inferenceLatencyMs,
      guidanceLatencyMs,
    };
  }

  public reset(): void {
    this.guidanceEngine.reset();
  }
}
