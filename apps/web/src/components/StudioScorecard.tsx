import type { CompositionResult } from "@framesense/core";
import { CloseIcon } from "./Icons.js";

export interface StudioScorecardProps {
  readonly composition: CompositionResult | null;
  readonly onClose: () => void;
}

const METRIC_LABELS: Record<string, string> = {
  RULE_OF_THIRDS: "Rule of Thirds",
  HEADROOM: "Headroom",
  SUBJECT_SIZE: "Subject Scale",
  HORIZON_ALIGNMENT: "Horizon Level",
  SUBJECT_POSITION: "Subject Position",
  SYMMETRY: "Visual Symmetry",
  NEGATIVE_SPACE: "Negative Space",
};

export function StudioScorecard({ composition, onClose }: StudioScorecardProps) {
  const metrics = composition?.metrics ?? [];
  const quality = composition?.frameQuality;

  return (
    <aside className="studio-scorecard" aria-label="Live Composition Scorecard">
      <header className="scorecard-header">
        <div>
          <h3>Live Scorecard</h3>
          <span className="scorecard-sub">
            {composition ? `${composition.profile} · ${composition.overallScore}/100` : "Waiting for stream"}
          </span>
        </div>
        <button
          type="button"
          className="close-mini-btn"
          onClick={onClose}
          aria-label="Close live scorecard"
          title="Close (I)"
        >
          <CloseIcon size={15} />
        </button>
      </header>

      <div className="scorecard-metrics">
        {metrics.length === 0 ? (
          <p className="scorecard-empty">Point camera to inspect real-time metrics.</p>
        ) : (
          metrics.map((m) => {
            const tier = m.score >= 90 ? "high" : m.score >= 70 ? "mid" : "low";
            return (
              <div key={m.type} className="scorecard-row">
                <div className="scorecard-row-head">
                  <span className="scorecard-metric-name">{METRIC_LABELS[m.type] ?? m.type}</span>
                  <span className={`scorecard-metric-val ${tier}`}>{m.score}%</span>
                </div>
                <div className="metric-bar-track" aria-hidden="true">
                  <div className={`metric-bar-fill ${tier}`} style={{ width: `${m.score}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {quality && (
        <footer className="scorecard-footer">
          <div className="scorecard-quality-row">
            <span>Exposure</span>
            <strong>{Math.round(quality.brightness * 100)}%</strong>
          </div>
          <div className="scorecard-quality-row">
            <span>Focus / Edge</span>
            <strong>{quality.sharpness}</strong>
          </div>
          <div className="scorecard-quality-row">
            <span>Frame Quality</span>
            <strong className={quality.status === "OPTIMAL" ? "good-text" : "warn-text"}>
              {quality.status}
            </strong>
          </div>
        </footer>
      )}
    </aside>
  );
}
