export interface RuntimeInfo {
  readonly name: string;
  readonly backend: string;
  readonly version?: string;
}

export interface MemoryUsage {
  readonly usedMb: number;
  readonly totalMb?: number;
}

export interface DiagnosticSample {
  readonly timestamp: number;
  readonly cameraFps: number;
  readonly processingFps: number;
  readonly inferenceLatencyMs: number;
  readonly guidanceLatencyMs: number;
  readonly endToEndLatencyMs: number;
  readonly runtime: RuntimeInfo;
  readonly memory?: MemoryUsage;
}
