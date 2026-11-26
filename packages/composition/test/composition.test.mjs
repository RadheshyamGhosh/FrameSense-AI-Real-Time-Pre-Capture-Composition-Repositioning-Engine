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

test("emits consistent pan directions when subject is framed far left or far right", () => {
  const leftContext = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [{ boundingBox: { x: 0.02, y: 0.15, width: 0.2, height: 0.35 }, confidence: 0.9 }],
    },
  });
  const leftResult = evaluateComposition(leftContext);
  const leftIssue = leftResult.issues.find((i) => i.metricType === "RULE_OF_THIRDS");
  assert.ok(leftIssue);
  assert.match(leftIssue.message, /Pan camera left/i);

  const rightContext = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [{ boundingBox: { x: 0.82, y: 0.15, width: 0.16, height: 0.35 }, confidence: 0.9 }],
    },
  });
  const rightResult = evaluateComposition(rightContext);
  const rightIssue = rightResult.issues.find((i) => i.metricType === "RULE_OF_THIRDS");
  assert.ok(rightIssue);
  assert.match(rightIssue.message, /Pan camera right/i);
});

test("exposes tracked subject bounds, focal point, and signed horizon angle in CompositionResult", () => {
  const context = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [{ boundingBox: { x: 0.3, y: 0.15, width: 0.3, height: 0.4 }, confidence: 0.9 }],
      horizon: { detected: true, angleDegrees: -4.2, confidence: 0.85 },
    },
  });

  const result = evaluateComposition(context);
  assert.deepEqual(result.primarySubjectBounds, { x: 0.3, y: 0.15, width: 0.3, height: 0.4 });
  assert.ok(result.primaryFocalPoint);
  assert.equal(result.horizonAngleDegrees, -4.2);
});

test("evaluates PASSPORT_ID biometric centering and CREATOR_TALKING_HEAD templates", () => {
  // Off-center face in PASSPORT_ID should emit HIGH severity ID centering issue and lower score
  const offCenterPassport = createMockContext({
    scene: "PORTRAIT",
    template: "PASSPORT_ID",
    perception: {
      faces: [{ boundingBox: { x: 0.1, y: 0.15, width: 0.28, height: 0.45 }, confidence: 0.95 }],
      horizon: { detected: true, angleDegrees: 0.3, confidence: 0.9 },
    },
  });
  const badIdRes = evaluateComposition(offCenterPassport);
  assert.equal(badIdRes.template, "PASSPORT_ID");
  assert.ok(badIdRes.issues.some((i) => i.severity === "HIGH" && /ID frame/i.test(i.message)));

  // Centered oval-sized face with level head passes PASSPORT_ID cleanly
  const goodPassport = createMockContext({
    scene: "PORTRAIT",
    template: "PASSPORT_ID",
    perception: {
      faces: [{ boundingBox: { x: 0.36, y: 0.14, width: 0.28, height: 0.48 }, confidence: 0.95 }],
      horizon: { detected: true, angleDegrees: 0.4, confidence: 0.9 },
    },
  });
  const goodIdRes = evaluateComposition(goodPassport);
  assert.ok(goodIdRes.overallScore >= 85, `Expected high ID score, got ${goodIdRes.overallScore}`);
  assert.equal(goodIdRes.issues.length, 0);

  // CREATOR_TALKING_HEAD flags subject seated far too low into graphics zone
  const lowCreator = createMockContext({
    scene: "PORTRAIT",
    template: "CREATOR_TALKING_HEAD",
    perception: {
      faces: [{ boundingBox: { x: 0.38, y: 0.55, width: 0.24, height: 0.3 }, confidence: 0.9 }],
    },
  });
  const creatorRes = evaluateComposition(lowCreator);
  assert.ok(creatorRes.issues.some((i) => /presenter zone/i.test(i.message)));

  // Far-edge portrait (> 0.12 center offset) also emits typed SUBJECT_POSITION issue
  const edgePortrait = createMockContext({
    scene: "PORTRAIT",
    perception: {
      faces: [{ boundingBox: { x: 0.01, y: 0.15, width: 0.22, height: 0.35 }, confidence: 0.9 }],
    },
  });
  const edgeRes = evaluateComposition(edgePortrait);
  const posIssue = edgeRes.issues.find((i) => i.metricType === "SUBJECT_POSITION");
  assert.ok(posIssue, "Expected SUBJECT_POSITION issue for far-edge portrait");
  assert.equal(posIssue.code, "PAN_LEFT");
});
