import type { CaptureDecision } from "@framesense/core";
import type { MockPerceptionPreset } from "@framesense/perception";
import {
  ActivityIcon,
  ApertureIcon,
  GalleryIcon,
  GridIcon,
  ScorecardIcon,
  SettingsIcon,
  VoiceOffIcon,
  VoiceOnIcon,
  ZapIcon,
} from "./Icons.js";

export interface ShutterControlsProps {
  readonly captureDecision: CaptureDecision | null;
  readonly isAutoCapture: boolean;
  readonly showGrid: boolean;
  readonly voiceEnabled: boolean;
  readonly showScorecard: boolean;
  readonly showCameraControls: boolean;
  readonly showDiagnostics: boolean;
  readonly useSynthetic: boolean;
  readonly syntheticPreset: MockPerceptionPreset;
  readonly capturedCount?: number;
  readonly latestThumbUrl?: string | null;
  readonly onToggleAutoCapture: () => void;
  readonly onToggleGrid: () => void;
  readonly onToggleVoice: () => void;
  readonly onToggleScorecard: () => void;
  readonly onToggleCameraControls: () => void;
  readonly onTakePhoto: () => void;
  readonly onToggleSettings: () => void;
  readonly onToggleDiagnostics: () => void;
  readonly onOpenGallery?: () => void;
  readonly onSelectPreset?: (preset: MockPerceptionPreset) => void;
  readonly disabled?: boolean;
}

const SIM_QUICK_PRESETS: { value: MockPerceptionPreset; short: string }[] = [
  { value: "PERFECT_PORTRAIT", short: "Optimal" },
  { value: "CUTOFF_HEADROOM", short: "Cutoff" },
  { value: "EXCESS_HEADROOM", short: "Low Head" },
  { value: "SUBJECT_TOO_SMALL", short: "Too Far" },
  { value: "SUBJECT_TOO_LARGE", short: "Too Close" },
  { value: "TILTED_HORIZON", short: "Tilted" },
  { value: "GROUP_PHOTO", short: "Group" },
  { value: "LANDSCAPE", short: "Landscape" },
  { value: "EMPTY", short: "Empty" },
];

export function ShutterControls({
  captureDecision,
  isAutoCapture,
  showGrid,
  voiceEnabled,
  showScorecard,
  showCameraControls,
  showDiagnostics,
  useSynthetic,
  syntheticPreset,
  capturedCount = 0,
  latestThumbUrl,
  onToggleAutoCapture,
  onToggleGrid,
  onToggleVoice,
  onToggleScorecard,
  onToggleCameraControls,
  onTakePhoto,
  onToggleSettings,
  onToggleDiagnostics,
  onOpenGallery,
  onSelectPreset,
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
    <footer className="shutter-controls-wrap">
      {useSynthetic && onSelectPreset && (
        <div className="sim-preset-bar" role="group" aria-label="Quick simulation presets">
          {SIM_QUICK_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`sim-chip ${syntheticPreset === p.value ? "active" : ""}`}
              onClick={() => onSelectPreset(p.value)}
            >
              {p.short}
            </button>
          ))}
        </div>
      )}

      <div className="studio-dock">
        {/* Left Quick Controls */}
        <div className="dock-group">
          <button
            type="button"
            className="dock-thumb-btn"
            onClick={onOpenGallery}
            disabled={capturedCount === 0}
            title={capturedCount > 0 ? `Session Gallery (${capturedCount})` : "No photos captured yet"}
            aria-label={`Session gallery (${capturedCount} photos)`}
          >
            {latestThumbUrl ? (
              <img src={latestThumbUrl} alt="" className="dock-thumb-img" />
            ) : (
              <GalleryIcon size={17} />
            )}
            {capturedCount > 0 && <span className="dock-badge">{capturedCount}</span>}
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showGrid ? "active" : ""}`}
            onClick={onToggleGrid}
            title="Toggle Grid (G)"
            aria-label="Toggle Rule of Thirds grid"
          >
            <GridIcon size={17} />
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${voiceEnabled ? "active" : ""}`}
            onClick={onToggleVoice}
            title="Toggle Voice Guidance (M)"
            aria-label="Toggle voice guidance"
          >
            {voiceEnabled ? <VoiceOnIcon size={17} /> : <VoiceOffIcon size={17} />}
          </button>
        </div>

        {/* Center: Tactile Shutter with Stability Ring */}
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
            title={isReady ? "Capture photo (Space)" : "Capture photo (Space)"}
            aria-label="Capture photo"
          >
            <span className="shutter-inner" />
          </button>
        </div>

        {/* Right Quick Controls */}
        <div className="dock-group">
          <button
            type="button"
            className={`dock-pill-btn ${isAutoCapture ? "active" : ""}`}
            onClick={onToggleAutoCapture}
            title="Toggle Auto-Shutter (A)"
            aria-label="Toggle Auto Shutter"
          >
            <ZapIcon size={14} />
            <span>{isAutoCapture ? "Auto" : "Manual"}</span>
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showCameraControls ? "active" : ""}`}
            onClick={onToggleCameraControls}
            title="Camera & Lens Controls (Zoom / EV / 4K)"
            aria-label="Toggle hardware camera controls"
          >
            <ApertureIcon size={17} />
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showScorecard ? "active" : ""}`}
            onClick={onToggleScorecard}
            title="Live Scorecard (I)"
            aria-label="Toggle live scorecard"
          >
            <ScorecardIcon size={17} />
          </button>

          <button
            type="button"
            className={`dock-icon-btn ${showDiagnostics ? "active" : ""}`}
            onClick={onToggleDiagnostics}
            title="Performance Telemetry"
            aria-label="Open telemetry diagnostics"
          >
            <ActivityIcon size={17} />
          </button>

          <button
            type="button"
            className="dock-icon-btn"
            onClick={onToggleSettings}
            title="Settings & Camera Setup"
            aria-label="Open settings"
          >
            <SettingsIcon size={17} />
          </button>
        </div>
      </div>
    </footer>
  );
}
