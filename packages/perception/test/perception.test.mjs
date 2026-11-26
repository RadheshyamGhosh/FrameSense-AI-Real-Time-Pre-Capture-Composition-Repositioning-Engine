import assert from "node:assert/strict";
import test from "node:test";

import {
  MockPerceptionAdapter,
  PipelineProcessor,
  RealPerceptionAdapter,
  classifyScene,
  detectFaceCluster,
  detectFaceClusters,
  detectHorizonFromPixels,
  estimateHorizonFromPoints,
  evaluateFrameQuality,
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

test("detectFaceCluster localizes skin region including left-border edge and rejects grey walls", () => {
  const width = 120;
  const height = 80;
  const emptyWall = new Uint8ClampedArray(width * height * 4).fill(180);
  assert.equal(detectFaceCluster(emptyWall, width, height), null);

  // Place a skin-tone region touching the left border (x = 0..24, y = 10..40)
  const skinFrame = new Uint8ClampedArray(width * height * 4).fill(30);
  for (let y = 10; y < 40; y++) {
    for (let x = 0; x < 24; x++) {
      const idx = (y * width + x) * 4;
      skinFrame[idx] = 210; // R
      skinFrame[idx + 1] = 155; // G
      skinFrame[idx + 2] = 125; // B
      skinFrame[idx + 3] = 255;
    }
  }

  const box = detectFaceCluster(skinFrame, width, height);
  assert.ok(box, "Expected face cluster to be detected");
  assert.equal(box.x, 0, "Left-edge skin region should preserve x=0 boundary");
  assert.ok(box.width > 0.1 && box.width < 0.35);
});

test("RealPerceptionAdapter mirrors x-coordinates when mirrored metadata is set and ignores asymmetric lighting tilt", async () => {
  const width = 120;
  const height = 80;
  const data = new Uint8ClampedArray(width * height * 4);

  // Bright asymmetric left lighting on a uniform dark room (no horizontal edge across scanlines)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const bg = x < width / 3 ? 220 : 40;
      data[idx] = bg;
      data[idx + 1] = bg;
      data[idx + 2] = bg;
      data[idx + 3] = 255;
    }
  }

  // Paint skin cluster on sensor-left (x = 12..36, y = 12..44)
  for (let y = 12; y < 44; y++) {
    for (let x = 12; x < 36; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 215;
      data[idx + 1] = 160;
      data[idx + 2] = 130;
    }
  }

  const adapter = new RealPerceptionAdapter();
  await adapter.initialize();

  const rawFrame = {
    frameId: "real_raw",
    timestamp: 1000,
    width,
    height,
    orientation: "LANDSCAPE",
    source: { type: "WEBCAM" },
    payload: { kind: "OPAQUE_REF", refId: "real_raw", metadata: { mirrored: false } },
  };
  const mirroredFrame = {
    ...rawFrame,
    frameId: "real_mirrored",
    payload: { kind: "OPAQUE_REF", refId: "real_mirrored", metadata: { mirrored: true } },
  };

  const rawResult = await adapter.processFrame(rawFrame, { pixelData: { data, width, height } });
  const mirroredResult = await adapter.processFrame(mirroredFrame, { pixelData: { data, width, height } });

  assert.equal(rawResult.faces.length, 1);
  assert.ok(rawResult.faces[0].boundingBox.x < 0.25, "Raw face should be on left");
  assert.ok(mirroredResult.faces[0].boundingBox.x > 0.65, "Mirrored face should flip to right");
  assert.equal(rawResult.metadata.backend, "chroma-cluster");
  // Asymmetric left/right vertical split is not a horizontal horizon
  assert.equal(rawResult.horizon?.detected, false);
});

