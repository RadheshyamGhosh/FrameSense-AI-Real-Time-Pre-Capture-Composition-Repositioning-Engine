import type { GuidanceConfig } from "@framesense/config";
import type {
  CaptureDecision,
  GuidanceAction,
  GuidanceDirection,
  GuidancePriority,
  GuidanceResult,
  StabilityState,
} from "@framesense/core";

export interface ResolvedAction {
  readonly action: GuidanceAction;
  readonly direction: GuidanceDirection;
  readonly priority: GuidancePriority;
  readonly message: string;
  readonly reason: string;
}

export interface GuidanceEngineState {
  readonly currentGuidance: GuidanceResult | null;
  readonly lastGuidanceChangeTimestamp: number;
  readonly lastAnnouncementText: string | null;
  readonly announcementCount: number;
  readonly stabilityStartTime: number | null;
  readonly stabilityState: StabilityState;
  readonly framesProcessed: number;
}

export interface GuidanceEngineOutput {
  readonly guidance: GuidanceResult;
  readonly capture: CaptureDecision;
  readonly state: GuidanceEngineState;
}

export interface GuidanceEngineOptions {
  readonly config?: GuidanceConfig;
  readonly acceptableScore?: number;
}
