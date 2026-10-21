import type { GuidancePriority } from "@framesense/core";
import type { SpeechProvider } from "./types.js";

export class BrowserSpeechProvider implements SpeechProvider {
  public speak(
    text: string,
    options?: { rate?: number; pitch?: number; volume?: number },
  ): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      // Resume audio context if paused (common Chrome issue)
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Cancel previous utterance to avoid queue congestion
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      if (options?.rate !== undefined) utterance.rate = options.rate;
      if (options?.pitch !== undefined) utterance.pitch = options.pitch;
      if (options?.volume !== undefined) utterance.volume = options.volume;

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis error fallback
    }
  }

  public cancel(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Fallback
      }
    }
  }

  public isSpeaking(): boolean {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}

export interface VoiceAnnouncerOptions {
  readonly provider?: SpeechProvider;
  readonly enabled?: boolean;
  readonly rate?: number;
  readonly pitch?: number;
  readonly volume?: number;
  readonly defaultMaxRepeats?: number;
}

export class VoiceAnnouncer {
  private readonly provider: SpeechProvider;
  private enabled: boolean;
  private readonly rate: number;
  private readonly pitch: number;
  private readonly volume: number;
  private readonly defaultMaxRepeats: number;

  private lastSpokenText: string | null = null;
  private repeatCount = 0;

  constructor(options?: VoiceAnnouncerOptions) {
    this.provider = options?.provider ?? new BrowserSpeechProvider();
    this.enabled = options?.enabled ?? true;
    this.rate = options?.rate ?? 1.05;
    this.pitch = options?.pitch ?? 1.0;
    this.volume = options?.volume ?? 1.0;
    this.defaultMaxRepeats = options?.defaultMaxRepeats ?? 4;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Evaluates text and priority to decide whether to speak the utterance.
   */
  public announce(
    text: string,
    priority: GuidancePriority,
    maxRepeats?: number,
  ): boolean {
    if (!this.enabled || !text.trim()) {
      return false;
    }

    const allowedRepeats = maxRepeats ?? this.defaultMaxRepeats;
    const isSameText = this.lastSpokenText === text;

    if (isSameText) {
      if (this.repeatCount >= allowedRepeats) {
        return false;
      }
      this.repeatCount++;
    } else {
      this.lastSpokenText = text;
      this.repeatCount = 1;
    }

    const isSpeaking = this.provider.isSpeaking();

    // Urgent or High priority cancels ongoing speech immediately
    if (priority === "URGENT" || priority === "HIGH") {
      this.provider.cancel();
    } else if (isSpeaking) {
      // Don't interrupt for lower priority cues
      return false;
    }

    this.provider.speak(text, {
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
    });

    return true;
  }

  public cancel(): void {
    this.provider.cancel();
    this.lastSpokenText = null;
    this.repeatCount = 0;
  }

  public getRepeatCount(): number {
    return this.repeatCount;
  }
}
