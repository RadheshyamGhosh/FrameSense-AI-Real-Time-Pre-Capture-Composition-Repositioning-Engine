import type { PerformanceConfig } from "@framesense/config";
import type {
  DiagnosticSample,
  MemoryUsage,
  RuntimeInfo,
} from "@framesense/core";

export interface DiagnosticsCollectorOptions {
  readonly maxWindowSize?: number;
  readonly runtimeInfo?: RuntimeInfo;
}

export interface PerformanceCompliance {
  readonly meetsCameraFps: boolean;
  readonly meetsProcessingFps: boolean;
  readonly meetsInferenceLatency: boolean;
  readonly meetsEndToEndLatency: boolean;
  readonly allPass: boolean;
}

export class DiagnosticsCollector {
  private readonly maxWindowSize: number;
  private readonly runtime: RuntimeInfo;

  private cameraTimestamps: number[] = [];
  private processingTimestamps: number[] = [];
  private inferenceLatencies: number[] = [];
  private guidanceLatencies: number[] = [];
  private endToEndLatencies: number[] = [];

  constructor(options?: DiagnosticsCollectorOptions) {
    this.maxWindowSize = options?.maxWindowSize ?? 30;
    this.runtime = options?.runtimeInfo ?? {
      name: "FrameSense AI Browser Runtime",
      backend: "web-worker",
      version: "0.1.0",
    };
  }

  /**
   * Records a raw camera frame capture event.
   */
  public recordCameraFrame(timestamp: number = performance.now()): void {
    this.cameraTimestamps.push(timestamp);
    if (this.cameraTimestamps.length > this.maxWindowSize) {
      this.cameraTimestamps.shift();
    }
  }

  /**
   * Records a completed pipeline processing cycle.
   */
  public recordProcessingCycle(
    timestamp: number,
    inferenceLatencyMs: number,
    guidanceLatencyMs: number,
    endToEndLatencyMs: number,
  ): void {
    this.processingTimestamps.push(timestamp);
    this.inferenceLatencies.push(inferenceLatencyMs);
    this.guidanceLatencies.push(guidanceLatencyMs);
    this.endToEndLatencies.push(endToEndLatencyMs);

    if (this.processingTimestamps.length > this.maxWindowSize) {
      this.processingTimestamps.shift();
      this.inferenceLatencies.shift();
      this.guidanceLatencies.shift();
      this.endToEndLatencies.shift();
    }
  }

  /**
   * Generates a snapshot of current telemetry against rolling statistics.
   */
  public sample(timestamp: number = performance.now()): DiagnosticSample {
    const cameraFps = this.calculateFps(this.cameraTimestamps);
    const processingFps = this.calculateFps(this.processingTimestamps);

    const inferenceLatencyMs = this.calculateAverage(this.inferenceLatencies);
    const guidanceLatencyMs = this.calculateAverage(this.guidanceLatencies);
    const endToEndLatencyMs = this.calculateAverage(this.endToEndLatencies);

    const memory = this.getMemoryUsage();

    return {
      timestamp: Math.round(timestamp),
      cameraFps,
      processingFps,
      inferenceLatencyMs,
      guidanceLatencyMs,
      endToEndLatencyMs,
      runtime: this.runtime,
      memory,
    };
  }

  /**
   * Evaluates a telemetry sample against the configured performance targets.
   */
  public checkCompliance(
    sample: DiagnosticSample,
    target: PerformanceConfig,
  ): PerformanceCompliance {
    // Camera FPS passes if it achieves at least 80% of target (e.g. 24 of 30 fps)
    const meetsCameraFps = sample.cameraFps >= target.targetCameraFps * 0.8;
    // Processing FPS passes if it achieves at least 80% of target (e.g. 12 of 15 fps)
    const meetsProcessingFps = sample.processingFps >= target.targetProcessingFps * 0.8;
    // Latencies pass if they are less than or equal to targets
    const meetsInferenceLatency =
      sample.inferenceLatencyMs <= target.targetInferenceLatencyMs || sample.inferenceLatencyMs === 0;
    const meetsEndToEndLatency =
      sample.endToEndLatencyMs <= target.targetEndToEndLatencyMs || sample.endToEndLatencyMs === 0;

    const allPass =
      meetsCameraFps && meetsProcessingFps && meetsInferenceLatency && meetsEndToEndLatency;

    return {
      meetsCameraFps,
      meetsProcessingFps,
      meetsInferenceLatency,
      meetsEndToEndLatency,
      allPass,
    };
  }

  public reset(): void {
    this.cameraTimestamps = [];
    this.processingTimestamps = [];
    this.inferenceLatencies = [];
    this.guidanceLatencies = [];
    this.endToEndLatencies = [];
  }

  private calculateFps(timestamps: number[]): number {
    if (timestamps.length < 2) return 0;
    const duration = timestamps[timestamps.length - 1] - timestamps[0];
    if (duration <= 0) return 0;
    const fps = ((timestamps.length - 1) / duration) * 1000;
    return Number(fps.toFixed(1));
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return Number((sum / values.length).toFixed(1));
  }

  private getMemoryUsage(): MemoryUsage | undefined {
    // In Chromium browsers, performance.memory is available
    if (
      typeof performance !== "undefined" &&
      "memory" in performance &&
      performance.memory &&
      typeof performance.memory === "object"
    ) {
      const mem = performance.memory as { usedJSHeapSize: number; totalJSHeapSize?: number };
      const usedMb = Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(1));
      const totalMb = mem.totalJSHeapSize
        ? Number((mem.totalJSHeapSize / (1024 * 1024)).toFixed(1))
        : undefined;

      return { usedMb, totalMb };
    }
    return undefined;
  }
}
