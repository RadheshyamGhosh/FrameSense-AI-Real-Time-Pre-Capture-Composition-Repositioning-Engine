export {
  DiagnosticsCollector,
  type DiagnosticsCollectorOptions,
  type PerformanceCompliance,
} from "./diagnostics.js";
export {
  FeedbackDispatcher,
  type FeedbackDispatcherOptions,
} from "./dispatcher.js";
export {
  BrowserHapticsProvider,
  HapticController,
  type HapticControllerOptions,
} from "./haptics.js";
export {
  BrowserAudioProvider,
  SoundController,
  type SoundControllerOptions,
  type SoundEffectsProvider,
} from "./sound.js";
export type {
  FeedbackListener,
  FeedbackSettings,
  HapticsProvider,
  SpeechProvider,
} from "./types.js";
export {
  BrowserSpeechProvider,
  VoiceAnnouncer,
  type VoiceAnnouncerOptions,
} from "./voice.js";
