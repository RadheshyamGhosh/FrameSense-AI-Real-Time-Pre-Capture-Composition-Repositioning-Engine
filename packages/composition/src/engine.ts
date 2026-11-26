import type { CompositionConfig } from "@framesense/config";
import { DEFAULT_FRAMESENSE_CONFIG } from "@framesense/config/defaults";
import type {
  CompositionContext,
  CompositionIssue,
  CompositionMetric,
  CompositionResult,
  SceneType,
} from "@framesense/core";
import { evaluateHeadroom } from "./evaluators/headroom.js";
import { evaluateHorizon } from "./evaluators/horizon.js";
import { evaluateRuleOfThirds } from "./evaluators/ruleOfThirds.js";
import { evaluateSubjectSize } from "./evaluators/subjectSize.js";
import { evaluateSymmetryAndPosition } from "./evaluators/symmetry.js";
import { evaluateTemplateCompliance } from "./evaluators/template.js";
import { extractPrimarySubject } from "./subject.js";
import type { CompositionEvaluationOptions, SceneWeights } from "./types.js";

export const DEFAULT_COMPOSITION_CONFIG: CompositionConfig =
  DEFAULT_FRAMESENSE_CONFIG.composition;

const PROFILE_WEIGHTS: Record<SceneType, SceneWeights> = {
  PORTRAIT: {
    HEADROOM: 0.25,
    SUBJECT_SIZE: 0.25,
    RULE_OF_THIRDS: 0.20,
    SUBJECT_POSITION: 0.15,
    HORIZON_ALIGNMENT: 0.10,
    SYMMETRY: 0.05,
  },
  GROUP: {
    SUBJECT_SIZE: 0.30,
    HEADROOM: 0.25,
    SUBJECT_POSITION: 0.25,
    HORIZON_ALIGNMENT: 0.20,
  },
  LANDSCAPE: {
    HORIZON_ALIGNMENT: 0.40,
    RULE_OF_THIRDS: 0.30,
    SYMMETRY: 0.15,
    SUBJECT_POSITION: 0.15,
  },
  ARCHITECTURE: {
    HORIZON_ALIGNMENT: 0.35,
    SYMMETRY: 0.35,
    RULE_OF_THIRDS: 0.15,
    SUBJECT_POSITION: 0.15,
  },
  FOOD: {
    SUBJECT_SIZE: 0.35,
    RULE_OF_THIRDS: 0.35,
    SUBJECT_POSITION: 0.15,
    HEADROOM: 0.15,
  },
  UNKNOWN: {
    HEADROOM: 0.20,
    SUBJECT_SIZE: 0.20,
    RULE_OF_THIRDS: 0.20,
    SUBJECT_POSITION: 0.15,
    HORIZON_ALIGNMENT: 0.15,
    SYMMETRY: 0.10,
  },
};

const SEVERITY_ORDER: Record<CompositionIssue["severity"], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * Evaluates the full composition quality of a frame context based on perception detections.
 */
export function evaluateComposition(
  context: CompositionContext,
  options?: CompositionEvaluationOptions,
): CompositionResult {
  const config = options?.config ?? DEFAULT_COMPOSITION_CONFIG;

  // Determine template & scene profile
  const activeTemplate = options?.template ?? context.template ?? "NONE";
  const profile: SceneType =
    options?.profileOverride ??
    context.scene ??
    context.perception.scene?.type ??
    ((context.perception.faces?.length ?? 0) > 1 ? "GROUP" : "PORTRAIT");

  const subject = extractPrimarySubject(context.perception);

  const metrics: CompositionMetric[] = [];
  const issues: CompositionIssue[] = [];

  // 1. Rule of Thirds
  const rotResult = evaluateRuleOfThirds(subject, profile, config);
  metrics.push(rotResult.metric);
  if (rotResult.issue) issues.push(rotResult.issue);

  // 2. Headroom
  const headroomResult = evaluateHeadroom(subject, config);
  metrics.push(headroomResult.metric);
  if (headroomResult.issue) issues.push(headroomResult.issue);

  // 3. Subject Size
  const sizeResult = evaluateSubjectSize(subject, config);
  metrics.push(sizeResult.metric);
  if (sizeResult.issue) issues.push(sizeResult.issue);

  // 4. Horizon Alignment
  const horizonResult = evaluateHorizon(context.perception.horizon, profile, config);
  metrics.push(horizonResult.metric);
  if (horizonResult.issue) issues.push(horizonResult.issue);

  // 5. Position & Symmetry
  const { position, symmetry } = evaluateSymmetryAndPosition(subject, profile, config);
  metrics.push(position.metric);
  if (position.issue) issues.push(position.issue);
  metrics.push(symmetry.metric);
  if (symmetry.issue) issues.push(symmetry.issue);

  // If no salient subject detected for portrait/group framing
  if (subject.confidence === 0 && (profile === "PORTRAIT" || profile === "GROUP" || activeTemplate !== "NONE")) {
    issues.push({
      code: "NO_SUBJECT",
      metricType: "SUBJECT_POSITION",
      severity: "HIGH",
      message: "No person detected. Step into camera view.",
    });
  }

  // 6. Apply calibrated template compliance rules if active
  const templateEval = evaluateTemplateCompliance(
    activeTemplate,
    subject,
    context.perception.horizon,
  );
  if (templateEval.issues.length > 0) {
    issues.push(...templateEval.issues);
  }

  // Calculate weighted overall score
  const weights = PROFILE_WEIGHTS[profile] ?? PROFILE_WEIGHTS.UNKNOWN;
  let totalScoreWeight = 0;
  let totalWeight = 0;

  for (const m of metrics) {
    const weight = weights[m.type] ?? 0;
    if (weight > 0) {
      totalScoreWeight += m.score * weight;
      totalWeight += weight;
    }
  }

  const baseScore =
    subject.confidence === 0 && (profile === "PORTRAIT" || profile === "GROUP" || activeTemplate !== "NONE")
      ? 20
      : totalWeight > 0
        ? Math.round(totalScoreWeight / totalWeight)
        : 50;

  const overallScore = Math.min(100, Math.max(0, baseScore - templateEval.penaltyPoints));

  // Sort issues by priority (HIGH -> MEDIUM -> LOW)
  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    frameId: context.frameId,
    timestamp: context.timestamp,
    overallScore,
    metrics,
    issues,
    profile,
    template: activeTemplate !== "NONE" ? activeTemplate : undefined,
    primarySubjectBounds: subject.confidence > 0 ? subject.boundingBox : undefined,
    primaryFocalPoint: subject.confidence > 0 ? subject.focalPoint : undefined,
    horizonAngleDegrees:
      context.perception.horizon?.detected ? context.perception.horizon.angleDegrees : undefined,
    frameQuality: context.perception.quality,
  };
}
