import type { CameraCapabilities, ResolutionPreset } from "@framesense/camera";
import { CloseIcon } from "./Icons.js";

export interface CameraControlsPopoverProps {
  readonly capabilities: CameraCapabilities | null;
  readonly resolution: ResolutionPreset;
  readonly zoomLevel: number;
  readonly exposureEv: number;
  readonly useSynthetic: boolean;
  readonly onChangeZoom: (zoom: number) => void;
  readonly onChangeExposure: (ev: number) => void;
  readonly onChangeResolution: (res: ResolutionPreset) => void;
  readonly onClose: () => void;
}

const ALL_RESOLUTIONS: ResolutionPreset[] = ["720p", "1080p", "4K"];

export function CameraControlsPopover({
  capabilities,
  resolution,
  zoomLevel,
  exposureEv,
  useSynthetic,
  onChangeZoom,
  onChangeExposure,
  onChangeResolution,
  onClose,
}: CameraControlsPopoverProps) {
  const hwZoom = capabilities?.zoom ?? null;
  const hwEv = capabilities?.exposureCompensation ?? null;
  const supported = capabilities?.supportedResolutions ?? ["720p", "1080p"];

  const zoomMin = hwZoom ? hwZoom.min : 1.0;
  const zoomMax = hwZoom ? hwZoom.max : 2.5;
  const zoomStep = hwZoom ? hwZoom.step : 0.1;

  return (
    <aside className="camera-controls-popover" aria-label="Hardware Camera & Lens Controls">
      <header className="diag-header">
        <h4>Camera &amp; Lens Controls</h4>
        <button type="button" className="close-mini-btn" onClick={onClose} aria-label="Close lens controls">
          <CloseIcon size={14} />
        </button>
      </header>

      <div className="lens-control-group">
        <div className="lens-control-head">
          <label htmlFor="zoom-slider">
            Zoom <span className="lens-mode-tag">{hwZoom ? "Optical" : "Digital"}</span>
          </label>
          <strong className="tabular-val">{zoomLevel.toFixed(1)}x</strong>
        </div>
        <input
          id="zoom-slider"
          type="range"
          min={zoomMin}
          max={zoomMax}
          step={zoomStep}
          value={zoomLevel}
          onChange={(e) => onChangeZoom(Number(e.target.value))}
          className="studio-slider"
        />
      </div>

      <div className="lens-control-group">
        <div className="lens-control-head">
          <label htmlFor="ev-slider">
            Exposure (EV){" "}
            <span className="lens-mode-tag">{hwEv ? "HW" : "Auto"}</span>
          </label>
          <strong className="tabular-val">
            {hwEv ? `${exposureEv >= 0 ? "+" : ""}${exposureEv.toFixed(1)}` : "Auto"}
          </strong>
        </div>
        <input
          id="ev-slider"
          type="range"
          min={hwEv ? hwEv.min : -2}
          max={hwEv ? hwEv.max : 2}
          step={hwEv ? hwEv.step : 0.5}
          value={exposureEv}
          disabled={!hwEv || useSynthetic}
          onChange={(e) => onChangeExposure(Number(e.target.value))}
          className="studio-slider"
        />
      </div>

      <div className="lens-control-group">
        <div className="lens-control-head">
          <span>Sensor Resolution</span>
          {capabilities?.activeWidth && capabilities?.activeHeight && (
            <span className="lens-mode-tag">
              {capabilities.activeWidth}×{capabilities.activeHeight}
            </span>
          )}
        </div>
        <div className="res-chip-row" role="group" aria-label="Resolution presets">
          {ALL_RESOLUTIONS.map((res) => {
            const isAvailable = supported.includes(res);
            return (
              <button
                key={res}
                type="button"
                className={`res-chip ${resolution === res ? "active" : ""}`}
                disabled={useSynthetic || !isAvailable}
                onClick={() => onChangeResolution(res)}
                title={isAvailable ? `Switch to ${res}` : `${res} not supported by camera`}
              >
                {res}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
