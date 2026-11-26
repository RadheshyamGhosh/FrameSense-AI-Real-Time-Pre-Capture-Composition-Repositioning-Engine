import type {
  CompositionIssue,
  FramingTemplate,
  HorizonResult,
} from "@framesense/core";
import type { PrimarySubject } from "../types.js";

export interface TemplateEvaluationResult {
  readonly issues: readonly CompositionIssue[];
  readonly penaltyPoints: number;
}

/**
 * Evaluates template-specific biometric and creator framing rules
 * (Passport/ID oval fit, Pro Headshot centering, Creator Talking-Head desk framing).
 */
export function evaluateTemplateCompliance(
  template: FramingTemplate | undefined,
  subject: PrimarySubject,
  horizon: HorizonResult | undefined,
): TemplateEvaluationResult {
  if (!template || template === "NONE" || subject.confidence === 0) {
    return { issues: [], penaltyPoints: 0 };
  }

  const issues: CompositionIssue[] = [];
  let penaltyPoints = 0;

  const cx = subject.center.x;
  const topY = subject.boundingBox.y;
  const height = subject.boundingBox.height;

  if (template === "PASSPORT_ID") {
    // Biometric ID requires dead-center alignment, ~50% head height inside oval, and <= 1.5 deg tilt
    if (Math.abs(cx - 0.5) > 0.05) {
      issues.push({
        metricType: "SUBJECT_POSITION",
        severity: "HIGH",
        message:
          cx < 0.5
            ? "ID frame: face too far left. Pan camera left to center inside oval."
            : "ID frame: face too far right. Pan camera right to center inside oval.",
      });
      penaltyPoints += 18;
    }

    if (height < 0.36) {
      issues.push({
        metricType: "SUBJECT_SIZE",
        severity: "HIGH",
        message: "Subject is too small for ID oval. Move closer or zoom in.",
      });
      penaltyPoints += 20;
    } else if (height > 0.68) {
      issues.push({
        metricType: "SUBJECT_SIZE",
        severity: "HIGH",
        message: "Subject is too close for ID oval. Step back.",
      });
      penaltyPoints += 20;
    }

    if (topY < 0.1) {
      issues.push({
        metricType: "HEADROOM",
        severity: "HIGH",
        message: "Headroom too tight for ID standard. Tilt camera up.",
      });
      penaltyPoints += 16;
    } else if (topY > 0.25) {
      issues.push({
        metricType: "HEADROOM",
        severity: "MEDIUM",
        message: "Subject too low in ID oval. Tilt camera down.",
      });
      penaltyPoints += 12;
    }

    if (horizon?.detected && horizon.angleDegrees !== undefined && Math.abs(horizon.angleDegrees) > 1.5) {
      const dir = horizon.angleDegrees > 0 ? "counter-clockwise" : "clockwise";
      issues.push({
        metricType: "HORIZON_ALIGNMENT",
        severity: "HIGH",
        message: `ID standard requires level head (${Math.abs(horizon.angleDegrees).toFixed(1)}°). Rotate camera ${dir} to level.`,
      });
      penaltyPoints += 16;
    }
  } else if (template === "HEADSHOT_PRO") {
    // Corporate / LinkedIn headshot: crisp upper-chest framing, balanced center, eye-line ~0.28..0.38
    if (Math.abs(cx - 0.5) > 0.08) {
      issues.push({
        metricType: "SUBJECT_POSITION",
        severity: "MEDIUM",
        message:
          cx < 0.5
            ? "Headshot: shift left to center your shoulders."
            : "Headshot: shift right to center your shoulders.",
      });
      penaltyPoints += 12;
    }

    if (height < 0.24) {
      issues.push({
        metricType: "SUBJECT_SIZE",
        severity: "MEDIUM",
        message: "Headshot subject is too small. Move closer.",
      });
      penaltyPoints += 14;
    } else if (height > 0.6) {
      issues.push({
        metricType: "SUBJECT_SIZE",
        severity: "MEDIUM",
        message: "Too close for headshot framing. Step back.",
      });
      penaltyPoints += 14;
    }
  } else if (template === "CREATOR_TALKING_HEAD") {
    // Desk presenter: keep eyes near top third line (0.26..0.40) and scale around 0.20..0.48
    const eyeY = subject.focalPoint.y;
    if (eyeY < 0.22) {
      issues.push({
        metricType: "HEADROOM",
        severity: "MEDIUM",
        message: "Eyes near top border. Tilt camera up slightly.",
      });
      penaltyPoints += 12;
    } else if (eyeY > 0.45) {
      issues.push({
        metricType: "HEADROOM",
        severity: "MEDIUM",
        message: "Sitting too low for presenter zone. Tilt camera down.",
      });
      penaltyPoints += 12;
    }
  }

  return { issues, penaltyPoints };
}
