import { performance } from "node:perf_hooks";

import { SyntheticCameraSource } from "../packages/camera/dist/index.js";
import { evaluateComposition } from "../packages/composition/dist/index.js";
import { getConfig } from "../packages/config/dist/index.js";
import { createGuidanceEngine } from "../packages/guidance/dist/index.js";
import {
  MockPerceptionAdapter,
  PipelineProcessor,
  RealPerceptionAdapter,
  detectHorizonFromPixels,
} from "../packages/perception/dist/index.js";

function calculateStats(samples) {
  if (samples.length === 0) return { mean: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return {
    mean: Number(mean.toFixed(3)),
    p50: Number(p50.toFixed(3)),
    p95: Number(p95.toFixed(3)),
    p99: Number(p99.toFixed(3)),
  };
}

async function runBenchmarks() {
  console.log("=================================================");
  console.log("   FrameSense AI - Performance Benchmark Suite   ");
  console.log("=================================================\n");

  const config = await getConfig();
  console.log("Configuration Targets:");
  console.log(`- Target Camera FPS:       ${config.performance.targetCameraFps} FPS`);
  console.log(`- Target Processing FPS:   ${config.performance.targetProcessingFps} FPS`);
  console.log(`- Target Inference Latency: <= ${config.performance.targetInferenceLatencyMs} ms`);
  console.log(`- Target End-to-End Latency: <= ${config.performance.targetEndToEndLatencyMs} ms\n`);

  // Benchmark 1: Composition Engine Evaluation
  console.log("1. Benchmarking Composition Engine (@framesense/composition)...");
  const compSamples = [];
  const testContext = {
    frameId: "bench_frame",
    timestamp: 1000,
    frame: { width: 1920, height: 1080 },
    perception: {
      frameId: "bench_frame",
      timestamp: 1000,
      faces: [{ boundingBox: { x: 0.35, y: 0.12, width: 0.3, height: 0.38 }, confidence: 0.95 }],
      poses: [],
      detections: [],
      horizon: { detected: true, angleDegrees: 1.2, confidence: 0.9 },
    },
    scene: "PORTRAIT",
  };

  // Warmup
  for (let i = 0; i < 50; i++) evaluateComposition(testContext, { config: config.composition });

  // 1,000 iterations
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    evaluateComposition(testContext, { config: config.composition });
    compSamples.push(performance.now() - t0);
  }
  const compStats = calculateStats(compSamples);
  console.log(`   Mean: ${compStats.mean} ms | P50: ${compStats.p50} ms | P95: ${compStats.p95} ms | P99: ${compStats.p99} ms`);
  console.log(`   Throughput: ~${Math.round(1000 / (compStats.mean || 0.001))} evaluations/sec\n`);

  // Benchmark 2: Guidance & Auto-Shutter State Machine
  console.log("2. Benchmarking Guidance State Machine (@framesense/guidance)...");
  const guidanceSamples = [];
  const engine = createGuidanceEngine({ config: config.guidance });
  const compResult = evaluateComposition(testContext, { config: config.composition });

  // Warmup
  for (let i = 0; i < 50; i++) engine.update(compResult);
  engine.reset();

  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    engine.update({ ...compResult, timestamp: 1000 + i * 50 });
    guidanceSamples.push(performance.now() - t0);
  }
  const guidanceStats = calculateStats(guidanceSamples);
  console.log(`   Mean: ${guidanceStats.mean} ms | P50: ${guidanceStats.p50} ms | P95: ${guidanceStats.p95} ms | P99: ${guidanceStats.p99} ms`);
  console.log(`   Throughput: ~${Math.round(1000 / (guidanceStats.mean || 0.001))} updates/sec\n`);

  // Benchmark 3: Deterministic Horizon Estimation
  console.log("3. Benchmarking Horizon Tilt Estimation (@framesense/perception)...");
  const horizonSamples = [];
  const width = 640;
  const height = 360;
  const pixelData = new Uint8ClampedArray(width * height * 4);

  // Gradient pattern
  for (let y = 0; y < height; y++) {
    const val = y < 180 ? 220 : 50;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      pixelData[idx] = val;
      pixelData[idx + 1] = val;
      pixelData[idx + 2] = val;
      pixelData[idx + 3] = 255;
    }
  }

  const buffer = { data: pixelData, width, height };
  // Warmup
  for (let i = 0; i < 20; i++) detectHorizonFromPixels(buffer);

  for (let i = 0; i < 500; i++) {
    const t0 = performance.now();
    detectHorizonFromPixels(buffer);
    horizonSamples.push(performance.now() - t0);
  }
  const horizonStats = calculateStats(horizonSamples);
  console.log(`   Mean: ${horizonStats.mean} ms | P50: ${horizonStats.p50} ms | P95: ${horizonStats.p95} ms | P99: ${horizonStats.p99} ms`);
  console.log(`   Throughput: ~${Math.round(1000 / (horizonStats.mean || 0.001))} frames/sec\n`);

  // Benchmark 4: Full Pipeline End-to-End (Mocked Logic)
  console.log("4. Benchmarking Logic Pipeline (MockPerceptionAdapter -> Composition -> Guidance)...");
  const pipelineSamples = [];
  const syntheticCamera = new SyntheticCameraSource({ width: 640, height: 360 });
  const mockAdapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");
  const pipeline = new PipelineProcessor({ adapter: mockAdapter, config });

  // Warmup
  for (let i = 0; i < 20; i++) await pipeline.processFrame(syntheticCamera.createFrame());

  for (let i = 0; i < 500; i++) {
    const frame = syntheticCamera.createFrame(1000 + i * 66);
    const t0 = performance.now();
    await pipeline.processFrame(frame);
    pipelineSamples.push(performance.now() - t0);
  }
  const pipelineStats = calculateStats(pipelineSamples);
  console.log(`   Mean: ${pipelineStats.mean} ms | P50: ${pipelineStats.p50} ms | P95: ${pipelineStats.p95} ms | P99: ${pipelineStats.p99} ms`);
  console.log(`   Max Logic Rate: ~${Math.round(1000 / (pipelineStats.mean || 0.001))} FPS\n`);

  // Benchmark 5: RealPixel End-to-End Inference (RealPerceptionAdapter + 240x160 RGBA Pixels)
  console.log("5. Benchmarking Full Pixel Pipeline (RealPerceptionAdapter 240x160 -> Composition -> Guidance)...");
  const rw = 240;
  const rh = 160;
  const realBuffer = new Uint8ClampedArray(rw * rh * 4).fill(45);
  for (let y = 30; y < 95; y++) {
    for (let x = 90; x < 150; x++) {
      const idx = (y * rw + x) * 4;
      realBuffer[idx] = 212;
      realBuffer[idx + 1] = 158;
      realBuffer[idx + 2] = 128;
      realBuffer[idx + 3] = 255;
    }
  }
  const realAdapter = new RealPerceptionAdapter();
  await realAdapter.initialize();
  const realPipeline = new PipelineProcessor({ adapter: realAdapter, config });
  const realSamples = [];
  const sampleOpts = { pixelData: { data: realBuffer, width: rw, height: rh } };

  for (let i = 0; i < 10; i++) await realPipeline.processFrame(syntheticCamera.createFrame(), sampleOpts);
  for (let i = 0; i < 200; i++) {
    const frame = syntheticCamera.createFrame(2000 + i * 66);
    const t0 = performance.now();
    await realPipeline.processFrame(frame, sampleOpts);
    realSamples.push(performance.now() - t0);
  }
  const realStats = calculateStats(realSamples);
  console.log(`   Mean: ${realStats.mean} ms | P50: ${realStats.p50} ms | P95: ${realStats.p95} ms | P99: ${realStats.p99} ms`);
  console.log(`   Max Real-Pixel Rate: ~${Math.round(1000 / (realStats.mean || 0.001))} FPS\n`);

  console.log("=================================================");
  console.log("                 VERIFICATION RESULTS            ");
  console.log("=================================================");
  const inferencePass = realStats.p95 <= config.performance.targetInferenceLatencyMs;
  const e2ePass = realStats.p99 <= config.performance.targetEndToEndLatencyMs;

  console.log(`- Real-Pixel Inference Target (<= ${config.performance.targetInferenceLatencyMs} ms):  ${inferencePass ? "PASS" : "FAIL"} (Observed P95: ${realStats.p95} ms)`);
  console.log(`- Real-Pixel E2E Latency Target (<= ${config.performance.targetEndToEndLatencyMs} ms): ${e2ePass ? "PASS" : "FAIL"} (Observed P99: ${realStats.p99} ms)`);
  console.log("=================================================\n");

  if (!inferencePass || !e2ePass) {
    process.exitCode = 1;
  }
}

runBenchmarks().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
