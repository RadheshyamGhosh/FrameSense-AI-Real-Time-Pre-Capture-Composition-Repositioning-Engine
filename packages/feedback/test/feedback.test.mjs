import assert from "node:assert/strict";
import test from "node:test";

import {
  DiagnosticsCollector,
  FeedbackDispatcher,
  HapticController,
  VoiceAnnouncer,
} from "../dist/index.js";

// Mock SpeechProvider
function createMockSpeechProvider() {
  const spoken = [];
  let speaking = false;

  return {
    speak: (text, options) => {
      spoken.push({ text, options });
      speaking = true;
    },
    cancel: () => {
      speaking = false;
    },
    isSpeaking: () => speaking,
    getSpoken: () => spoken,
    setSpeaking: (val) => {
      speaking = val;
    },
  };
}

// Mock HapticsProvider
function createMockHapticsProvider() {
  const vibrations = [];
  return {
    vibrate: (pattern) => {
      vibrations.push(pattern);
      return true;
    },
    cancel: () => {},
    getVibrations: () => vibrations,
  };
}

test("VoiceAnnouncer speaks, respects repetition cap, and interrupts on URGENT", () => {
  const mockProvider = createMockSpeechProvider();
  const announcer = new VoiceAnnouncer({
    provider: mockProvider,
    defaultMaxRepeats: 2,
  });

  // First announcement
  const s1 = announcer.announce("Tilt up slightly", "MEDIUM");
  assert.equal(s1, true);
  assert.equal(mockProvider.getSpoken().length, 1);
  assert.equal(mockProvider.getSpoken()[0].text, "Tilt up slightly");

  // Second repetition: allowed
  mockProvider.setSpeaking(false);
  const s2 = announcer.announce("Tilt up slightly", "MEDIUM");
  assert.equal(s2, true);

  // Third repetition: suppressed by maxRepeats cap (2)
  mockProvider.setSpeaking(false);
  const s3 = announcer.announce("Tilt up slightly", "MEDIUM");
  assert.equal(s3, false);
  assert.equal(mockProvider.getSpoken().length, 2);

  // Urgent priority interrupts
  mockProvider.setSpeaking(true);
  const s4 = announcer.announce("Hold still! Capturing!", "URGENT");
  assert.equal(s4, true);
  assert.equal(mockProvider.getSpoken().length, 3);
  assert.equal(mockProvider.getSpoken()[2].text, "Hold still! Capturing!");
});

test("VoiceAnnouncer respects mute toggle", () => {
  const mockProvider = createMockSpeechProvider();
  const announcer = new VoiceAnnouncer({ provider: mockProvider, enabled: false });

  const spoken = announcer.announce("Move closer", "HIGH");
  assert.equal(spoken, false);
  assert.equal(mockProvider.getSpoken().length, 0);

  announcer.setEnabled(true);
  const spokenNow = announcer.announce("Move closer", "HIGH");
  assert.equal(spokenNow, true);
  assert.equal(mockProvider.getSpoken().length, 1);
});

test("HapticController triggers appropriate vibration patterns", () => {
  const mockProvider = createMockHapticsProvider();
  const haptics = new HapticController({ provider: mockProvider });

  haptics.triggerGuidanceTick();
  assert.deepEqual(mockProvider.getVibrations()[0], 40);

  haptics.triggerCaptureReady();
  assert.deepEqual(mockProvider.getVibrations()[1], [60, 50, 100]);

  haptics.triggerShutter();
  assert.deepEqual(mockProvider.getVibrations()[2], 120);

  haptics.setEnabled(false);
  const blocked = haptics.triggerGuidanceTick();
  assert.equal(blocked, false);
});

test("FeedbackDispatcher coordinates visual, voice, and haptic modalities", () => {
  const mockSpeech = createMockSpeechProvider();
  const mockHaptics = createMockHapticsProvider();

  const voice = new VoiceAnnouncer({ provider: mockSpeech });
  const haptics = new HapticController({ provider: mockHaptics });

  const dispatcher = new FeedbackDispatcher({
    voiceAnnouncer: voice,
    hapticController: haptics,
  });

  const visualReceived = [];
  const unsubscribe = dispatcher.onVisualCommand((cmd) => {
    visualReceived.push(cmd);
  });

  const guidance = {
    action: "TILT_UP",
    direction: "UP",
    priority: "HIGH",
    confidence: 0.9,
    message: "Tilt camera up",
    timestamp: 1000,
  };

  const commands = dispatcher.dispatch(guidance);

  assert.equal(commands.length, 3);
  assert.equal(commands[0].channel, "VISUAL");
  assert.equal(commands[1].channel, "VOICE");
  assert.equal(commands[2].channel, "HAPTIC");

  assert.equal(visualReceived.length, 1);
  assert.equal(visualReceived[0].action, "TILT_UP");

  assert.equal(mockSpeech.getSpoken().length, 1);
  assert.deepEqual(mockHaptics.getVibrations()[0], 40);

  unsubscribe();
});

test("DiagnosticsCollector computes rolling FPS, average latencies, and evaluates compliance", () => {
  const collector = new DiagnosticsCollector();

  // Simulate 31 camera frames at 30 fps (~33.3ms intervals)
  let time = 1000;
  for (let i = 0; i < 31; i++) {
    collector.recordCameraFrame(time);
    time += 33.33;
  }

  // Simulate 16 processing cycles at 15 fps (~66.6ms intervals)
  let procTime = 1000;
  for (let i = 0; i < 16; i++) {
    collector.recordProcessingCycle(procTime, 25, 5, 30);
    procTime += 66.66;
  }

  const sample = collector.sample(procTime);

  assert.ok(sample.cameraFps >= 29 && sample.cameraFps <= 31, `Expected ~30 FPS, got ${sample.cameraFps}`);
  assert.ok(sample.processingFps >= 14 && sample.processingFps <= 16, `Expected ~15 FPS, got ${sample.processingFps}`);
  assert.equal(sample.inferenceLatencyMs, 25);
  assert.equal(sample.guidanceLatencyMs, 5);
  assert.equal(sample.endToEndLatencyMs, 30);

  const targetConfig = {
    targetCameraFps: 30,
    targetProcessingFps: 15,
    targetInferenceLatencyMs: 75,
    targetEndToEndLatencyMs: 150,
    diagnosticsSamplingIntervalMs: 1000,
  };

  const compliance = collector.checkCompliance(sample, targetConfig);
  assert.equal(compliance.meetsCameraFps, true);
  assert.equal(compliance.meetsProcessingFps, true);
  assert.equal(compliance.meetsInferenceLatency, true);
  assert.equal(compliance.meetsEndToEndLatency, true);
  assert.equal(compliance.allPass, true);
});
