import { useCallback, useEffect, useRef, useState } from "react";
import type { AspectRatioPreset } from "@framesense/camera";
import type { FramingTemplate } from "@framesense/core";
import "./App.css";
import { CameraControlsPopover } from "./components/CameraControlsPopover.js";
import { DiagnosticsOverlay } from "./components/DiagnosticsOverlay.js";
import { GuidanceHUD } from "./components/GuidanceHUD.js";
import { CameraIcon, SimIcon } from "./components/Icons.js";
import { PhotoReviewModal } from "./components/PhotoReviewModal.js";
import { SettingsModal, type SceneModeSelection } from "./components/SettingsModal.js";
import { ShutterControls } from "./components/ShutterControls.js";
import { StudioScorecard } from "./components/StudioScorecard.js";
import { Viewfinder } from "./components/Viewfinder.js";
import { useCameraPipeline } from "./hooks/useCameraPipeline.js";

const SCENE_CYCLE_ORDER: SceneModeSelection[] = [
  "AUTO",
  "PORTRAIT",
  "GROUP",
  "LANDSCAPE",
  "ARCHITECTURE",
  "FOOD",
];

const ASPECT_CYCLE_ORDER: AspectRatioPreset[] = ["VIEWPORT", "16:9", "4:3", "1:1", "9:16"];

