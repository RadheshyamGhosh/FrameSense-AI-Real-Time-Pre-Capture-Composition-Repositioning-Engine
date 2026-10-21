import type { GuidanceConfig } from "@framesense/config";
import type { CompositionResult, GuidanceResult } from "@framesense/core";
import { resolvePrimaryAction } from "./resolver.js";
import { evaluateCaptureStability } from "./stability.js";
import type {
  GuidanceEngineOptions,
  GuidanceEngineOutput,
  GuidanceEngineState,
} from "./types.js";

export const DEFAULT_GUIDANCE_CONFIG: GuidanceConfig = Object.freeze({
  minimumGuidanceConfidence: 0.65,
  guidanceCooldownMs: 1200,
  recommendationPersistenceMs: 500,
  stabilityDurationMs: 750,
  maximumRepeatedAnnouncements: 2,
});

export const INITIAL_GUIDANCE_STATE: GuidanceEngineState = Object.freeze({
  currentGuidance: null,
  lastGuidanceChangeTimestamp: 0,
  lastAnnouncementText: null,
  announcementCount: 0,
  stabilityStartTime: null,
  stabilityState: "UNKNOWN",
  framesProcessed: 0,
});

/**
 * Pure state transition function processing one composition frame.
 */
export function processGuidanceFrame(
  state: GuidanceEngineState,
  composition: CompositionResult,
  options?: GuidanceEngineOptions,
): GuidanceEngineOutput {
  const config = options?.config ?? DEFAULT_GUIDANCE_CONFIG;
  const acceptableScore = options?.acceptableScore ?? 70;
  const timestamp = composition.timestamp;

  // 1. Evaluate stability and capture readiness
  const stabilityResult = evaluateCaptureStability(
    composition,
    acceptableScore,
    state.stabilityStartTime,
    config.stabilityDurationMs,
    timestamp,
  );

  // 2. Resolve primary guidance action
  const resolved = resolvePrimaryAction(composition, acceptableScore);

  let finalAction = resolved.action;
  let finalDirection = resolved.direction;
  let finalPriority = resolved.priority;
  let finalMessage = resolved.message;
  let finalReason = resolved.reason;

  // If capture is confirmed ready, promote to CAPTURE_READY action
  if (stabilityResult.captureDecision.ready) {
    finalAction = "CAPTURE_READY";
    finalDirection = "NONE";
    finalPriority = "URGENT";
    finalMessage = "Perfect! Capturing...";
    finalReason = "Frame composition is optimal and stable.";
  } else if (stabilityResult.stabilityState === "STABILIZING") {
    finalAction = "HOLD";
    finalDirection = "NONE";
    finalPriority = "MEDIUM";
    finalMessage = "Hold steady...";
    finalReason = "Stabilizing camera before capture.";
  }

  // 3. Hysteresis & persistence check
  let shouldSwitchGuidance = true;

  if (state.currentGuidance) {
    const elapsedSinceChange = timestamp - state.lastGuidanceChangeTimestamp;

    // Never switch away if persistence duration hasn't elapsed, unless new action is URGENT
    if (
      elapsedSinceChange < config.recommendationPersistenceMs &&
      finalPriority !== "URGENT" &&
      state.currentGuidance.action !== finalAction
    ) {
      shouldSwitchGuidance = false;
    }

    // Cooldown check: prevent switching if cooldown hasn't passed and new action isn't higher priority
    if (
      elapsedSinceChange < config.guidanceCooldownMs &&
      finalPriority === "LOW" &&
      state.currentGuidance.priority !== "LOW"
    ) {
      shouldSwitchGuidance = false;
    }
  }

  const candidateGuidance: GuidanceResult = {
    action: finalAction,
    direction: finalDirection,
    priority: finalPriority,
    confidence: config.minimumGuidanceConfidence,
    message: finalMessage,
    timestamp,
    reason: finalReason,
  };

  const activeGuidance: GuidanceResult =
    shouldSwitchGuidance || !state.currentGuidance
      ? candidateGuidance
      : state.currentGuidance;

  // 4. Update announcements count
  const isSameAnnouncement = state.lastAnnouncementText === activeGuidance.message;
  const announcementCount = isSameAnnouncement
    ? state.announcementCount + 1
    : 1;

  const nextState: GuidanceEngineState = {
    currentGuidance: activeGuidance,
    lastGuidanceChangeTimestamp: shouldSwitchGuidance
      ? timestamp
      : state.lastGuidanceChangeTimestamp,
    lastAnnouncementText: activeGuidance.message,
    announcementCount,
    stabilityStartTime: stabilityResult.nextStabilityStartTime,
    stabilityState: stabilityResult.stabilityState,
    framesProcessed: state.framesProcessed + 1,
  };

  return {
    guidance: activeGuidance,
    capture: stabilityResult.captureDecision,
    state: nextState,
  };
}

/**
 * Stateful instance wrapper for managing guidance state across video frames.
 */
export function createGuidanceEngine(options?: GuidanceEngineOptions) {
  let currentState: GuidanceEngineState = INITIAL_GUIDANCE_STATE;

  return {
    update(composition: CompositionResult): GuidanceEngineOutput {
      const output = processGuidanceFrame(currentState, composition, options);
      currentState = output.state;
      return output;
    },
    getState(): GuidanceEngineState {
      return currentState;
    },
    reset(): void {
      currentState = INITIAL_GUIDANCE_STATE;
    },
  };
}
