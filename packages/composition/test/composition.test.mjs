import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_COMPOSITION_CONFIG,
  evaluateComposition,
  extractPrimarySubject,
} from "../dist/index.js";

function createMockContext(overrides = {}) {
  return {
    frameId: "test-frame-001",
    timestamp: 1000,
    frame: { width: 1920, height: 1080 },
    perception: {
      frameId: "test-frame-001",
      timestamp: 1000,
      detections: [],
      faces: [],
      poses: [],
      ...overrides.perception,
    },
    ...overrides,
  };
}

test("evaluates a well-framed solo portrait with high score and no issues", () => {
  const context = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [
        {
          boundingBox: { x: 0.35, y: 0.12, width: 0.3, height: 0.38 },
          confidence: 0.95,
        },
      ],
      horizon: {
        detected: true,
        angleDegrees: 0.5,
        confidence: 0.9,
      },
    },
  });

  const result = evaluateComposition(context);

  assert.equal(result.frameId, "test-frame-001");
  assert.equal(result.profile, "PORTRAIT");
  assert.ok(
    result.overallScore >= DEFAULT_COMPOSITION_CONFIG.excellentScore,
    `Expected overallScore >= ${DEFAULT_COMPOSITION_CONFIG.excellentScore}, got ${result.overallScore}`,
  );
  assert.equal(result.issues.length, 0);

  const headroomMetric = result.metrics.find((m) => m.type === "HEADROOM");
  assert.ok(headroomMetric && headroomMetric.score === 100);
});

test("detects insufficient headroom and emits HIGH severity issue", () => {
  const context = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [
        {
          // Head cropped at top (y = 0.01)
          boundingBox: { x: 0.35, y: 0.01, width: 0.3, height: 0.4 },
          confidence: 0.9,
        },
      ],
    },
  });

  const result = evaluateComposition(context);

  const headroomIssue = result.issues.find((i) => i.metricType === "HEADROOM");
  assert.ok(headroomIssue, "Expected headroom issue to be generated");
  assert.equal(headroomIssue.severity, "HIGH");
  assert.match(headroomIssue.message, /Head is cut off/i);
});

test("detects excessive headroom when subject is placed too low in the frame", () => {
  const context = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [
        {
          // Head placed very low (y = 0.45)
          boundingBox: { x: 0.35, y: 0.45, width: 0.3, height: 0.3 },
          confidence: 0.9,
        },
      ],
    },
  });

  const result = evaluateComposition(context);

  const headroomIssue = result.issues.find((i) => i.metricType === "HEADROOM");
  assert.ok(headroomIssue, "Expected excessive headroom issue");
  assert.match(headroomIssue.message, /Excessive empty space/i);
});

test("detects subject too small and recommends moving closer", () => {
  const context = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [
        {
          // Very small face (0.05 width, 0.06 height) below min ratio (0.18)
          boundingBox: { x: 0.47, y: 0.2, width: 0.05, height: 0.06 },
          confidence: 0.85,
        },
      ],
    },
  });

  const result = evaluateComposition(context);

  const sizeIssue = result.issues.find((i) => i.metricType === "SUBJECT_SIZE");
  assert.ok(sizeIssue, "Expected subject size issue");
  assert.match(sizeIssue.message, /Subject is too small/i);
});

test("detects subject too large/crowding the frame and recommends stepping back", () => {
  const context = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [
        {
          // Very large face (0.85 width, 0.85 height) above max ratio (0.72)
          boundingBox: { x: 0.07, y: 0.08, width: 0.85, height: 0.85 },
          confidence: 0.92,
        },
      ],
    },
  });

  const result = evaluateComposition(context);

  const sizeIssue = result.issues.find((i) => i.metricType === "SUBJECT_SIZE");
  assert.ok(sizeIssue, "Expected subject size issue");
  assert.match(sizeIssue.message, /Subject is too close|too large/i);
});

test("detects tilted horizon and emits corrective rotation message", () => {
  const context = createMockContext({
    scene: "LANDSCAPE",
    perception: {
      horizon: {
        detected: true,
        angleDegrees: 7.5,
        confidence: 0.9,
      },
    },
  });

  const result = evaluateComposition(context);

  const horizonIssue = result.issues.find((i) => i.metricType === "HORIZON_ALIGNMENT");
  assert.ok(horizonIssue, "Expected horizon alignment issue");
  assert.match(horizonIssue.message, /Horizon is tilted by 7.5°/i);
  assert.match(horizonIssue.message, /counter-clockwise/i);
});

test("handles multiple faces (group photo) by aggregating subject bounds", () => {
  const context = createMockContext({
    perception: {
      faces: [
        {
          boundingBox: { x: 0.2, y: 0.2, width: 0.2, height: 0.25 },
          confidence: 0.9,
        },
        {
          boundingBox: { x: 0.6, y: 0.2, width: 0.2, height: 0.25 },
          confidence: 0.9,
        },
      ],
    },
  });

  const subject = extractPrimarySubject(context.perception);
  assert.equal(subject.source, "FACE");
  // Aggregated envelope should stretch from x=0.2 to x=0.8 (width = 0.6)
  assert.ok(Math.abs(subject.boundingBox.x - 0.2) < 0.01);
  assert.ok(Math.abs(subject.boundingBox.width - 0.6) < 0.01);

  const result = evaluateComposition(context);
  assert.equal(result.profile, "GROUP");
});

test("handles empty frame gracefully without throwing", () => {
  const context = createMockContext({
    scene: "UNKNOWN",
    perception: {
      faces: [],
      poses: [],
      detections: [],
    },
  });

  const result = evaluateComposition(context);
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
  assert.equal(result.metrics.length, 6);
});

test("respects custom CompositionConfig overrides", () => {
  const strictConfig = {
    ...DEFAULT_COMPOSITION_CONFIG,
    maximumHorizonAngleDegrees: 1.0,
    minimumAcceptableScore: 95,
  };

  const context = createMockContext({
    scene: "LANDSCAPE",
    perception: {
      horizon: {
        detected: true,
        angleDegrees: 2.0,
        confidence: 0.9,
      },
    },
  });

  const result = evaluateComposition(context, { config: strictConfig });
  const horizonIssue = result.issues.find((i) => i.metricType === "HORIZON_ALIGNMENT");
  assert.ok(horizonIssue, "Expected issue under strict 1.0 degree tolerance");
});
