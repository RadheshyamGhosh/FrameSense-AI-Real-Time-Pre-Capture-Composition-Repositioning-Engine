import type { CapturedPhoto } from "../hooks/useCameraPipeline.js";

export interface PhotoReviewModalProps {
  readonly photo: CapturedPhoto | null;
  readonly onClose: () => void;
}

export function PhotoReviewModal({ photo, onClose }: PhotoReviewModalProps) {
  if (!photo) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = photo.dataUrl;
    link.download = `framesense_capture_${photo.timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="review-modal">
        <header className="review-header">
          <h2 id="review-title">Captured Photo</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close review">
            ✕
          </button>
        </header>

        <div className="review-body">
          <div className="photo-preview-wrapper">
            <img src={photo.dataUrl} alt="Captured photograph" className="captured-image" />
            <div className="photo-score-pill">
              Score: <strong>{photo.score}</strong> / 100
            </div>
          </div>

          <aside className="review-sidebar">
            <section className="metric-breakdown">
              <h3>Composition Metrics</h3>
              <ul className="metrics-list">
                {(photo.composition?.metrics ?? []).map((m) => (
                  <li key={m.type} className="metric-item">
                    <span className="metric-name">{m.type.replace(/_/g, " ")}</span>
                    <span className={`metric-score ${m.score >= 90 ? "high" : m.score >= 70 ? "mid" : "low"}`}>
                      {m.score}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {(photo.composition?.issues ?? []).length > 0 && (
              <section className="review-issues">
                <h3>Notes</h3>
                <ul>
                  {photo.composition.issues.map((issue, idx) => (
                    <li key={idx} className="issue-note">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="review-actions">
              <button type="button" className="action-btn primary" onClick={handleDownload}>
                ⬇ Download Photo
              </button>
              <button type="button" className="action-btn secondary" onClick={onClose}>
                🔄 Retake / Dismiss
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
