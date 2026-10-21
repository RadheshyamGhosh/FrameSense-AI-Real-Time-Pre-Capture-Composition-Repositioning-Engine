import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GUIDANCE_CONFIG,
  INITIAL_GUIDANCE_STATE,
  createGuidanceEngine,
  processGuidanceFrame,
  resolveIssueToAction,
} from "../dist/index.js";

function createMockComposition(overrides = {}) {
  return {
    frameId: "test-frame-001",
    timestamp: 1000,
    overallScore: 85,
    metrics: [],
    issues: [],
    profile: "PORTRAIT",
    ...overrides,
  };
}

test("resolves headroom cutoff issue to TILT_UP action with URGENT priority", () => {
  const issue = {
    metricType: "HEADROOM",
    severity: "HIGH",
    message: "Head is cut off at the top. Tilt up or step back.",
  };

  const resolved = resolveIssueToAction(issue);
  assert.equal(resolved.action, "TILT_UP");
  assert.equal(resolved.direction, "UP");
  assert.equal(resolved.priority, "URGENT");
  assert.match(resolved.message, /Tilt camera up/i);
});

test("resolves subject too small issue to MOVE_CLOSER action", () => {
  const issue = {
    metricType: "SUBJECT_SIZE",
    severity: "MEDIUM",
    message: "Subject is too small in frame. Move closer or zoom in.",
  };

  const resolved = resolveIssueToAction(issue);
  assert.equal(resolved.action, "MOVE_CLOSER");
  assert.equal(resolved.direction, "FORWARD");
  assert.equal(resolved.priority, "MEDIUM");
});

test("resolves subject too close issue to STEP_BACK action", () => {
  const issue = {
    metricType: "SUBJECT_SIZE",
    severity: "HIGH",
    message: "Subject is too close or cropped. Step back.",
  };

  const resolved = resolveIssueToAction(issue);
  assert.equal(resolved.action, "STEP_BACK");
  assert.equal(resolved.direction, "BACKWARD");
  assert.equal(resolved.priority, "HIGH");
});

test("resolves horizon tilt issue to ROTATE_RIGHT and ROTATE_LEFT", () => {
  const issueCounterClockwise = {
    metricType: "HORIZON_ALIGNMENT",
    severity: "MEDIUM",
    message: "Horizon is tilted by 5.0°. Rotate camera counter-clockwise to level.",
  };

  const res1 = resolveIssueToAction(issueCounterClockwise);
  assert.equal(res1.action, "ROTATE_RIGHT");
  assert.equal(res1.direction, "CLOCKWISE");

  const issueClockwise = {
    metricType: "HORIZON_ALIGNMENT",
    severity: "MEDIUM",
    message: "Horizon is tilted by 5.0°. Rotate camera clockwise to level.",
  };

  const res2 = resolveIssueToAction(issueClockwise);
  assert.equal(res2.action, "ROTATE_LEFT");
  assert.equal(res2.direction, "COUNTERCLOCKWISE");
});

test("triggers STABILIZING state when composition achieves acceptable score", () => {
  const engine = createGuidanceEngine({
    config: {
      ...DEFAULT_GUIDANCE_CONFIG,
      stabilityDurationMs: 500,
    },
    acceptableScore: 75,
  });

  const comp = createMockComposition({
    timestamp: 1000,
    overallScore: 80,
    issues: [],
  });

  const output = engine.update(comp);
  assert.equal(output.capture.ready, false);
  assert.equal(output.capture.stability, "STABILIZING");
  assert.equal(output.guidance.action, "HOLD");
});