test("evaluateFrameQuality flags LOW_LIGHT, OVEREXPOSED, BACKLIT, and BLURRY frames deterministically", () => {
  const width = 40;
  const height = 40;

  // 1. Dark frame -> LOW_LIGHT
  const darkData = new Uint8ClampedArray(width * height * 4).fill(15);
  const dark = evaluateFrameQuality({ data: darkData, width, height });
  assert.equal(dark.status, "LOW_LIGHT");

  // 2. Overexposed frame -> OVEREXPOSED
  const brightData = new Uint8ClampedArray(width * height * 4).fill(250);
  const bright = evaluateFrameQuality({ data: brightData, width, height });
  assert.equal(bright.status, "OVEREXPOSED");

  // 3. Backlit subject: dark box inside bright background
  const backlitData = new Uint8ClampedArray(width * height * 4).fill(235);
  for (let y = 12; y < 28; y++) {
    for (let x = 12; x < 28; x++) {
      const idx = (y * width + x) * 4;
      backlitData[idx] = 30;
      backlitData[idx + 1] = 30;
      backlitData[idx + 2] = 30;
      backlitData[idx + 3] = 255;
    }
  }
  const backlit = evaluateFrameQuality(
    { data: backlitData, width, height },
    { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
  );
  assert.equal(backlit.status, "BACKLIT");

  // 4. Blurry frame: low-contrast mid-tone subject ROI with near-zero edges
  const blurryData = new Uint8ClampedArray(width * height * 4).fill(128);
  for (let y = 12; y < 28; y++) {
    for (let x = 12; x < 28; x++) {
      const idx = (y * width + x) * 4;
      blurryData[idx] = 130;
      blurryData[idx + 1] = 130;
      blurryData[idx + 2] = 130;
      blurryData[idx + 3] = 255;
    }
  }
  const blurry = evaluateFrameQuality(
    { data: blurryData, width, height },
    { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
  );
  assert.equal(blurry.status, "BLURRY");
});

test("detectFaceClusters isolates multiple separated faces for GROUP scenes and rejects uniform warm walls", () => {
  const width = 120;
  const height = 80;

  // 1. Two separated faces -> should isolate 2 clusters -> GROUP classification
  const groupData = new Uint8ClampedArray(width * height * 4).fill(35);
  const paintBox = (x0, x1, y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * width + x) * 4;
        groupData[idx] = 212;
        groupData[idx + 1] = 158;
        groupData[idx + 2] = 126;
        groupData[idx + 3] = 255;
      }
    }
  };
  paintBox(15, 37, 15, 42);
  paintBox(75, 97, 15, 42);

  const clusters = detectFaceClusters(groupData, width, height);
  assert.equal(clusters.length, 2);
  const groupScene = classifyScene({
    faces: clusters.map((c) => ({ boundingBox: c, confidence: c.confidence })),
  });
  assert.equal(groupScene.type, "GROUP");

  // 2. Uniform giant warm-colored wall covering >60% with zero internal contrast -> rejected
  const wallData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    wallData[i * 4] = 205;
    wallData[i * 4 + 1] = 155;
    wallData[i * 4 + 2] = 128;
    wallData[i * 4 + 3] = 255;
  }
  assert.equal(detectFaceClusters(wallData, width, height).length, 0);
});

test("PipelineProcessor projects subject bounds accurately inside zoomed/cropped cropRegion", async () => {
  const adapter = new MockPerceptionAdapter("SUBJECT_TOO_SMALL");
  // Mock SUBJECT_TOO_SMALL returns x=0.47, y=0.20, w=0.06, h=0.08
  const processor = new PipelineProcessor({
    adapter,
    config: {
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
        stabilityDurationMs: 750,
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
    },
  });

  const frame = {
    frameId: "crop_1",
    timestamp: 1000,
    width: 1280,
    height: 720,
    orientation: "LANDSCAPE",
    source: { type: "SYNTHETIC" },
    payload: { kind: "OPAQUE_REF", refId: "crop_1" },
  };

  // Zoomed 2.5x centered region (x: 0.3..0.7, y: 0.1..0.5) should scale subject size 2.5x
  const croppedResult = await processor.processFrame(frame, {
    cropRegion: { x: 0.3, y: 0.1, width: 0.4, height: 0.4 },
  });

  const bounds = croppedResult.composition.primarySubjectBounds;
  assert.ok(bounds, "Expected projected subject bounds inside zoomed crop");
  assert.ok(Math.abs(bounds.width - 0.15) < 0.01, `Expected scaled width ~0.15, got ${bounds.width}`);
  assert.ok(Math.abs(bounds.height - 0.2) < 0.01, `Expected scaled height ~0.20, got ${bounds.height}`);
  assert.equal(typeof croppedResult.inferenceLatencyMs, "number");
  assert.equal(typeof croppedResult.guidanceLatencyMs, "number");
});

test("RealPerceptionAdapter negates horizon angle when frame is horizontally mirrored", async () => {
  const adapter = new RealPerceptionAdapter();
  const width = 100;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4);

  // Sloped horizon: top sky bright (230), bottom ground dark (30), tilted downward right (+dy)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const boundary = 40 + (x / width) * 16;
      const val = y < boundary ? 230 : 30;
      const idx = (y * width + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const baseFrame = {
    frameId: "hor_mirror_1",
    timestamp: 1000,
    width,
    height,
    orientation: "LANDSCAPE",
    source: { type: "WEBCAM" },
    payload: { kind: "OPAQUE_REF", refId: "hor_mirror_1", metadata: { mirrored: false } },
  };
  const mirroredFrame = {
    ...baseFrame,
    frameId: "hor_mirror_2",
    payload: { kind: "OPAQUE_REF", refId: "hor_mirror_2", metadata: { mirrored: true } },
  };

  const rawRes = await adapter.processFrame(baseFrame, { pixelData: { data, width, height } });
  const mirroredRes = await adapter.processFrame(mirroredFrame, { pixelData: { data, width, height } });

  assert.equal(rawRes.horizon?.detected, true);
  assert.equal(mirroredRes.horizon?.detected, true);
  assert.ok(rawRes.horizon.angleDegrees > 5);
  assert.ok(mirroredRes.horizon.angleDegrees < -5);
});
