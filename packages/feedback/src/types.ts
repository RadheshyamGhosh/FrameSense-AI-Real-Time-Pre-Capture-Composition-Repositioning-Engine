import type { FeedbackCommand } from "@framesense/core";

export interface FeedbackSettings {
  readonly voiceEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly visualEnabled: boolean;
  readonly voiceRate?: number;
  readonly voicePitch?: number;
  readonly voiceVolume?: number;
}

export interface SpeechProvider {
  speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }): void;
  cancel(): void;
  isSpeaking(): boolean;
}

export interface HapticsProvider {
  vibrate(pattern: number | number[]): boolean;
  cancel(): void;
}

export type FeedbackListener = (command: FeedbackCommand) => void;
