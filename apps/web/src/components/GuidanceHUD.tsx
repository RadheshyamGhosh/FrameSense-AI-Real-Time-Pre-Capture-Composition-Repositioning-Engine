import type { AspectRatioPreset } from "@framesense/camera";
import type { CompositionResult, FramingTemplate, GuidanceResult, SceneType } from "@framesense/core";
import { CloseIcon, CropIcon, DirectionIcon } from "./Icons.js";
import type { SceneModeSelection } from "./SettingsModal.js";

export interface GuidanceHUDProps {
  readonly guidance: GuidanceResult | null;
  readonly composition: CompositionResult | null;
  readonly sceneProfile: SceneModeSelection;
  readonly aspectRatio: AspectRatioPreset;
  readonly template: FramingTemplate;
  readonly useSynthetic: boolean;
  readonly onCycleSceneProfile: () => void;
  readonly onCycleAspectRatio: () => void;
  readonly onCycleTemplate: () => void;
  readonly onExitCamera: () => void;
}

const SCENE_DISPLAY: Record<SceneType | "AUTO", string> = {
  AUTO: "AUTO",
  PORTRAIT: "PORTRAIT",
  GROUP: "GROUP",
  LANDSCAPE: "LANDSCAPE",
  ARCHITECTURE: "ARCH",
  FOOD: "FOOD",
  UNKNOWN: "AUTO",
};

const TEMPLATE_DISPLAY: Record<FramingTemplate, string> = {
  NONE: "STD",
  PASSPORT_ID: "ID OVAL",
  HEADSHOT_PRO: "HEADSHOT",
  CREATOR_TALKING_HEAD: "CREATOR",
};

export function GuidanceHUD({
  guidance,
  composition,
  sceneProfile,
  aspectRatio,
  template,
  useSynthetic,
  onCycleSceneProfile,
  onCycleAspectRatio,
  onCycleTemplate,
  onExitCamera,
}: GuidanceHUDProps) {
  const score = composition?.overallScore ?? 0;

  let scoreColorClass = "score-poor";
  let gradeLabel = "Adjust";
  if (score >= 90) {
    scoreColorClass = "score-excellent";
    gradeLabel = "Optimal";
  } else if (score >= 70) {
    scoreColorClass = "score-good";
    gradeLabel = "Good";
  }

  const message = guidance?.message || "Aligning camera feed...";
  const qualityWarning = composition?.frameQuality?.warning;
  const activeProfileLabel =
    sceneProfile === "AUTO"
      ? `AUTO · ${SCENE_DISPLAY[composition?.profile ?? "UNKNOWN"]}`
      : SCENE_DISPLAY[sceneProfile];

  return (
    <header className="guidance-hud">
      {/* Left: Score Pill & Camera Mode Tag */}
      <div className="hud-cluster-left">
        <div className={`score-badge ${scoreColorClass}`} aria-label={`Composition score ${score}`}>
          <span className="score-value">{score}</span>
          <span className="score-label">{gradeLabel}</span>
        </div>
        {useSynthetic && <span className="mode-chip">SIM</span>}
      </div>

      {/* Center: Main Dynamic Guidance Capsule & Lighting Alert */}
      <div className="guidance-center-stack">
        <div className="guidance-pill" role="status" aria-live="polite">
          <span className="guidance-icon" aria-hidden="true">
            <DirectionIcon direction={guidance?.direction} />
          </span>
          <span className="guidance-text">{message}</span>
        </div>

        {qualityWarning && (
          <div className="quality-warning-pill" role="status">
            {qualityWarning}
          </div>
        )}
      </div>

      {/* Right: Interactive Quick Mode Pills & Exit */}
      <div className="hud-cluster-right">
        <button
          type="button"
          className={`hud-pill-btn ${template !== "NONE" ? "pinned" : ""}`}
          onClick={onCycleTemplate}
          title="Cycle Framing Template (T)"
          aria-label={`Framing template ${TEMPLATE_DISPLAY[template]}. Click to change.`}
        >
          <span>{TEMPLATE_DISPLAY[template]}</span>
        </button>

        <button
          type="button"
          className="hud-pill-btn"
          onClick={onCycleAspectRatio}
          title="Cycle Capture Aspect Ratio"
          aria-label={`Aspect ratio ${aspectRatio}. Click to change.`}
        >
          <CropIcon size={13} />
          <span>{aspectRatio === "VIEWPORT" ? "FULL" : aspectRatio}</span>
        </button>

        <button
          type="button"
          className={`hud-pill-btn ${sceneProfile !== "AUTO" ? "pinned" : ""}`}
          onClick={onCycleSceneProfile}
          title="Cycle Scene Evaluation Profile"
          aria-label={`Scene profile ${activeProfileLabel}. Click to change.`}
        >
          <span>{activeProfileLabel}</span>
        </button>

        <button
          type="button"
          className="exit-camera-btn"
          onClick={onExitCamera}
          title="Exit Camera"
          aria-label="Exit camera"
        >
          <CloseIcon size={14} />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
}
