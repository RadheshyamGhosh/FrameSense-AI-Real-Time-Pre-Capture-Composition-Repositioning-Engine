export type StabilityState = "UNSTABLE" | "STABILIZING" | "STABLE" | "UNKNOWN";

export interface CaptureDecision {
  readonly ready: boolean;
  readonly reason: string;
  readonly score?: number;
  readonly stability: StabilityState;
  /** Normalized 0..1 progress across the stability dwell duration. */
  readonly stabilityProgress?: number;
  readonly confidence: number;
  readonly timestamp: number;
}
