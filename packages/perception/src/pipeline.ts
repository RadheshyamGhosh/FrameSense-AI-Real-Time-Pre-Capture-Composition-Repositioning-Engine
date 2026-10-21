import { evaluateComposition } from "@framesense/composition";
import type { FrameSenseConfig } from "@framesense/config";
import type { CameraFrame, CompositionContext } from "@framesense/core";
import { createGuidanceEngine } from "@framesense/guidance";
import type {
  PerceptionAdapter,
  PerceptionProcessOptions,
  PipelineExecutionResult,
} from "./types.js";

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

    // 1. Perception
    const perception = await this.adapter.processFrame(frame, options);

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
    };

    const composition = evaluateComposition(compositionContext, {
      config: this.config.composition,
      profileOverride: perception.scene?.type,
    });

    // 3. Guidance & Capture Decision
    const guidanceOutput = this.guidanceEngine.update(composition);

    const processingTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      frameId: frame.frameId,
      timestamp: frame.timestamp,
      perception,
      composition,
      guidance: guidanceOutput.guidance,
      capture: guidanceOutput.capture,
      processingTimeMs,
    };
  }

  public reset(): void {
    this.guidanceEngine.reset();
  }
}