const TEMPLATE_CYCLE_ORDER: FramingTemplate[] = [
  "NONE",
  "PASSPORT_ID",
  "HEADSHOT_PRO",
  "CREATOR_TALKING_HEAD",
];

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const {
    cameraStatus,
    cameraError,
    activeDeviceId,
    availableDevices,
    useSynthetic,
    syntheticPreset,
    sceneProfile,
    template,
    aspectRatio,
    mirrorSavedPhoto,
    resolutionPreset,
    cameraCapabilities,
    zoomLevel,
    exposureEv,
    composition,
    guidance,
    captureDecision,
    diagnostics,
    isAutoCapture,
    capturedPhoto,
    capturedHistory,
    bestShotId,
    isShutterFlashing,
    setUseSynthetic,
    setSyntheticPreset,
    setSceneProfile,
    setTemplate,
    setAspectRatio,
    setMirrorSavedPhoto,
    setIsAutoCapture,
    changeZoom,
    changeExposure,
    changeResolution,
    clearCapturedPhoto,
    openHistoryPhoto,
    deleteHistoryPhoto,
    startCamera,
    stopCamera,
    switchCamera,
    takePhoto,
    updateFeedbackSettings,
  } = useCameraPipeline(videoRef);

  const handleToggleVoice = useCallback(
    (enabled: boolean) => {
      setVoiceEnabled(enabled);
      updateFeedbackSettings({ voiceEnabled: enabled });
    },
    [updateFeedbackSettings],
  );

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    updateFeedbackSettings({ soundEnabled: enabled });
  };

  const handleToggleHaptics = (enabled: boolean) => {
    setHapticsEnabled(enabled);
    updateFeedbackSettings({ hapticsEnabled: enabled });
  };

  const cycleSceneProfile = () => {
    const idx = SCENE_CYCLE_ORDER.indexOf(sceneProfile);
    const next = SCENE_CYCLE_ORDER[(idx + 1) % SCENE_CYCLE_ORDER.length] ?? "AUTO";
    setSceneProfile(next);
  };

  const cycleAspectRatio = () => {
    const idx = ASPECT_CYCLE_ORDER.indexOf(aspectRatio);
    const next = ASPECT_CYCLE_ORDER[(idx + 1) % ASPECT_CYCLE_ORDER.length] ?? "VIEWPORT";
    setAspectRatio(next);
  };

  const cycleTemplate = useCallback(() => {
    const idx = TEMPLATE_CYCLE_ORDER.indexOf(template);
    const next = TEMPLATE_CYCLE_ORDER[(idx + 1) % TEMPLATE_CYCLE_ORDER.length] ?? "NONE";
    setTemplate(next);
  }, [setTemplate, template]);

  // Laptop keyboard shortcuts during camera session & modal dismissal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (capturedPhoto) {
          clearCapturedPhoto();
          return;
        }
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (showCameraControls) {
          setShowCameraControls(false);
          return;
        }
        if (showDiagnostics) {
          setShowDiagnostics(false);
          return;
        }
        if (showScorecard) {
          setShowScorecard(false);
        }
        return;
      }

      if (cameraStatus !== "STREAMING" || showSettings || capturedPhoto) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        takePhoto();
      } else if (e.key.toLowerCase() === "a") {
        setIsAutoCapture((prev) => !prev);
      } else if (e.key.toLowerCase() === "g") {
        setShowGrid((prev) => !prev);
      } else if (e.key.toLowerCase() === "m") {
        handleToggleVoice(!voiceEnabled);
      } else if (e.key.toLowerCase() === "i") {
        setShowScorecard((prev) => !prev);
      } else if (e.key.toLowerCase() === "t") {
        cycleTemplate();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cameraStatus,
    capturedPhoto,
    clearCapturedPhoto,
    cycleTemplate,
    handleToggleVoice,
    setIsAutoCapture,
    showCameraControls,
    showDiagnostics,
    showScorecard,
    showSettings,
    takePhoto,
    voiceEnabled,
  ]);

  return (
    <main className="camera-app-root">
      {/* Studio Landing Onboarding Screen */}
      {cameraStatus === "IDLE" && (
        <section className="landing-screen" aria-labelledby="app-title">
          <div className="landing-grid">
            <div className="landing-content">
              <div className="landing-badges">
                <span className="brand-tag">FrameSense AI</span>
                <span className="privacy-pill">100% On-Device Web Worker</span>
              </div>

              <h1 id="app-title">Pre-Capture Composition &amp; Framing Studio</h1>
              <p className="hero-description">
                Real-time computer vision guidance before the shutter fires. Align portraits,
                horizon tilt, headroom, exposure, and aspect crops with hands-free auto-shutter.
              </p>

              <div className="cta-group">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setUseSynthetic(false);
                    startCamera(undefined, false);
                  }}
                >
                  <CameraIcon size={18} />
                  <span>Start Live Camera</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setUseSynthetic(true);
                    startCamera(undefined, true);
                  }}
                >
                  <SimIcon size={18} />
                  <span>Try Simulation Mode</span>
                </button>
              </div>
            </div>

            {/* Interactive Visual Viewfinder Preview Card */}
            <aside className="landing-preview-card" aria-label="System overview">
              <div className="preview-reticle-box" aria-hidden="true">
                <span className="preview-grid-v1" />
                <span className="preview-grid-v2" />
                <span className="preview-grid-h1" />
                <span className="preview-grid-h2" />
                <span className="preview-power-dot" />
                <div className="preview-subject-box">
                  <span className="preview-eye-dot" />
                </div>
                <span className="preview-score-chip">96 Optimal</span>
              </div>

              <ol className="workflow-steps">
                <li>
                  <strong>01 Align</strong>
                  <span>Follow directional voice &amp; power-point guides</span>
                </li>
                <li>
                  <strong>02 Stabilize</strong>
                  <span>Hold 750 ms with crisp lighting &amp; focus gate</span>
                </li>
                <li>
                  <strong>03 Capture</strong>
                  <span>Auto-shutter saves matched crop &amp; best-take pick</span>
                </li>
              </ol>
            </aside>
          </div>
        </section>
      )}

      {/* Live Viewfinder Workspace */}
      {cameraStatus !== "IDLE" && (
        <div className="viewfinder-stage">
          {cameraStatus === "INITIALIZING" && (
            <div className="camera-initializing-overlay">
              <div className="camera-spinner" />
              <p>Starting camera stream…</p>
            </div>
          )}

          {cameraStatus === "ERROR" && (
            <div className="camera-error-overlay" role="alert">
              <h2>Camera Unavailable</h2>
              <p className="camera-error-message">
                {cameraError ?? "Unable to access camera. Check browser permissions or device availability."}
              </p>
              <div className="cta-group">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => startCamera(undefined, false)}
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setUseSynthetic(true);
                    startCamera(undefined, true);
                  }}
                >
                  Try Simulation Mode
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={stopCamera}
                >
                  Back to Home
                </button>
              </div>
            </div>
          )}

          {isShutterFlashing && <div className="shutter-flash" />}

          <GuidanceHUD
            guidance={guidance}
            composition={composition}
            sceneProfile={sceneProfile}
            aspectRatio={aspectRatio}
            template={template}
            useSynthetic={useSynthetic}
            onCycleSceneProfile={cycleSceneProfile}
            onCycleAspectRatio={cycleAspectRatio}
            onCycleTemplate={cycleTemplate}
            onExitCamera={stopCamera}
          />

          <Viewfinder
            videoRef={videoRef}
            composition={composition}
            showGrid={showGrid}
            aspectRatio={aspectRatio}
            template={template}
            digitalZoom={cameraCapabilities?.zoom ? 1 : zoomLevel}
          />

          {showScorecard && (
            <StudioScorecard
              composition={composition}
              onClose={() => setShowScorecard(false)}
            />
          )}

          {showCameraControls && (
            <CameraControlsPopover
              capabilities={cameraCapabilities}
              resolution={resolutionPreset}
              zoomLevel={zoomLevel}
              exposureEv={exposureEv}
              useSynthetic={useSynthetic}
              onChangeZoom={changeZoom}
              onChangeExposure={changeExposure}
              onChangeResolution={changeResolution}
              onClose={() => setShowCameraControls(false)}
            />
          )}

          <ShutterControls
            captureDecision={captureDecision}
            isAutoCapture={isAutoCapture}
            showGrid={showGrid}
            voiceEnabled={voiceEnabled}
            showScorecard={showScorecard}
            showCameraControls={showCameraControls}
            showDiagnostics={showDiagnostics}
            useSynthetic={useSynthetic}
            syntheticPreset={syntheticPreset}
            capturedCount={capturedHistory.length}
            latestThumbUrl={capturedHistory[0]?.dataUrl ?? null}
            onToggleAutoCapture={() => setIsAutoCapture(!isAutoCapture)}
            onToggleGrid={() => setShowGrid(!showGrid)}
            onToggleVoice={() => handleToggleVoice(!voiceEnabled)}
            onToggleScorecard={() => setShowScorecard(!showScorecard)}
            onToggleCameraControls={() => setShowCameraControls(!showCameraControls)}
            onTakePhoto={takePhoto}
            onToggleSettings={() => setShowSettings(true)}
            onToggleDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
            onOpenGallery={() => {
              if (capturedHistory[0]) {
                openHistoryPhoto(capturedHistory[0]);
              }
            }}
            onSelectPreset={setSyntheticPreset}
            disabled={cameraStatus !== "STREAMING"}
          />
        </div>
      )}

      {showDiagnostics && (
        <DiagnosticsOverlay
          sample={diagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}

      <PhotoReviewModal
        photo={capturedPhoto}
        history={capturedHistory}
        bestShotId={bestShotId}
        onSelectPhoto={openHistoryPhoto}
        onDeletePhoto={deleteHistoryPhoto}
        onClose={clearCapturedPhoto}
      />

      {showSettings && (
        <SettingsModal
          availableDevices={availableDevices}
          activeDeviceId={activeDeviceId}
          useSynthetic={useSynthetic}
          syntheticPreset={syntheticPreset}
          sceneProfile={sceneProfile}
          aspectRatio={aspectRatio}
          template={template}
          mirrorSavedPhoto={mirrorSavedPhoto}
          showGrid={showGrid}
          voiceEnabled={voiceEnabled}
          soundEnabled={soundEnabled}
          hapticsEnabled={hapticsEnabled}
          onClose={() => setShowSettings(false)}
          onSelectDevice={switchCamera}
          onToggleSynthetic={(syn) => {
            setUseSynthetic(syn);
            setShowSettings(false);
            startCamera(undefined, syn);
          }}
          onSelectPreset={setSyntheticPreset}
          onSelectSceneProfile={setSceneProfile}
          onSelectAspectRatio={setAspectRatio}
          onSelectTemplate={setTemplate}
          onToggleMirrorSavedPhoto={setMirrorSavedPhoto}
          onToggleGrid={setShowGrid}
          onToggleVoice={handleToggleVoice}
          onToggleSound={handleToggleSound}
          onToggleHaptics={handleToggleHaptics}
        />
      )}
    </main>
  );
}
