import type { CaptureDecision } from "@framesense/core";

export interface ShutterControlsProps {
  readonly captureDecision: CaptureDecision | null;
  readonly isAutoCapture: boolean;
  readonly capturedCount?: number;
  readonly onToggleAutoCapture: () => void;
  readonly onTakePhoto: () => void;
  readonly onToggleSettings: () => void;
  readonly onToggleDiagnostics: () => void;
  readonly onOpenGallery?: () => void;
  readonly disabled?: boolean;
}

export function ShutterControls({
  captureDecision,
  isAutoCapture,
  capturedCount = 0,
  onToggleAutoCapture,
  onTakePhoto,
  onToggleSettings,
  onToggleDiagnostics,
  onOpenGallery,
  disabled = false,
}: ShutterControlsProps) {
  const isReady = captureDecision?.ready ?? false;
  const isStabilizing = captureDecision?.stability === "STABILIZING";
  const progress =
    captureDecision?.stabilityProgress ?? (isReady ? 1 : isStabilizing ? 0.35 : 0);
  const clampedProgress = Math.min(1, Math.max(0, progress));

  let ringClass = "stability-unstable";
  if (isReady) {
    ringClass = "stability-ready";
  } else if (isStabilizing) {
    ringClass = "stability-stabilizing";
  }

  return (
    <footer className="shutter-controls">
      {/* Left buttons: Settings & Session Gallery */}
      <div className="hud-actions-left">
        <button
          type="button"
          className="hud-button icon-btn"
          onClick={onToggleSettings}
          title="Settings & Presets"
          aria-label="Open settings"
        >
          ⚙
        </button>

        {capturedCount > 0 && onOpenGallery && (
          <button
            type="button"
            className="hud-button auto-shutter-btn"
            onClick={onOpenGallery}
            title="View Session Photos"
            aria-label={`Open session gallery (${capturedCount} photos)`}
          >
            🖼 {capturedCount}
          </button>
        )}
      </div>

      {/* Center: Shutter Button with Circular Stability Ring */}
      <div className="shutter-wrapper">
        {isAutoCapture && (isStabilizing || isReady) && (
          <span className="stability-countdown-pill" aria-live="polite">
            {isReady ? "Capturing" : `${Math.round(clampedProgress * 100)}%`}
          </span>
        )}
        <svg className={`stability-ring ${ringClass}`} viewBox="0 0 84 84">
          <circle className="ring-background" cx="42" cy="42" r="38" />
          <circle
            className="ring-progress"
            cx="42"
            cy="42"
            r="38"
            strokeDasharray="238.76"
            strokeDashoffset={238.76 * (1 - clampedProgress)}
          />
        </svg>

        <button
          type="button"
          className="shutter-button"
          onClick={onTakePhoto}
          disabled={disabled}
          title={isReady ? "Capture photo!" : "Hold steady to capture"}
          aria-label="Capture photo"
        >
          <span className="shutter-inner" />
        </button>
      </div>

      {/* Right controls: Auto Capture Toggle & Diagnostics Toggle */}
      <div className="hud-actions-right">
        <button
          type="button"
          className={`hud-button auto-shutter-btn ${isAutoCapture ? "active" : ""}`}
          onClick={onToggleAutoCapture}
          title="Toggle Auto Shutter"
          aria-label="Toggle Auto Shutter"
        >
          {isAutoCapture ? "⚡ Auto: ON" : "⚪ Auto: OFF"}
        </button>

        <button
          type="button"
          className="hud-button icon-btn"
          onClick={onToggleDiagnostics}
          title="Performance Telemetry"
          aria-label="Open diagnostics"
        >
          📊
        </button>
      </div>
    </footer>
  );
}
