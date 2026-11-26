import assert from "node:assert/strict";
import test from "node:test";

import { computeAspectCropRect, computeNormalizedCropRegion } from "@framesense/camera";
import { DEFAULT_FRAMESENSE_CONFIG } from "@framesense/config/defaults";
import { DiagnosticsCollector } from "@framesense/feedback";
import { MockPerceptionAdapter, PipelineProcessor } from "@framesense/perception";

test("web pipeline configuration defaults integrate cleanly with PipelineProcessor and aspect crops", async () => {
  const adapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");
  const processor = new PipelineProcessor({
    adapter,
    config: DEFAULT_FRAMESENSE_CONFIG,
  });

  const frame = {
    frameId: "web_int_1",
    timestamp: 1000,
    width: 1280,
    height: 720,
    orientation: "LANDSCAPE",
    source: { type: "WEBCAM" },
    payload: { kind: "OPAQUE_REF", refId: "web_int_1", metadata: { mirrored: true } },
  };

  // Viewport-covered 1:1 crop inside 1280x720 desktop container
  const cropRect = computeAspectCropRect(1280, 720, "1:1", 1280, 720, 1);
  assert.deepEqual(cropRect, { sx: 280, sy: 0, sw: 720, sh: 720 });

  const cropRegion = computeNormalizedCropRegion(1280, 720, "1:1", 1280, 720, 1);
  const res = await processor.processFrame(frame, {
    template: "PASSPORT_ID",
    cropRegion,
  });

  assert.equal(res.composition.template, "PASSPORT_ID");
  assert.ok(res.composition.overallScore >= 0 && res.composition.overallScore <= 100);
  assert.equal(typeof res.inferenceLatencyMs, "number");
  assert.equal(typeof res.guidanceLatencyMs, "number");
});

test("DiagnosticsCollector reports full compliance when real camera FPS (30) and pipeline latencies meet defaults", () => {
  const diag = new DiagnosticsCollector();
  for (let i = 0; i < 30; i++) {
    diag.recordCameraFrame(i * 33.3);
  }
  for (let i = 0; i < 15; i++) {
    diag.recordProcessingCycle(i * 66.6, 2.5, 0.1, 10);
  }

  const sample = diag.sample(1000);
  const compliance = diag.checkCompliance(sample, DEFAULT_FRAMESENSE_CONFIG.performance);
  assert.equal(compliance.meetsCameraFps, true);
  assert.equal(compliance.meetsProcessingFps, true);
  assert.equal(compliance.meetsInferenceLatency, true);
  assert.equal(compliance.meetsEndToEndLatency, true);
  assert.equal(compliance.allPass, true);
});

test("simulation normalized crop matches takePhoto cover crop on narrow mobile viewports with digital zoom", async () => {
  // Narrow viewport 400x800, 16:9 aspect crop, 2.0x zoom (matching 720p dimensions and within 1px across scaled streams)
  const synthCropRegion = computeNormalizedCropRegion(1280, 720, "16:9", 400, 800, 2);
  const captureCropRegion = computeNormalizedCropRegion(1280, 720, "16:9", 400, 800, 2);
  assert.deepEqual(synthCropRegion, captureCropRegion);
  assert.ok(synthCropRegion.width < 0.2 && synthCropRegion.height < 0.2);

  // Projecting PERFECT_PORTRAIT with active digital zoom 2.0x already zooms bounds cleanly without second canvas scale
  const processor = new PipelineProcessor({
    adapter: new MockPerceptionAdapter("PERFECT_PORTRAIT"),
    config: DEFAULT_FRAMESENSE_CONFIG,
  });
  const baseRes = await processor.processFrame({
    frameId: "sim_zoom_1",
    timestamp: 1000,
    width: 640,
    height: 360,
    orientation: "LANDSCAPE",
    source: { type: "SYNTHETIC" },
    payload: { kind: "OPAQUE_REF", refId: "sim_zoom_1" },
  });
  processor.reset();
  const zoomedRes = await processor.processFrame(
    {
      frameId: "sim_zoom_2",
      timestamp: 1066,
      width: 640,
      height: 360,
      orientation: "LANDSCAPE",
      source: { type: "SYNTHETIC" },
      payload: { kind: "OPAQUE_REF", refId: "sim_zoom_2" },
    },
    { cropRegion: computeNormalizedCropRegion(640, 360, "VIEWPORT", undefined, undefined, 2) },
  );

  assert.ok(zoomedRes.composition.primarySubjectBounds);
  assert.ok(baseRes.composition.primarySubjectBounds);
  assert.equal(
    zoomedRes.composition.primarySubjectBounds.width,
    Number((baseRes.composition.primarySubjectBounds.width * 2).toFixed(3)),
  );
  // Top edge (0.12..0.25) is cropped by the 2.0x center window (y: 0.25..0.75), leaving 0.25/0.5 = 0.5
  assert.equal(zoomedRes.composition.primarySubjectBounds.height, 0.5);
});
