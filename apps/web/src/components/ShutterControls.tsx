import type { CaptureDecision } from "@framesense/core";

export interface ShutterControlsProps {
  readonly captureDecision: CaptureDecision | null;
  readonly isAutoCapture: boolean;
  readonly onToggleAutoCapture: () => void;
  readonly onTakePhoto: () => void;
  readonly onToggleSettings: () => void;
  readonly onToggleDiagnostics: () => void;
  readonly disabled?: boolean;
}

export function ShutterControls({
  captureDecision,
  isAutoCapture,
  onToggleAutoCapture,
  onTakePhoto,
  onToggleSettings,
  onToggleDiagnostics,
  disabled = false,
}: ShutterControlsProps) {
  const isReady = captureDecision?.ready ?? false;
  const isStabilizing = captureDecision?.stability === "STABILIZING";

  let ringClass = "stability-unstable";
  if (isReady) {
    ringClass = "stability-ready";
  } else if (isStabilizing) {
    ringClass = "stability-stabilizing";
  }

  return (
    <footer className="shutter-controls">
      {/* Left button: Settings */}
      <button
        type="button"
        className="hud-button icon-btn"
        onClick={onToggleSettings}
        title="Settings & Presets"
        aria-label="Open settings"
      >
        ⚙
      </button>

      {/* Center: Shutter Button with Circular Stability Ring */}
      <div className="shutter-wrapper">
        <svg className={`stability-ring ${ringClass}`} viewBox="0 0 84 84">
          <circle className="ring-background" cx="42" cy="42" r="38" />
          <circle
            className="ring-progress"
            cx="42"
            cy="42"
            r="38"
            strokeDasharray="238.76"
            strokeDashoffset={isReady ? 0 : isStabilizing ? 100 : 238.76}
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
