import type { CompositionIssue, CompositionResult } from "@framesense/core";
import type { ResolvedAction } from "./types.js";

/**
 * Resolves an individual composition issue to a concrete repositioning guidance action.
 */
export function resolveIssueToAction(issue: CompositionIssue): ResolvedAction {
  const msg = issue.message.toLowerCase();

  switch (issue.metricType) {
    case "HEADROOM":
      if (msg.includes("cut off") || msg.includes("not enough") || msg.includes("up")) {
        return {
          action: "TILT_UP",
          direction: "UP",
          priority: issue.severity === "HIGH" ? "URGENT" : "HIGH",
          message: "Tilt camera up",
          reason: issue.message,
        };
      }
      return {
        action: "TILT_DOWN",
        direction: "DOWN",
        priority: "MEDIUM",
        message: "Tilt camera down",
        reason: issue.message,
      };

    case "SUBJECT_SIZE":
      if (msg.includes("small") || msg.includes("closer") || msg.includes("zoom in")) {
        return {
          action: "MOVE_CLOSER",
          direction: "FORWARD",
          priority: issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
          message: "Move closer to subject",
          reason: issue.message,
        };
      }
      return {
        action: "STEP_BACK",
        direction: "BACKWARD",
        priority: issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
        message: "Step back",
        reason: issue.message,
      };

    case "HORIZON_ALIGNMENT":
      if (msg.includes("counter-clockwise") || msg.includes("rotate right")) {
        return {
          action: "ROTATE_RIGHT",
          direction: "CLOCKWISE",
          priority: issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
          message: "Rotate camera right to level",
          reason: issue.message,
        };
      }
      return {
        action: "ROTATE_LEFT",
        direction: "COUNTERCLOCKWISE",
        priority: issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
        message: "Rotate camera left to level",
        reason: issue.message,
      };

    case "RULE_OF_THIRDS":
    case "SUBJECT_POSITION":
      if (msg.includes("no person") || msg.includes("step into")) {
        return {
          action: "MOVE_CLOSER",
          direction: "FORWARD",
          priority: "URGENT",
          message: "Please step into camera frame",
          reason: issue.message,
        };
      }
      if (msg.includes("left")) {
        // If subject is framed too far left, camera needs to shift right
        return {
          action: "MOVE_RIGHT",
          direction: "RIGHT",
          priority: "MEDIUM",
          message: "Pan camera right",
          reason: issue.message,
        };
      }
      if (msg.includes("right")) {
        // If subject is framed too far right, camera needs to shift left
        return {
          action: "MOVE_LEFT",
          direction: "LEFT",
          priority: "MEDIUM",
          message: "Pan camera left",
          reason: issue.message,
        };
      }
      if (msg.includes("low") || msg.includes("up")) {
        return {
          action: "MOVE_UP",
          direction: "UP",
          priority: "LOW",
          message: "Raise camera slightly",
          reason: issue.message,
        };
      }
      return {
        action: "MOVE_DOWN",
        direction: "DOWN",
        priority: "LOW",
        message: "Lower camera slightly",
        reason: issue.message,
      };

    case "SYMMETRY":
    case "NEGATIVE_SPACE":
      return {
        action: "HOLD",
        direction: "NONE",
        priority: "LOW",
        message: "Adjust frame balance",
        reason: issue.message,
      };

    default:
      return {
        action: "NONE",
        direction: "NONE",
        priority: "LOW",
        message: "Align camera",
        reason: issue.message,
      };
  }
}

/**
 * Selects the most critical guidance action for the current composition result.
 */
export function resolvePrimaryAction(
  composition: CompositionResult,
  acceptableScore: number,
): ResolvedAction {
  // If overall framing is acceptable with no major issues, promote holding / ready
  const criticalIssues = composition.issues.filter(
    (i) => i.severity === "HIGH" || i.severity === "MEDIUM",
  );

  if (criticalIssues.length === 0 && composition.overallScore >= acceptableScore) {
    return {
      action: "HOLD",
      direction: "NONE",
      priority: "LOW",
      message: "Framing is good! Hold steady",
      reason: `Overall score ${composition.overallScore} satisfies composition criteria.`,
    };
  }

  // Pick the highest severity issue
  if (composition.issues.length > 0) {
    return resolveIssueToAction(composition.issues[0]);
  }

  return {
    action: "HOLD",
    direction: "NONE",
    priority: "LOW",
    message: "Hold steady",
    reason: "No active composition issues detected.",
  };
}
