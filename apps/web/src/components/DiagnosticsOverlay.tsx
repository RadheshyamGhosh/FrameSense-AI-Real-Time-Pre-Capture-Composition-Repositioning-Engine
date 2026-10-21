import type { DiagnosticSample } from "@framesense/core";

export interface DiagnosticsOverlayProps {
  readonly sample: DiagnosticSample | null;
  readonly onClose: () => void;
}

export function DiagnosticsOverlay({ sample, onClose }: DiagnosticsOverlayProps) {
  if (!sample) return null;

  return (
    <aside className="diagnostics-panel" aria-label="Performance Telemetry">
      <header className="diag-header">
        <h4>Telemetry Diagnostics</h4>
        <button type="button" className="close-mini-btn" onClick={onClose} aria-label="Close telemetry">
          ✕
        </button>
      </header>

      <div className="diag-grid">
        <div className="diag-stat">
          <span className="diag-label">Camera FPS</span>
          <span className="diag-value">{sample.cameraFps} <small>/ 30</small></span>
        </div>

        <div className="diag-stat">
          <span className="diag-label">Pipeline FPS</span>
          <span className="diag-value">{sample.processingFps} <small>/ 15</small></span>
        </div>

        <div className="diag-stat">
          <span className="diag-label">Inference Latency</span>
          <span className={`diag-value ${sample.inferenceLatencyMs > 75 ? "warn" : "good"}`}>
            {sample.inferenceLatencyMs} <small>ms</small>
          </span>
        </div>

        <div className="diag-stat">
          <span className="diag-label">End-to-End Latency</span>
          <span className={`diag-value ${sample.endToEndLatencyMs > 150 ? "warn" : "good"}`}>
            {sample.endToEndLatencyMs} <small>ms</small>
          </span>
        </div>
      </div>

      <footer className="diag-footer">
        <span>Backend: <strong>{sample.runtime.backend}</strong></span>
        {sample.memory && <span>Heap: <strong>{sample.memory.usedMb} MB</strong></span>}
      </footer>
    </aside>
  );
}
