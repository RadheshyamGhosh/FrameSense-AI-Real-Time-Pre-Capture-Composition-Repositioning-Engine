import type { CompositionResult, GuidanceResult } from "@framesense/core";

export interface GuidanceHUDProps {
  readonly guidance: GuidanceResult | null;
  readonly composition: CompositionResult | null;
}

export function GuidanceHUD({ guidance, composition }: GuidanceHUDProps) {
  const score = composition?.overallScore ?? 0;

  // Determine score grade & color
  let scoreColorClass = "score-poor";
  let gradeLabel = "Adjusting";
  if (score >= 90) {
    scoreColorClass = "score-excellent";
    gradeLabel = "Optimal";
  } else if (score >= 70) {
    scoreColorClass = "score-good";
    gradeLabel = "Good";
  }

  const message = guidance?.message || "Aligning camera feed...";

  // Action direction arrow
  const getDirectionArrow = () => {
    switch (guidance?.direction) {
      case "UP":
        return "▲";
      case "DOWN":
        return "▼";
      case "LEFT":
        return "◀";
      case "RIGHT":
        return "▶";
      case "FORWARD":
        return "⊕";
      case "BACKWARD":
        return "⊖";
      case "CLOCKWISE":
        return "↻";
      case "COUNTERCLOCKWISE":
        return "↺";
      default:
        return "●";
    }
  };

  return (
    <header className="guidance-hud">
      {/* Score Pill */}
      <div className={`score-badge ${scoreColorClass}`} aria-label={`Composition score ${score}`}>
        <span className="score-value">{score}</span>
        <span className="score-label">{gradeLabel}</span>
      </div>

      {/* Main Guidance Banner */}
      <div className="guidance-pill" role="status" aria-live="polite">
        <span className="guidance-icon" aria-hidden="true">
          {getDirectionArrow()}
        </span>
        <span className="guidance-text">{message}</span>
      </div>

      {/* Profile Tag */}
      {composition?.profile && (
        <div className="profile-tag" aria-label={`Scene profile: ${composition.profile}`}>
          {composition.profile}
        </div>
      )}
    </header>
  );
}
