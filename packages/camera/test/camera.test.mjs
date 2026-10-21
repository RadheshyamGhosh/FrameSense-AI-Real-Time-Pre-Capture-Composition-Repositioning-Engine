import assert from "node:assert/strict";
import test from "node:test";

import {
  CameraError,
  CameraManager,
  FrameSampler,
  PipelineWorkerBridge,
  SyntheticCameraSource,
} from "../dist/index.js";

// Mock MediaStreamTrack
function createMockTrack(kind = "video", settings = {}) {
  let stopped = false;
  return {
    kind,
    getSettings: () => ({ deviceId: "mock_cam_1", ...settings }),
    stop: () => {
      stopped = true;
    },
    isStopped: () => stopped,
  };
}

// Mock MediaStream
function createMockStream(tracks = [createMockTrack()]) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
  };
}

// Mock MediaDevicesProvider
function createMockMediaDevices(overrides = {}) {
  const devices = [
    { deviceId: "cam_front", kind: "videoinput", label: "FaceTime HD Camera", groupId: "grp1" },
    { deviceId: "cam_back", kind: "videoinput", label: "External Webcam", groupId: "grp2" },
    { deviceId: "mic_1", kind: "audioinput", label: "Built-in Mic", groupId: "grp3" },
  ];

  return {
    enumerateDevices: async () => devices,
    getUserMedia: async () => createMockStream(),
    ...overrides,
  };
}

test("SyntheticCameraSource produces deterministic frames", () => {
  const source = new SyntheticCameraSource({ width: 1280, height: 720, fps: 30 });
  const frame = source.createFrame(150000);

  assert.equal(frame.width, 1280);
  assert.equal(frame.height, 720);
  assert.equal(frame.timestamp, 150000);
  assert.equal(frame.source.type, "SYNTHETIC");
  assert.equal(frame.payload.kind, "OPAQUE_REF");
});

test("CameraManager lists video input devices correctly", async () => {
  const mockProvider = createMockMediaDevices();
  const manager = new CameraManager(mockProvider);

  const devices = await manager.listDevices();
  assert.equal(devices.length, 2);
  assert.equal(devices[0].deviceId, "cam_front");
  assert.equal(devices[1].deviceId, "cam_back");
});

test("CameraManager starts, switches, and stops stream cleanly", async () => {
  const track1 = createMockTrack("video", { deviceId: "cam_front" });
  const track2 = createMockTrack("video", { deviceId: "cam_back" });

  let callCount = 0;
  const mockProvider = createMockMediaDevices({
    getUserMedia: async () => {
      callCount++;
      return createMockStream([callCount === 1 ? track1 : track2]);
    },
  });

  const manager = new CameraManager(mockProvider);
  assert.equal(manager.getStatus(), "IDLE");

  // Start stream
  const stream1 = await manager.start({ width: 1280, height: 720 });
  assert.ok(stream1);
  assert.equal(manager.getStatus(), "STREAMING");

  // Switch camera
  const stream2 = await manager.switchCamera("cam_back");
  assert.ok(stream2);
  assert.ok(track1.isStopped(), "Previous track should have been stopped");

  // Stop camera
  manager.stop();
  assert.equal(manager.getStatus(), "IDLE");
  assert.equal(manager.getCurrentStream(), null);
  assert.ok(track2.isStopped(), "Current track should be stopped");
});

test("CameraManager maps DOMExceptions to typed CameraError codes", async () => {
  const permissionDeniedProvider = createMockMediaDevices({
    getUserMedia: async () => {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    },
  });

  const manager = new CameraManager(permissionDeniedProvider);

  await assert.rejects(
    () => manager.start(),
    (err) => err instanceof CameraError && err.code === "PERMISSION_DENIED",
  );
  assert.equal(manager.getStatus(), "ERROR");
});

test("FrameSampler downscales aspect-preserving dimensions", async () => {
  const sampler = new FrameSampler({ maxWidth: 640, maxHeight: 360 });

  // Mock video element
  const mockVideo = {
    videoWidth: 1920,
    videoHeight: 1080,
  };

  const extracted = await sampler.captureFrameFromVideo(mockVideo, 2000);
  assert.ok(extracted);
  assert.equal(extracted.cameraFrame.width, 640);
  assert.equal(extracted.cameraFrame.height, 360);
  assert.equal(extracted.cameraFrame.source.type, "WEBCAM");
});

test("PipelineWorkerBridge handles message round-trip, busy throttling, and error dispatch", () => {
  const sentMessages = [];
  const listeners = new Map();

  const mockWorker = {
    postMessage: (msg, transfer) => {
      sentMessages.push({ msg, transfer });
    },
    addEventListener: (type, fn) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type) => {
      listeners.delete(type);
    },
    terminate: () => {},
  };

  const bridge = new PipelineWorkerBridge(mockWorker);

  // 1. Initialization
  bridge.initialize({
    composition: {},
    guidance: {},
    inference: {},
    performance: {},
  });
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].msg.type, "INIT");

  // 2. Dispatch frame
  const frame = {
    cameraFrame: {
      frameId: "f_1",
      timestamp: 1000,
      width: 640,
      height: 360,
      orientation: "LANDSCAPE",
      source: { type: "WEBCAM" },
      payload: { kind: "OPAQUE_REF", refId: "f_1" },
    },
  };

  const accepted = bridge.dispatchFrame(frame);
  assert.equal(accepted, true);
  assert.equal(bridge.getIsBusy(), true);

  // Second frame dispatched while busy should be rejected
  const dropped = bridge.dispatchFrame(frame);
  assert.equal(dropped, false);

  // 3. Worker completes processing
  let receivedResult = null;
  bridge.onResult((res) => {
    receivedResult = res;
  });

  const messageHandler = listeners.get("message");
  messageHandler({
    data: {
      type: "FRAME_PROCESSED",
      frameId: "f_1",
      timestamp: 1000,
      processingTimeMs: 12,
      composition: { overallScore: 85, issues: [], metrics: [] },
      guidance: { action: "HOLD" },
      capture: { ready: false },
    },
  });

  assert.ok(receivedResult);
  assert.equal(receivedResult.frameId, "f_1");
  assert.equal(bridge.getIsBusy(), false);

  // 4. Error dispatch
  let receivedError = null;
  bridge.onError((err) => {
    receivedError = err;
  });

  messageHandler({
    data: {
      type: "ERROR",
      error: "Worker inference failure",
    },
  });
  assert.equal(receivedError, "Worker inference failure");
});
