import type { HapticsProvider } from "./types.js";

export class BrowserHapticsProvider implements HapticsProvider {
  public vibrate(pattern: number | number[]): boolean {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        return navigator.vibrate(pattern);
      } catch {
        return false;
      }
    }
    return false;
  }

  public cancel(): void {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }
}

export interface HapticControllerOptions {
  readonly provider?: HapticsProvider;
  readonly enabled?: boolean;
}

export class HapticController {
  private readonly provider: HapticsProvider;
  private enabled: boolean;

  constructor(options?: HapticControllerOptions) {
    this.provider = options?.provider ?? new BrowserHapticsProvider();
    this.enabled = options?.enabled ?? true;
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
   * Subtle tick when camera guidance direction changes.
   */
  public triggerGuidanceTick(): boolean {
    if (!this.enabled) return false;
    return this.provider.vibrate(40);
  }

  /**
   * Double pulse indicating framing is steady and capture is ready.
   */
  public triggerCaptureReady(): boolean {
    if (!this.enabled) return false;
    return this.provider.vibrate([60, 50, 100]);
  }

  /**
   * Solid vibration confirming shutter was pressed / triggered.
   */
  public triggerShutter(): boolean {
    if (!this.enabled) return false;
    return this.provider.vibrate(120);
  }

  public cancel(): void {
    this.provider.cancel();
  }
}
