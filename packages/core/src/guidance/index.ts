export type GuidanceAction =
  | "NONE"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "MOVE_CLOSER"
  | "STEP_BACK"
  | "TILT_UP"
  | "TILT_DOWN"
  | "ROTATE_LEFT"
  | "ROTATE_RIGHT"
  | "HOLD"
  | "CAPTURE_READY";

export type GuidanceDirection =
  | "LEFT"
  | "RIGHT"
  | "UP"
  | "DOWN"
  | "FORWARD"
  | "BACKWARD"
  | "CLOCKWISE"
  | "COUNTERCLOCKWISE"
  | "NONE";

export type GuidancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface GuidanceResult {
  readonly action: GuidanceAction;
  readonly direction: GuidanceDirection;
  readonly priority: GuidancePriority;
  readonly confidence: number;
  readonly message: string;
  readonly timestamp: number;
  readonly reason?: string;
}
