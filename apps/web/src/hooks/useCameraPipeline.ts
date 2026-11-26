import { useEffect, useRef, useState, useCallback } from "react";
import {
  CameraManager,
  FrameSampler,
  PipelineWorkerBridge,
  SyntheticCameraSource,
  computeAspectCropRect,
  type AspectRatioPreset,
  type CameraCapabilities,
  type CameraDeviceInfo,
  type CameraStatus,
  type ResolutionPreset,
} from "@framesense/camera";
import type {
  CaptureDecision,
  CompositionResult,
  DiagnosticSample,
  FramingTemplate,
  GuidanceResult,
  SceneType,
} from "@framesense/core";
import {
  DiagnosticsCollector,
  FeedbackDispatcher,
  type FeedbackSettings,
} from "@framesense/feedback";
import {
  MockPerceptionAdapter,
  PipelineProcessor,
  RealPerceptionAdapter,
  type MockPerceptionPreset,
} from "@framesense/perception";
import type { FrameSenseConfig } from "@framesense/config";

export interface CapturedPhoto {
  readonly id: string;
  readonly dataUrl: string;
  readonly timestamp: number;
  readonly score: number | null;
  readonly composition: CompositionResult | null;
  readonly profile: string;
  readonly aspectRatio: AspectRatioPreset;
}

const DEFAULT_CONFIG: FrameSenseConfig = {
  composition: {
    minimumAcceptableScore: 70,
    excellentScore: 90,
    ruleOfThirdsTolerance: 0.08,
    minimumHeadroomRatio: 0.08,
    minimumSubjectSizeRatio: 0.18,
    maximumSubjectSizeRatio: 0.72,
    maximumHorizonAngleDegrees: 3,
    minimumConfidence: 0.6,
  },
  guidance: {
    minimumGuidanceConfidence: 0.65,
    guidanceCooldownMs: 1200,
    recommendationPersistenceMs: 500,
    stabilityDurationMs: 750,
    maximumRepeatedAnnouncements: 2,
  },
  inference: {
    targetInferenceFps: 10,
    minimumInferenceIntervalMs: 100,
    modelConfidenceThreshold: 0.55,
    maximumProcessingWidth: 640,
    maximumProcessingHeight: 360,
    inferenceEnabled: true,
  },
  performance: {
    targetCameraFps: 30,
    targetProcessingFps: 15,
    targetInferenceLatencyMs: 75,
    targetEndToEndLatencyMs: 150,
    diagnosticsSamplingIntervalMs: 1000,
  },
};

