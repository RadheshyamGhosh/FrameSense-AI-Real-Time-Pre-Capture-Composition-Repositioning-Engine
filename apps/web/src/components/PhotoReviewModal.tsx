import type { CapturedPhoto } from "../hooks/useCameraPipeline.js";
import { CloseIcon, DownloadIcon, RefreshIcon, TrashIcon } from "./Icons.js";

export interface PhotoReviewModalProps {
  readonly photo: CapturedPhoto | null;
  readonly history?: readonly CapturedPhoto[];
  readonly bestShotId?: string | null;
  readonly onSelectPhoto?: (photo: CapturedPhoto) => void;
  readonly onDeletePhoto?: (id: string) => void;
  readonly onClose: () => void;
}

export function PhotoReviewModal({
  photo,
  history = [],
  bestShotId,
  onSelectPhoto,
  onDeletePhoto,
  onClose,
}: PhotoReviewModalProps) {
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
          <div className="review-title-group">
            <h2 id="review-title">Captured Photo</h2>
            <span className="review-meta-chip">{photo.profile}</span>
            <span className="review-meta-chip">
              {photo.aspectRatio === "VIEWPORT" ? "Full" : photo.aspectRatio}
            </span>
            {bestShotId === photo.id && <span className="best-shot-tag">Best Take</span>}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close review" title="Close (Esc)">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="review-body">
          <div className="photo-preview-wrapper">
            <img src={photo.dataUrl} alt="Captured photograph" className="captured-image" />
            <div className="photo-score-pill">
              {photo.score !== null ? (
                <>
                  Score: <strong>{photo.score}</strong> / 100
                </>
              ) : (
                <>Score: Pending analysis</>
              )}
            </div>
          </div>

          <aside className="review-sidebar">
            <section className="metric-breakdown">
              <h3>Composition Metrics</h3>
              {photo.composition ? (
                <ul className="metrics-list">
                  {photo.composition.metrics.map((m) => {
                    const tier = m.score >= 90 ? "high" : m.score >= 70 ? "mid" : "low";
                    return (
                      <li key={m.type} className="metric-item-bar">
                        <div className="metric-item-head">
                          <span className="metric-name">{m.type.replace(/_/g, " ")}</span>
                          <span className={`metric-score ${tier}`}>{m.score}%</span>
                        </div>
                        <div className="metric-bar-track" aria-hidden="true">
                          <div className={`metric-bar-fill ${tier}`} style={{ width: `${m.score}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="issue-note">Frame captured before composition analysis completed.</p>
              )}
            </section>

            {photo.composition && photo.composition.issues.length > 0 && (
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
                <DownloadIcon size={16} />
                <span>Download JPEG ({photo.aspectRatio === "VIEWPORT" ? "Full" : photo.aspectRatio})</span>
              </button>
              <button type="button" className="action-btn secondary" onClick={onClose}>
                <RefreshIcon size={15} />
                <span>Retake / Resume (Esc)</span>
              </button>
            </div>
          </aside>
        </div>

        {history.length > 1 && onSelectPhoto && (
          <div className="gallery-strip" aria-label="Session capture history">
            {history.map((item) => (
              <div
                key={item.id}
                className={`gallery-thumb-card ${item.id === photo.id ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="gallery-thumb-btn"
                  onClick={() => onSelectPhoto(item)}
                  aria-label={`Select photo scored ${item.score ?? "pending"}`}
                >
                  <img src={item.dataUrl} alt="" className="gallery-thumb-img" />
                  <span className="gallery-thumb-score">
                    {bestShotId === item.id ? "★ " : ""}
                    {item.score ?? "—"}
                  </span>
                </button>
                {onDeletePhoto && (
                  <button
                    type="button"
                    className="gallery-thumb-del"
                    onClick={() => onDeletePhoto(item.id)}
                    aria-label="Delete photo"
                    title="Delete take"
                  >
                    <TrashIcon size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
