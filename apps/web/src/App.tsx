import { useRef, useState } from "react";
import "./App.css";
import { DiagnosticsOverlay } from "./components/DiagnosticsOverlay.js";
import { GuidanceHUD } from "./components/GuidanceHUD.js";
import { PhotoReviewModal } from "./components/PhotoReviewModal.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { ShutterControls } from "./components/ShutterControls.js";
import { Viewfinder } from "./components/Viewfinder.js";
import { useCameraPipeline } from "./hooks/useCameraPipeline.js";

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const {
    cameraStatus,
    activeDeviceId,
    availableDevices,
    useSynthetic,
    syntheticPreset,
    composition,
    guidance,
    captureDecision,
    diagnostics,
    isAutoCapture,
    capturedPhoto,
    isShutterFlashing,
    setUseSynthetic,
    setSyntheticPreset,
    setIsAutoCapture,
    clearCapturedPhoto,
    startCamera,
    stopCamera,
    switchCamera,
    takePhoto,
    updateFeedbackSettings,
  } = useCameraPipeline(videoRef);

  const handleToggleVoice = (enabled: boolean) => {
    setVoiceEnabled(enabled);
    updateFeedbackSettings({ voiceEnabled: enabled });
  };

  const handleToggleHaptics = (enabled: boolean) => {
    setHapticsEnabled(enabled);
    updateFeedbackSettings({ hapticsEnabled: enabled });
  };

  return (
    <main className="camera-app-root">
      {/* Landing Screen when Camera is Idle */}
      {cameraStatus === "IDLE" && (
        <section className="landing-screen" aria-labelledby="app-title">
          <div className="landing-content">
            <span className="brand-tag">FrameSense AI</span>
            <h1 id="app-title">Pre-Capture Photo Composition Engine</h1>
            <p className="hero-description">
              Real-time computer vision guidance running 100% on-device. Adjust framing, headroom,
              and horizon alignment with intelligent auto-shutter capture.
            </p>

            <div className="cta-group">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setUseSynthetic(false);
                  startCamera();
                }}
              >
                📷 Start Live Camera
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setUseSynthetic(true);
                  startCamera();
                }}
              >
                🧪 Try Simulation Mode
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Live Viewfinder Screen */}
      {cameraStatus !== "IDLE" && (
        <div className="viewfinder-stage">
          {/* Shutter Flash Animation */}
          {isShutterFlashing && <div className="shutter-flash" />}

          {/* Top HUD: Score & Real-time Guidance */}
          <GuidanceHUD guidance={guidance} composition={composition} />

          {/* Central Camera Video Feed & AR Overlay Canvas */}
          <Viewfinder
            videoRef={videoRef}
            composition={composition}
            showGrid={showGrid}
          />

          {/* Bottom Bar: Circular Stability Ring, Shutter Button, and Controls */}
          <ShutterControls
            captureDecision={captureDecision}
            isAutoCapture={isAutoCapture}
            onToggleAutoCapture={() => setIsAutoCapture(!isAutoCapture)}
            onTakePhoto={takePhoto}
            onToggleSettings={() => setShowSettings(true)}
            onToggleDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
            disabled={cameraStatus !== "STREAMING"}
          />

          {/* Stop / Exit Camera Button */}
          <button
            type="button"
            className="exit-camera-btn"
            onClick={stopCamera}
            title="Stop Camera"
            aria-label="Exit camera"
          >
            ✕ Exit
          </button>
        </div>
      )}

      {/* Real-time Telemetry Diagnostics Drawer */}
      {showDiagnostics && (
        <DiagnosticsOverlay
          sample={diagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}

      {/* Captured Photo Review Modal */}
      <PhotoReviewModal
        photo={capturedPhoto}
        onClose={clearCapturedPhoto}
      />

      {/* Settings & Device Picker Modal */}
      {showSettings && (
        <SettingsModal
          availableDevices={availableDevices}
          activeDeviceId={activeDeviceId}
          useSynthetic={useSynthetic}
          syntheticPreset={syntheticPreset}
          showGrid={showGrid}
          voiceEnabled={voiceEnabled}
          hapticsEnabled={hapticsEnabled}
          onClose={() => setShowSettings(false)}
          onSelectDevice={switchCamera}
          onToggleSynthetic={(syn) => {
            setUseSynthetic(syn);
            stopCamera();
          }}
          onSelectPreset={setSyntheticPreset}
          onToggleGrid={setShowGrid}
          onToggleVoice={handleToggleVoice}
          onToggleHaptics={handleToggleHaptics}
        />
      )}
    </main>
  );
}
