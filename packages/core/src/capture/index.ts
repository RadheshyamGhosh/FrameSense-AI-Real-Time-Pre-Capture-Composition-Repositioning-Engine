export type StabilityState = "UNSTABLE" | "STABILIZING" | "STABLE" | "UNKNOWN";

export interface CaptureDecision {
  readonly ready: boolean;
  readonly reason: string;
  readonly score?: number;
  readonly stability: StabilityState;
  readonly confidence: number;
  readonly timestamp: number;
}
