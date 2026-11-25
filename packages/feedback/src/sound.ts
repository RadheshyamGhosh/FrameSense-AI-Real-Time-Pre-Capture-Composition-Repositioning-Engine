export interface SoundEffectsProvider {
  playLockChime(): void;
  playShutterClick(): void;
}

export class BrowserAudioProvider implements SoundEffectsProvider {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playLockChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.12, now + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.01);
      };

      playTone(587.33, 0, 0.12); // D5
      playTone(880, 0.09, 0.18); // A5
    } catch {
      // Ignore AudioContext restriction errors
    }
  }

  public playShutterClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.06);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Ignore AudioContext restriction errors
    }
  }
}

export interface SoundControllerOptions {
  readonly provider?: SoundEffectsProvider;
  readonly enabled?: boolean;
}

export class SoundController {
  private readonly provider: SoundEffectsProvider;
  private enabled: boolean;

  constructor(options?: SoundControllerOptions) {
    this.provider = options?.provider ?? new BrowserAudioProvider();
    this.enabled = options?.enabled ?? true;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public playLockChime(): boolean {
    if (!this.enabled) return false;
    this.provider.playLockChime();
    return true;
  }

  public playShutterClick(): boolean {
    if (!this.enabled) return false;
    this.provider.playShutterClick();
    return true;
  }
}
