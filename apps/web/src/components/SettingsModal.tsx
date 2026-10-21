import type { CameraDeviceInfo } from "@framesense/camera";
import type { MockPerceptionPreset } from "@framesense/perception";

export interface SettingsModalProps {
  readonly availableDevices: CameraDeviceInfo[];
  readonly activeDeviceId: string | null;
  readonly useSynthetic: boolean;
  readonly syntheticPreset: MockPerceptionPreset;
  readonly showGrid: boolean;
  readonly voiceEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly onClose: () => void;
  readonly onSelectDevice: (deviceId: string) => void;
  readonly onToggleSynthetic: (synthetic: boolean) => void;
  readonly onSelectPreset: (preset: MockPerceptionPreset) => void;
  readonly onToggleGrid: (show: boolean) => void;
  readonly onToggleVoice: (enabled: boolean) => void;
  readonly onToggleHaptics: (enabled: boolean) => void;
}

const PRESETS: { value: MockPerceptionPreset; label: string }[] = [
  { value: "PERFECT_PORTRAIT", label: "Solo Portrait (Optimal 90+)" },
  { value: "CUTOFF_HEADROOM", label: "Headroom Cutoff (Tilt Up)" },
  { value: "EXCESS_HEADROOM", label: "Excess Headroom (Tilt Down)" },
  { value: "SUBJECT_TOO_SMALL", label: "Subject Too Small (Move Closer)" },
  { value: "SUBJECT_TOO_LARGE", label: "Subject Too Large (Step Back)" },
  { value: "TILTED_HORIZON", label: "Tilted Horizon (Level Horizon)" },
  { value: "GROUP_PHOTO", label: "Group Photo (2 Faces)" },
  { value: "LANDSCAPE", label: "Landscape View" },
  { value: "EMPTY", label: "Empty Frame" },
];

export function SettingsModal({
  availableDevices,
  activeDeviceId,
  useSynthetic,
  syntheticPreset,
  showGrid,
  voiceEnabled,
  hapticsEnabled,
  onClose,
  onSelectDevice,
  onToggleSynthetic,
  onSelectPreset,
  onToggleGrid,
  onToggleVoice,
  onToggleHaptics,
}: SettingsModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="settings-modal">
        <header className="review-header">
          <h2 id="settings-title">Camera & Viewfinder Settings</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <div className="settings-body">
          {/* Camera Source Selector */}
          <section className="setting-section">
            <h3>Camera Source</h3>
            <div className="toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={useSynthetic}
                  onChange={(e) => onToggleSynthetic(e.target.checked)}
                />
                Use Simulated / Synthetic Camera Mode
              </label>
            </div>

            {!useSynthetic && availableDevices.length > 0 && (
              <div className="select-row">
                <label htmlFor="device-select">Physical Camera Device:</label>
                <select
                  id="device-select"
                  value={activeDeviceId ?? ""}
                  onChange={(e) => onSelectDevice(e.target.value)}
                  className="device-dropdown"
                >
                  {availableDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {useSynthetic && (
              <div className="select-row">
                <label htmlFor="preset-select">Simulated Scenario Preset:</label>
                <select
                  id="preset-select"
                  value={syntheticPreset}
                  onChange={(e) => onSelectPreset(e.target.value as MockPerceptionPreset)}
                  className="device-dropdown"
                >
                  {PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* Feedback & Overlay Preferences */}
          <section className="setting-section">
            <h3>Viewfinder Overlays & Cues</h3>
            <div className="toggle-list">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => onToggleGrid(e.target.checked)}
                />
                Show Rule of Thirds AR Grid & Power Points
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => onToggleVoice(e.target.checked)}
                />
                Voice Guidance Prompts (Web Speech API)
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={(e) => onToggleHaptics(e.target.checked)}
                />
                Haptic Vibration Feedback
              </label>
            </div>
          </section>
        </div>

        <footer className="settings-footer">
          <button type="button" className="action-btn primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