export function useCameraPipeline(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("IDLE");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<CameraDeviceInfo[]>([]);
  const [useSynthetic, setUseSynthetic] = useState(false);
  const [syntheticPreset, setSyntheticPreset] = useState<MockPerceptionPreset>("PERFECT_PORTRAIT");
  const [sceneProfile, setSceneProfile] = useState<SceneType | "AUTO">("AUTO");
  const sceneProfileRef = useRef<SceneType | "AUTO">("AUTO");
  const [template, setTemplateState] = useState<FramingTemplate>("NONE");
  const templateRef = useRef<FramingTemplate>("NONE");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>("VIEWPORT");
  const [mirrorSavedPhoto, setMirrorSavedPhoto] = useState(true);
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>("720p");
  const [cameraCapabilities, setCameraCapabilities] = useState<CameraCapabilities | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [exposureEv, setExposureEv] = useState(0);

  useEffect(() => {
    sceneProfileRef.current = sceneProfile;
  }, [sceneProfile]);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const setTemplate = useCallback((nextTemplate: FramingTemplate) => {
    setTemplateState(nextTemplate);
    if (nextTemplate === "PASSPORT_ID") {
      setAspectRatio("1:1");
    } else if (nextTemplate === "CREATOR_TALKING_HEAD") {
      setAspectRatio("16:9");
    }
  }, []);

  const [composition, setComposition] = useState<CompositionResult | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResult | null>(null);
  const [captureDecision, setCaptureDecision] = useState<CaptureDecision | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticSample | null>(null);
  const [isAutoCapture, setIsAutoCapture] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [capturedHistory, setCapturedHistory] = useState<CapturedPhoto[]>([]);
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  const cameraManagerRef = useRef<CameraManager | null>(null);
  const samplerRef = useRef<FrameSampler | null>(null);
  const workerBridgeRef = useRef<PipelineWorkerBridge | null>(null);
  const fallbackProcessorRef = useRef<PipelineProcessor | null>(null);
  const fallbackAdapterRef = useRef<MockPerceptionAdapter | null>(null);
  const syntheticProcessorRef = useRef<PipelineProcessor | null>(null);
  const dispatcherRef = useRef<FeedbackDispatcher | null>(null);
  const diagnosticsRef = useRef<DiagnosticsCollector | null>(null);
  const syntheticSourceRef = useRef<SyntheticCameraSource | null>(null);

  // Initialize pipeline services once
  useEffect(() => {
    const manager = new CameraManager();
    cameraManagerRef.current = manager;

    const sampler = new FrameSampler({
      targetFps: DEFAULT_CONFIG.performance.targetProcessingFps,
      maxWidth: DEFAULT_CONFIG.inference.maximumProcessingWidth,
      maxHeight: DEFAULT_CONFIG.inference.maximumProcessingHeight,
      mirrorHorizontal: true,
    });
    samplerRef.current = sampler;

    const dispatcher = new FeedbackDispatcher({
      maxRepeatedAnnouncements: DEFAULT_CONFIG.guidance.maximumRepeatedAnnouncements,
      voiceMinIntervalMs: 2200,
    });
    dispatcherRef.current = dispatcher;

    const diag = new DiagnosticsCollector();
    diagnosticsRef.current = diag;

    // Live camera in-thread fallback initialized with RealPerceptionAdapter
    const realAdapter = new RealPerceptionAdapter();
    realAdapter.initialize().catch(() => {});
    const processor = new PipelineProcessor({
      adapter: realAdapter,
      config: DEFAULT_CONFIG,
    });
    fallbackProcessorRef.current = processor;

    // Dedicated simulation processor backed by MockPerceptionAdapter
    const mockAdapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");
    fallbackAdapterRef.current = mockAdapter;
    syntheticProcessorRef.current = new PipelineProcessor({
      adapter: mockAdapter,
      config: DEFAULT_CONFIG,
    });

    // Try Web Worker bridge if available in browser
    try {
      if (typeof Worker !== "undefined") {
        const worker = new Worker(new URL("../pipeline.worker.ts", import.meta.url), {
          type: "module",
        });
        const bridge = new PipelineWorkerBridge(worker);
        bridge.initialize(DEFAULT_CONFIG);

        bridge.onResult((res) => {
          const now = performance.now();
          diag.recordProcessingCycle(
            res.timestamp,
            res.processingTimeMs,
            0,
            Math.max(0, Math.round(now - res.timestamp)),
          );

          setComposition(res.composition);
          setGuidance(res.guidance);
          setCaptureDecision(res.capture);

          dispatcher.dispatch(res.guidance, res.capture);
        });

        bridge.onError((err) => {
          console.warn("Pipeline worker issue, continuing on-device:", err);
        });

        workerBridgeRef.current = bridge;
      }
    } catch (e) {
      console.warn("Worker not available, using in-thread pipeline:", e);
    }

    // Refresh available devices
    manager
      .listDevices()
      .then((devs) => setAvailableDevices(devs))
      .catch(() => {});

    // Periodic telemetry sampling interval
    const diagTimer = setInterval(() => {
      if (diagnosticsRef.current) {
        setDiagnostics(diagnosticsRef.current.sample());
      }
    }, DEFAULT_CONFIG.performance.diagnosticsSamplingIntervalMs);

    return () => {
      clearInterval(diagTimer);
      manager.stop();
      sampler.stopSampling();
      workerBridgeRef.current?.terminate();
      syntheticSourceRef.current?.stop();
    };
  }, []);

  // Update mock preset when changed and restart stability window cleanly
  useEffect(() => {
    if (fallbackAdapterRef.current) {
      fallbackAdapterRef.current.setPreset(syntheticPreset);
    }
    syntheticProcessorRef.current?.reset();
    setCaptureDecision(null);
  }, [syntheticPreset]);

  const resetPipelineStates = useCallback(() => {
    workerBridgeRef.current?.reset();
    fallbackProcessorRef.current?.reset();
    syntheticProcessorRef.current?.reset();
    setCaptureDecision(null);
  }, []);

  // Capture frame action
  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const isVideoReady = Boolean(video && video.videoWidth > 0 && video.videoHeight > 0);
    if (!isVideoReady && !useSynthetic) return;

    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 200);
    dispatcherRef.current?.triggerShutterFeedback();

    const rawW = isVideoReady && video ? video.videoWidth : 1280;
    const rawH = isVideoReady && video ? video.videoHeight : 720;
    const rect = video ? video.getBoundingClientRect() : null;
    const effectiveDigitalZoom = cameraCapabilities?.zoom ? 1 : zoomLevel;
    const crop = computeAspectCropRect(
      rawW,
      rawH,
      aspectRatio,
      rect?.width,
      rect?.height,
      effectiveDigitalZoom,
    );

    const canvas = document.createElement("canvas");
    canvas.width = crop.sw;
    canvas.height = crop.sh;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (isVideoReady && video) {
        if (mirrorSavedPhoto) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
      } else {
        // Render deterministic placeholder canvas for Simulation Mode captures
        ctx.fillStyle = "#10161e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#2ed573";
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Simulation Capture: ${syntheticPreset}`, canvas.width / 2, canvas.height / 2);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

      // Reset stability state immediately so dismissing review requires a fresh dwell window
      resetPipelineStates();

      const now = Date.now();
      const newPhoto: CapturedPhoto = {
        id: `cap_${now}_${Math.random().toString(36).slice(2, 6)}`,
        dataUrl,
        timestamp: now,
        score: composition ? composition.overallScore : null,
        composition: composition ?? null,
        profile: composition?.profile ?? "UNKNOWN",
        aspectRatio,
      };

      setCapturedPhoto(newPhoto);
      setCapturedHistory((prev) => [newPhoto, ...prev].slice(0, 8));
    }
  }, [aspectRatio, cameraCapabilities?.zoom, composition, mirrorSavedPhoto, resetPipelineStates, syntheticPreset, useSynthetic, videoRef, zoomLevel]);

  // Auto-capture monitor: triggers takePhoto when ready
  useEffect(() => {
    if (isAutoCapture && captureDecision?.ready && !capturedPhoto) {
      takePhoto();
    }
  }, [isAutoCapture, captureDecision?.ready, capturedPhoto, takePhoto]);

  // Camera start method – takes an explicit synthetic flag to avoid stale closure
  const startCamera = async (deviceId?: string, forceUseSynthetic?: boolean) => {
    const synthetic = forceUseSynthetic ?? useSynthetic;
    setCameraError(null);
    resetPipelineStates();
    diagnosticsRef.current?.reset();

    if (synthetic) {
      // Start synthetic stream backed by MockPerceptionAdapter presets
      samplerRef.current?.stopSampling();
      cameraManagerRef.current?.stop();
      syntheticSourceRef.current?.stop();
      if (fallbackAdapterRef.current) {
        fallbackAdapterRef.current.setPreset(syntheticPreset);
      }
      setCameraStatus("STREAMING");
      const synth = new SyntheticCameraSource({ fps: DEFAULT_CONFIG.performance.targetProcessingFps });
      syntheticSourceRef.current = synth;
      synth.start(async (frame) => {
        diagnosticsRef.current?.recordCameraFrame();
        if (syntheticProcessorRef.current) {
          const override =
            sceneProfileRef.current === "AUTO" ? undefined : sceneProfileRef.current;
          const res = await syntheticProcessorRef.current.processFrame(frame, {
            profileOverride: override,
            template: templateRef.current,
          });
          diagnosticsRef.current?.recordProcessingCycle(
            res.timestamp,
            res.processingTimeMs,
            0,
            Math.max(0, Math.round(performance.now() - res.timestamp)),
          );
          setComposition(res.composition);
          setGuidance(res.guidance);
          setCaptureDecision(res.capture);
          dispatcherRef.current?.dispatch(res.guidance, res.capture);
        }
      });
      return;
    }

    if (!cameraManagerRef.current) return;
    setCameraStatus("INITIALIZING");
    try {
      const stream = await cameraManagerRef.current.start({
        deviceId,
        width: 1280,
        height: 720,
        targetFps: DEFAULT_CONFIG.performance.targetCameraFps,
      });

      const video = videoRef.current;
      if (video) {
        // Attach stream and wait for the video to be ready before playing
        video.srcObject = stream;
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener("loadedmetadata", onReady);
            resolve();
          };
          // If metadata already loaded (e.g. hot-reload), resolve immediately
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.addEventListener("loadedmetadata", onReady);
          }
        });
        try {
          await video.play();
        } catch {
          // Autoplay blocked – video will play once user interacts
        }
      }

      setCameraStatus("STREAMING");
      setActiveDeviceId(cameraManagerRef.current.getActiveDeviceId());
      const probedCaps = cameraManagerRef.current.getCapabilities();
      setCameraCapabilities(probedCaps);
      setZoomLevel(probedCaps.zoom ? probedCaps.zoom.current : 1);
      setExposureEv(probedCaps.exposureCompensation ? probedCaps.exposureCompensation.current : 0);

      // Re-enumerate camera labels now that permission has been granted
      cameraManagerRef.current
        .listDevices()
        .then((devs) => setAvailableDevices(devs))
        .catch(() => {});

      // Start frame sampler only after video is playing
      const currentVideo = videoRef.current;
      if (samplerRef.current && currentVideo) {
        samplerRef.current.startSampling(currentVideo, async (extracted) => {
          diagnosticsRef.current?.recordCameraFrame();

          const override =
            sceneProfileRef.current === "AUTO" ? undefined : sceneProfileRef.current;
          const activeTpl = templateRef.current;
          const enrichedFrame =
            override || activeTpl !== "NONE"
              ? {
                  ...extracted,
                  cameraFrame: {
                    ...extracted.cameraFrame,
                    payload: {
                      ...extracted.cameraFrame.payload,
                      metadata: {
                        ...extracted.cameraFrame.payload.metadata,
                        ...(override ? { profileOverride: override } : {}),
                        ...(activeTpl !== "NONE" ? { template: activeTpl } : {}),
                      },
                    },
                  },
                }
              : extracted;

          // Dispatch to Web Worker with automatic fallback to local pipeline
          let handled = false;
          if (workerBridgeRef.current) {
            handled = workerBridgeRef.current.dispatchFrame(enrichedFrame);
          }

          if (!handled && fallbackProcessorRef.current) {
            const res = await fallbackProcessorRef.current.processFrame(
              enrichedFrame.cameraFrame,
              { profileOverride: override, template: activeTpl },
            );
            diagnosticsRef.current?.recordProcessingCycle(
              res.timestamp,
              res.processingTimeMs,
              0,
              Math.max(0, Math.round(performance.now() - res.timestamp)),
            );
            setComposition(res.composition);
            setGuidance(res.guidance);
            setCaptureDecision(res.capture);
            dispatcherRef.current?.dispatch(res.guidance, res.capture);
          }
        });
      }
    } catch (err) {
      setCameraStatus("ERROR");
      const message =
        err instanceof Error ? err.message : "Unable to access camera device.";
      setCameraError(message);
      console.error("Camera start error:", err);
    }
  };

  const stopCamera = () => {
    samplerRef.current?.stopSampling();
    syntheticSourceRef.current?.stop();
    syntheticSourceRef.current = null;
    cameraManagerRef.current?.stop();
    resetPipelineStates();
    dispatcherRef.current?.reset();
    diagnosticsRef.current?.reset();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setComposition(null);
    setGuidance(null);
    setCameraCapabilities(null);
    setZoomLevel(1);
    setExposureEv(0);
    setCameraError(null);
    setCameraStatus("IDLE");
  };

  const switchCamera = async (deviceId: string) => {
    stopCamera();
    await startCamera(deviceId, false);
  };

  const clearCapturedPhoto = useCallback(() => {
    resetPipelineStates();
    setCapturedPhoto(null);
  }, [resetPipelineStates]);

  const openHistoryPhoto = useCallback((photo: CapturedPhoto) => {
    setCapturedPhoto(photo);
  }, []);

  const deleteHistoryPhoto = useCallback((id: string) => {
    setCapturedHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setCapturedPhoto((current) => (current?.id === id ? next[0] ?? null : current));
      return next;
    });
  }, []);

  let bestShotId: string | null = null;
  let bestShotScore = -1;
  for (const item of capturedHistory) {
    if (item.score !== null && item.score > bestShotScore) {
      bestShotScore = item.score;
      bestShotId = item.id;
    }
  }

  const updateFeedbackSettings = (settings: Partial<FeedbackSettings>) => {
    dispatcherRef.current?.updateSettings(settings);
  };

  const changeZoom = useCallback(async (nextZoom: number) => {
    setZoomLevel(nextZoom);
    await cameraManagerRef.current?.applyZoom(nextZoom);
  }, []);

  const changeExposure = useCallback(async (nextEv: number) => {
    setExposureEv(nextEv);
    await cameraManagerRef.current?.applyExposureCompensation(nextEv);
  }, []);

  const changeResolution = useCallback(
    async (nextPreset: ResolutionPreset) => {
      if (!cameraManagerRef.current || useSynthetic) return;
      try {
        samplerRef.current?.stopSampling();
        const stream = await cameraManagerRef.current.setResolution(nextPreset);
        setResolutionPreset(nextPreset);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setCameraCapabilities(cameraManagerRef.current.getCapabilities());
        if (samplerRef.current && video) {
          samplerRef.current.startSampling(video, async (extracted) => {
            diagnosticsRef.current?.recordCameraFrame();
            const override =
              sceneProfileRef.current === "AUTO" ? undefined : sceneProfileRef.current;
            const activeTpl = templateRef.current;
            const enrichedFrame =
              override || activeTpl !== "NONE"
                ? {
                    ...extracted,
                    cameraFrame: {
                      ...extracted.cameraFrame,
                      payload: {
                        ...extracted.cameraFrame.payload,
                        metadata: {
                          ...extracted.cameraFrame.payload.metadata,
                          ...(override ? { profileOverride: override } : {}),
                          ...(activeTpl !== "NONE" ? { template: activeTpl } : {}),
                        },
                      },
                    },
                  }
                : extracted;
            let handled = false;
            if (workerBridgeRef.current) {
              handled = workerBridgeRef.current.dispatchFrame(enrichedFrame);
            }
            if (!handled && fallbackProcessorRef.current) {
              const res = await fallbackProcessorRef.current.processFrame(
                enrichedFrame.cameraFrame,
                { profileOverride: override, template: activeTpl },
              );
              setComposition(res.composition);
              setGuidance(res.guidance);
              setCaptureDecision(res.capture);
              dispatcherRef.current?.dispatch(res.guidance, res.capture);
            }
          });
        }
      } catch (err) {
        console.warn("Resolution switch failed:", err);
      }
    },
    [useSynthetic, videoRef],
  );

  return {
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
  };
}
