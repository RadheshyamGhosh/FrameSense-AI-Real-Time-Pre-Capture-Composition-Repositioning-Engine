import assert from "node:assert/strict";
import test from "node:test";

import { ConfigValidationError, getConfig, validateFrameSenseConfig } from "../dist/index.js";

const validConfig = Object.freeze({
  composition: {
    minimumAcceptableScore: 70,
    excellentScore: 90,
    ruleOfThirdsTolerance: 0.08,
    minimumHeadroomRatio: 0.08,
    minimumSubjectSizeRatio: 0.18,
    maximumSubjectSizeRatio: 0.72,
    maximumHorizonAngleDegrees: 3,
    minimumConfidence: 0.6,
  },
  inference: {
    targetInferenceFps: 10,
    minimumInferenceIntervalMs: 100,
    modelConfidenceThreshold: 0.55,
    maximumProcessingWidth: 640,
    maximumProcessingHeight: 360,
    inferenceEnabled: true,
  },
  guidance: {
    minimumGuidanceConfidence: 0.65,
    guidanceCooldownMs: 1200,
    recommendationPersistenceMs: 500,
    stabilityDurationMs: 750,
    maximumRepeatedAnnouncements: 2,
  },
  performance: {
    targetCameraFps: 30,
    targetProcessingFps: 15,
    targetInferenceLatencyMs: 75,
    targetEndToEndLatencyMs: 150,
    diagnosticsSamplingIntervalMs: 1000,
  },
});

test("valid configuration is accepted", () => {
  const config = validateFrameSenseConfig(validConfig);

  assert.equal(config.composition.minimumAcceptableScore, 70);
  assert.equal(config.inference.inferenceEnabled, true);
});

test("score below 0 is rejected", () => {
  assertValidationIssue(
    withValue("composition", "minimumAcceptableScore", -1),
    "composition.minimumAcceptableScore",
  );
});

test("score above 100 is rejected", () => {
  assertValidationIssue(
    withValue("composition", "excellentScore", 101),
    "composition.excellentScore",
  );
});

test("invalid ratio is rejected", () => {
  assertValidationIssue(
    withValue("composition", "ruleOfThirdsTolerance", 1.2),
    "composition.ruleOfThirdsTolerance",
  );
});

test("negative FPS is rejected", () => {
  assertValidationIssue(
    withValue("inference", "targetInferenceFps", -1),
    "inference.targetInferenceFps",
  );
});

test("negative duration is rejected", () => {
  assertValidationIssue(
    withValue("guidance", "guidanceCooldownMs", -1),
    "guidance.guidanceCooldownMs",
  );
});

test("invalid processing dimension is rejected", () => {
  assertValidationIssue(
    withValue("inference", "maximumProcessingWidth", 0),
    "inference.maximumProcessingWidth",
  );
});

test("invalid horizon angle is rejected", () => {
  assertValidationIssue(
    withValue("composition", "maximumHorizonAngleDegrees", 181),
    "composition.maximumHorizonAngleDegrees",
  );
});

test("complete configuration can be loaded and validated", async () => {
  const config = await getConfig();

  assert.equal(config.composition.minimumAcceptableScore, 70);
  assert.equal(config.performance.targetCameraFps, 30);
});

function withValue(category, key, value) {
  return {
    ...validConfig,
    [category]: {
      ...validConfig[category],
      [key]: value,
    },
  };
}

function assertValidationIssue(config, expectedPath) {
  assert.throws(
    () => validateFrameSenseConfig(config),
    (error) =>
      error instanceof ConfigValidationError &&
      error.issues.some((issue) => issue.path === expectedPath),
  );
}
