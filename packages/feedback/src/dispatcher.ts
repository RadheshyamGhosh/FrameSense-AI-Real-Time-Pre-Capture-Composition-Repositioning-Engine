import type {
  CaptureDecision,
  FeedbackChannel,
  FeedbackCommand,
  GuidanceResult,
} from "@framesense/core";
import { HapticController } from "./haptics.js";
import { SoundController } from "./sound.js";
import type { FeedbackListener, FeedbackSettings } from "./types.js";
import { VoiceAnnouncer } from "./voice.js";

export interface FeedbackDispatcherOptions {
  readonly voiceAnnouncer?: VoiceAnnouncer;
  readonly hapticController?: HapticController;
  readonly soundController?: SoundController;
  readonly initialSettings?: Partial<FeedbackSettings>;
  readonly maxRepeatedAnnouncements?: number;
  readonly voiceMinIntervalMs?: number;
}

export class FeedbackDispatcher {
  private readonly voice: VoiceAnnouncer;
  private readonly haptics: HapticController;
  private readonly sound: SoundController;
  private readonly listeners: Set<FeedbackListener> = new Set();
  private readonly maxRepeatedAnnouncements?: number;
  private settings: FeedbackSettings;
  private wasCaptureReady = false;

  constructor(options?: FeedbackDispatcherOptions) {
    this.voice =
      options?.voiceAnnouncer ??
      new VoiceAnnouncer({
        defaultMaxRepeats: options?.maxRepeatedAnnouncements ?? 2,
        minIntervalMs: options?.voiceMinIntervalMs ?? 2200,
      });
    this.haptics = options?.hapticController ?? new HapticController();
    this.sound = options?.soundController ?? new SoundController();
    this.maxRepeatedAnnouncements = options?.maxRepeatedAnnouncements;

    this.settings = {
      voiceEnabled: options?.initialSettings?.voiceEnabled ?? true,
      hapticsEnabled: options?.initialSettings?.hapticsEnabled ?? true,
      visualEnabled: options?.initialSettings?.visualEnabled ?? true,
      soundEnabled: options?.initialSettings?.soundEnabled ?? true,
      voiceRate: options?.initialSettings?.voiceRate ?? 1.1,
      voicePitch: options?.initialSettings?.voicePitch ?? 1.0,
      voiceVolume: options?.initialSettings?.voiceVolume ?? 1.0,
    };

    this.voice.setEnabled(this.settings.voiceEnabled);
    this.haptics.setEnabled(this.settings.hapticsEnabled);
    this.sound.setEnabled(this.settings.soundEnabled ?? true);
  }

  public updateSettings(partial: Partial<FeedbackSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (partial.voiceEnabled !== undefined) {
      this.voice.setEnabled(partial.voiceEnabled);
    }
    if (partial.hapticsEnabled !== undefined) {
      this.haptics.setEnabled(partial.hapticsEnabled);
    }
    if (partial.soundEnabled !== undefined) {
      this.sound.setEnabled(partial.soundEnabled);
    }
  }

  public getSettings(): FeedbackSettings {
    return this.settings;
  }

  public onVisualCommand(listener: FeedbackListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Dispatches multimodal feedback across Visual, Voice, and Haptic channels.
   */
  public dispatch(
    guidance: GuidanceResult,
    capture?: CaptureDecision,
  ): readonly FeedbackCommand[] {
    const commands: FeedbackCommand[] = [];
    const timestamp = guidance.timestamp;

    // 1. Visual command
    if (this.settings.visualEnabled) {
      const visualCmd: FeedbackCommand = {
        channel: "VISUAL" as FeedbackChannel,
        action: guidance.action,
        priority: guidance.priority,
        message: guidance.message,
        timestamp,
      };
      commands.push(visualCmd);

      for (const listener of this.listeners) {
        listener(visualCmd);
      }
    }

    // 2. Voice command
    if (this.settings.voiceEnabled && guidance.message) {
      const spoken = this.voice.announce(
        guidance.message,
        guidance.priority,
        this.maxRepeatedAnnouncements,
        timestamp,
      );
      if (spoken) {
        commands.push({
          channel: "VOICE" as FeedbackChannel,
          action: guidance.action,
          priority: guidance.priority,
          message: guidance.message,
          timestamp,
        });
      }
    }

    // 3. Sound chime on lock transition
    const isReadyNow = Boolean(capture?.ready);
    if (isReadyNow && !this.wasCaptureReady && (this.settings.soundEnabled ?? true)) {
      this.sound.playLockChime();
    }
    this.wasCaptureReady = isReadyNow;

    // 4. Haptic command
    if (this.settings.hapticsEnabled) {
      if (capture?.ready) {
        this.haptics.triggerCaptureReady();
        commands.push({
          channel: "HAPTIC" as FeedbackChannel,
          action: "CAPTURE_READY",
          priority: "URGENT",
          message: "Capture ready pulse",
          timestamp,
          durationMs: 210,
        });
      } else if (guidance.action !== "NONE" && guidance.action !== "HOLD") {
        this.haptics.triggerGuidanceTick();
        commands.push({
          channel: "HAPTIC" as FeedbackChannel,
          action: guidance.action,
          priority: guidance.priority,
          message: "Guidance direction tick",
          timestamp,
          durationMs: 40,
        });
      }
    }

    return commands;
  }

  public triggerShutterFeedback(): void {
    if (this.settings.soundEnabled ?? true) {
      this.sound.playShutterClick();
    }
    if (this.settings.hapticsEnabled) {
      this.haptics.triggerShutter();
    }
  }

  public reset(): void {
    this.wasCaptureReady = false;
    this.voice.cancel();
    this.haptics.cancel();
  }
}
