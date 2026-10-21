import assert from "node:assert/strict";
import test from "node:test";

import {
  MockPerceptionAdapter,
  PipelineProcessor,
  classifyScene,
  detectHorizonFromPixels,
  estimateHorizonFromPoints,
} from "../dist/index.js";

test("estimateHorizonFromPoints calculates level horizon and tilt angles correctly", () => {
  // Horizontal line: (0, 0.5) to (1, 0.5) -> angle 0
  const level = estimateHorizonFromPoints({ x: 0, y: 0.5 }, { x: 1, y: 0.5 });
  assert.equal(level.detected, true);
  assert.equal(level.angleDegrees, 0);

  // Tilted line: (0, 0.45) to (1, 0.55) -> dy = 0.1, dx = 1.0 -> atan2(0.1, 1.0) * 180 / PI ~ 5.71 deg
  const tilted = estimateHorizonFromPoints({ x: 0, y: 0.45 }, { x: 1, y: 0.55 });
  assert.equal(tilted.detected, true);
  assert.ok(Math.abs(tilted.angleDegrees - 5.71) < 0.1);

  // Vertical line: should be rejected as invalid horizon
  const vertical = estimateHorizonFromPoints({ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 });
  assert.equal(vertical.detected, false);
});

test("detectHorizonFromPixels detects level horizon line in pixel buffer", () => {
  const width = 100;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill top half (sky) with light color (240), bottom half (ground) with dark color (40)
  const horizonRow = 50;
  for (let y = 0; y < height; y++) {
    const val = y < horizonRow ? 240 : 40;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = val; // R
      data[idx + 1] = val; // G
      data[idx + 2] = val; // B
      data[idx + 3] = 255; // A
    }
  }

  const result = detectHorizonFromPixels({ data, width, height });
  assert.equal(result.detected, true);
  assert.ok(Math.abs(result.angleDegrees) < 1.0, `Expected ~0 angle, got ${result.angleDegrees}`);
  assert.ok(result.confidence > 0.8);
});

test("detectHorizonFromPixels returns detected: false on flat, low-contrast images", () => {
  const width = 100;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4).fill(128); // uniform grey

  const result = detectHorizonFromPixels({ data, width, height });
  assert.equal(result.detected, false);
});

test("classifyScene deterministically classifies shot types", () => {
  // 1. Solo portrait
  const portrait = classifyScene({
    faces: [{ boundingBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.4 }, confidence: 0.9 }],
  });
  assert.equal(portrait.type, "PORTRAIT");

  // 2. Group photo
  const group = classifyScene({
    faces: [
      { boundingBox: { x: 0.2, y: 0.2, width: 0.2, height: 0.3 }, confidence: 0.9 },
      { boundingBox: { x: 0.6, y: 0.2, width: 0.2, height: 0.3 }, confidence: 0.9 },
    ],
  });
  assert.equal(group.type, "GROUP");

  // 3. Landscape
  const landscape = classifyScene({
    faces: [],
    horizon: { detected: true, angleDegrees: 0, confidence: 0.9 },
  });
  assert.equal(landscape.type, "LANDSCAPE");

  // 4. Food
  const food = classifyScene({
    detections: [{ category: "pizza dish", confidence: 0.88, boundingBox: { x: 0, y: 0, width: 1, height: 1 } }],
  });
  assert.equal(food.type, "FOOD");

  // 5. Architecture
  const arch = classifyScene({
    detections: [{ category: "building facade", confidence: 0.85, boundingBox: { x: 0, y: 0, width: 1, height: 1 } }],
  });
  assert.equal(arch.type, "ARCHITECTURE");
});

test("MockPerceptionAdapter correctly produces preset frames", async () => {
  const adapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");

  const mockFrame = {
    frameId: "f_1",
    timestamp: 1000,
    width: 640,
    height: 360,
    orientation: "LANDSCAPE",
    source: { type: "WEBCAM" },
    payload: { kind: "OPAQUE_REF", refId: "f_1" },
  };

  const res1 = await adapter.processFrame(mockFrame);
  assert.equal(res1.faces.length, 1);
  assert.equal(res1.scene.type, "PORTRAIT");

  adapter.setPreset("TILTED_HORIZON");
  const res2 = await adapter.processFrame(mockFrame);
  assert.equal(res2.faces.length, 0);
  assert.ok(res2.horizon && res2.horizon.detected && res2.horizon.angleDegrees > 5);
});

test("PipelineProcessor runs full end-to-end execution loop", async () => {
  const adapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");

  const mockConfig = {
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
    guidance: {
      minimumGuidanceConfidence: 0.65,
      guidanceCooldownMs: 1200,
      recommendationPersistenceMs: 500,
      stabilityDurationMs: 500,
      maximumRepeatedAnnouncements: 2,
    },
    inference: {
      targetInferenceFps: 10,
      minimumInferenceIntervalMs: 100,
      modelConfidenceThreshold: 0.55,
      maximumProcessingWidth: 640,
      maximumProcessingHeight: 360,
      inferenceEnabled: true,
    },
    performance: {
      targetCameraFps: 30,
      targetProcessingFps: 15,
      targetInferenceLatencyMs: 75,
      targetEndToEndLatencyMs: 150,
      diagnosticsSamplingIntervalMs: 1000,
    },
  };

  const processor = new PipelineProcessor({
    adapter,
    config: mockConfig,
  });

  const mockFrame = {
    frameId: "f_100",
    timestamp: 1000,
    width: 640,
    height: 360,
    orientation: "LANDSCAPE",
    source: { type: "WEBCAM" },
    payload: { kind: "OPAQUE_REF", refId: "f_100" },
  };

  const result = await processor.processFrame(mockFrame);

  assert.equal(result.frameId, "f_100");
  assert.ok(result.composition.overallScore >= 90);
  assert.equal(result.guidance.action, "HOLD");
  assert.equal(result.capture.stability, "STABILIZING");
  assert.ok(result.processingTimeMs >= 0);
});