test("transitions to STABLE and CAPTURE_READY after sustaining stability duration", () => {
  const engine = createGuidanceEngine({
    config: {
      ...DEFAULT_GUIDANCE_CONFIG,
      stabilityDurationMs: 400,
    },
    acceptableScore: 75,
  });

  // Frame 1 at t=1000: start stabilizing
  const f1 = engine.update(createMockComposition({ timestamp: 1000, overallScore: 85 }));
  assert.equal(f1.capture.ready, false);
  assert.equal(f1.capture.stability, "STABILIZING");

  // Frame 2 at t=1200 (200ms elapsed): still stabilizing
  const f2 = engine.update(createMockComposition({ timestamp: 1200, overallScore: 85 }));
  assert.equal(f2.capture.ready, false);
  assert.equal(f2.capture.stability, "STABILIZING");

  // Frame 3 at t=1450 (450ms elapsed >= 400ms target): CAPTURE READY!
  const f3 = engine.update(createMockComposition({ timestamp: 1450, overallScore: 85 }));
  assert.equal(f3.capture.ready, true);
  assert.equal(f3.capture.stability, "STABLE");
  assert.equal(f3.guidance.action, "CAPTURE_READY");
  assert.match(f3.guidance.message, /Capturing|Perfect/i);
});

test("resets stability timer if framing drops below threshold before duration met", () => {
  const engine = createGuidanceEngine({
    config: {
      ...DEFAULT_GUIDANCE_CONFIG,
      stabilityDurationMs: 400,
    },
    acceptableScore: 75,
  });

  // Frame 1 at t=1000: stabilizing
  engine.update(createMockComposition({ timestamp: 1000, overallScore: 85 }));

  // Frame 2 at t=1200: score drops to 50 with severe issue!
  const f2 = engine.update(
    createMockComposition({
      timestamp: 1200,
      overallScore: 50,
      issues: [
        {
          metricType: "HEADROOM",
          severity: "HIGH",
          message: "Head is cut off at the top.",
        },
      ],
    }),
  );

  assert.equal(f2.capture.ready, false);
  assert.equal(f2.capture.stability, "UNSTABLE");
  assert.equal(f2.guidance.action, "TILT_UP");

  // Frame 3 at t=1500: becomes good again, but timer must restart
  const f3 = engine.update(createMockComposition({ timestamp: 1500, overallScore: 85 }));
  assert.equal(f3.capture.ready, false);
  assert.equal(f3.capture.stability, "STABILIZING");
});

test("preserves guidance recommendation within persistence window to avoid flicker", () => {
  const engine = createGuidanceEngine({
    config: {
      ...DEFAULT_GUIDANCE_CONFIG,
      recommendationPersistenceMs: 500,
    },
  });

  // Frame 1 at t=1000: emit MOVE_CLOSER
  const f1 = engine.update(
    createMockComposition({
      timestamp: 1000,
      overallScore: 50,
      issues: [
        {
          metricType: "SUBJECT_SIZE",
          severity: "MEDIUM",
          message: "Subject is too small in frame.",
        },
      ],
    }),
  );
  assert.equal(f1.guidance.action, "MOVE_CLOSER");

  // Frame 2 at t=1200 (only 200ms later): minor low-priority issue appears
  const f2 = engine.update(
    createMockComposition({
      timestamp: 1200,
      overallScore: 55,
      issues: [
        {
          metricType: "RULE_OF_THIRDS",
          severity: "LOW",
          message: "Subject is slightly off thirds.",
        },
      ],
    }),
  );

  // Persistence should keep MOVE_CLOSER
  assert.equal(f2.guidance.action, "MOVE_CLOSER");
});

test("tracks repeated announcement counts and resets engine correctly", () => {
  const engine = createGuidanceEngine();

  const comp = createMockComposition({
    timestamp: 1000,
    overallScore: 80,
    issues: [],
  });

  const out1 = engine.update(comp);
  assert.equal(out1.state.announcementCount, 1);

  const out2 = engine.update({ ...comp, timestamp: 1100 });
  assert.equal(out2.state.announcementCount, 2);

  engine.reset();
  assert.equal(engine.getState().framesProcessed, 0);
  assert.equal(engine.getState().announcementCount, 0);
});

test("processGuidanceFrame executes a pure immutable state transition", () => {
  const comp = createMockComposition({ timestamp: 1000, overallScore: 82 });
  const result = processGuidanceFrame(INITIAL_GUIDANCE_STATE, comp);

  assert.equal(result.capture.ready, false);
  assert.equal(result.capture.stability, "STABILIZING");
  assert.equal(result.state.framesProcessed, 1);
  assert.equal(result.state.announcementCount, 1);
});

