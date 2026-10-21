import type { GuidanceAction, GuidancePriority } from "../guidance";

export type FeedbackChannel = "VISUAL" | "VOICE" | "HAPTIC";

export interface FeedbackCommand {
  readonly channel: FeedbackChannel;
  readonly action: GuidanceAction;
  readonly priority: GuidancePriority;
  readonly message: string;
  readonly timestamp: number;
  readonly durationMs?: number;
  readonly intensity?: number;
}
