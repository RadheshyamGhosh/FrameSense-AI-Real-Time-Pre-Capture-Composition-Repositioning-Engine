import type { AspectRatioPreset, CameraDeviceInfo } from "@framesense/camera";
import type { SceneType } from "@framesense/core";
import type { MockPerceptionPreset } from "@framesense/perception";

export type SceneModeSelection = SceneType | "AUTO";

export interface SettingsModalProps {
  readonly availableDevices: CameraDeviceInfo[];
  readonly activeDeviceId: string | null;
  readonly useSynthetic: boolean;
  readonly syntheticPreset: MockPerceptionPreset;
  readonly sceneProfile: SceneModeSelection;
  readonly aspectRatio: AspectRatioPreset;
  readonly mirrorSavedPhoto: boolean;
  readonly showGrid: boolean;
  readonly voiceEnabled: boolean;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly onClose: () => void;
  readonly onSelectDevice: (deviceId: string) => void;
  readonly onToggleSynthetic: (synthetic: boolean) => void;
  readonly onSelectPreset: (preset: MockPerceptionPreset) => void;
  readonly onSelectSceneProfile: (profile: SceneModeSelection) => void;
  readonly onSelectAspectRatio: (ratio: AspectRatioPreset) => void;
  readonly onToggleMirrorSavedPhoto: (mirror: boolean) => void;
  readonly onToggleGrid: (show: boolean) => void;
  readonly onToggleVoice: (enabled: boolean) => void;
  readonly onToggleSound: (enabled: boolean) => void;
  readonly onToggleHaptics: (enabled: boolean) => void;
}

const ASPECT_RATIOS: { value: AspectRatioPreset; label: string }[] = [
  { value: "VIEWPORT", label: "Match Screen (Full Viewfinder)" },
  { value: "16:9", label: "16:9 Widescreen" },
  { value: "4:3", label: "4:3 Standard" },
  { value: "1:1", label: "1:1 Square" },
  { value: "9:16", label: "9:16 Vertical Portrait" },
];

const SCENE_PROFILES: { value: SceneModeSelection; label: string }[] = [
  { value: "AUTO", label: "Auto-Detect Scene" },
  { value: "PORTRAIT", label: "Portrait / Selfie" },
  { value: "GROUP", label: "Group Photo" },
  { value: "LANDSCAPE", label: "Landscape" },
  { value: "ARCHITECTURE", label: "Architecture / Symmetry" },
  { value: "FOOD", label: "Food / Tabletop" },
];

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
  sceneProfile,
  aspectRatio,
  mirrorSavedPhoto,
  showGrid,
  voiceEnabled,
  soundEnabled,
  hapticsEnabled,
  onClose,
  onSelectDevice,
  onToggleSynthetic,
  onSelectPreset,
  onSelectSceneProfile,
  onSelectAspectRatio,
  onToggleMirrorSavedPhoto,
  onToggleGrid,
  onToggleVoice,
  onToggleSound,
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

          {/* Composition Scene Profile Override & Aspect Crop */}
          <section className="setting-section">
            <h3>Framing & Export</h3>
            <div className="select-row">
              <label htmlFor="scene-profile-select">Evaluation Mode:</label>
              <select
                id="scene-profile-select"
                value={sceneProfile}
                onChange={(e) => onSelectSceneProfile(e.target.value as SceneModeSelection)}
                className="device-dropdown"
              >
                {SCENE_PROFILES.map((sp) => (
                  <option key={sp.value} value={sp.value}>
                    {sp.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="select-row" style={{ marginTop: "0.75rem" }}>
              <label htmlFor="aspect-ratio-select">Capture Aspect Ratio:</label>
              <select
                id="aspect-ratio-select"
                value={aspectRatio}
                onChange={(e) => onSelectAspectRatio(e.target.value as AspectRatioPreset)}
                className="device-dropdown"
              >
                {ASPECT_RATIOS.map((ar) => (
                  <option key={ar.value} value={ar.value}>
                    {ar.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Feedback & Overlay Preferences */}
          <section className="setting-section">
            <h3>Viewfinder Overlays & Cues</h3>
            <div className="toggle-list">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={mirrorSavedPhoto}
                  onChange={(e) => onToggleMirrorSavedPhoto(e.target.checked)}
                />
                Mirror Saved Photo (Match Selfie Preview)
              </label>
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
                  checked={soundEnabled}
                  onChange={(e) => onToggleSound(e.target.checked)}
                />
                Chime & Shutter Audio Effects (Web Audio)
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
