import { useEffect, useRef, useState, useCallback } from "react";
import {
  CameraManager,
  FrameSampler,
  PipelineWorkerBridge,
  SyntheticCameraSource,
  type CameraDeviceInfo,
  type CameraStatus,
} from "@framesense/camera";
import type {
  CaptureDecision,
  CompositionResult,
  DiagnosticSample,
  GuidanceResult,
} from "@framesense/core";
import {
  DiagnosticsCollector,
  FeedbackDispatcher,
  type FeedbackSettings,
} from "@framesense/feedback";
import {
  MockPerceptionAdapter,
  PipelineProcessor,
  type MockPerceptionPreset,
} from "@framesense/perception";
import type { FrameSenseConfig } from "@framesense/config";

export interface CapturedPhoto {
  readonly dataUrl: string;
  readonly timestamp: number;
  readonly score: number;
  readonly composition: CompositionResult;
  readonly profile: string;
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
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<CameraDeviceInfo[]>([]);
  const [useSynthetic, setUseSynthetic] = useState(false);
  const [syntheticPreset, setSyntheticPreset] = useState<MockPerceptionPreset>("PERFECT_PORTRAIT");

  const [composition, setComposition] = useState<CompositionResult | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResult | null>(null);
  const [captureDecision, setCaptureDecision] = useState<CaptureDecision | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticSample | null>(null);
  const [isAutoCapture, setIsAutoCapture] = useState(true);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  const cameraManagerRef = useRef<CameraManager | null>(null);
  const samplerRef = useRef<FrameSampler | null>(null);
  const workerBridgeRef = useRef<PipelineWorkerBridge | null>(null);
  const fallbackProcessorRef = useRef<PipelineProcessor | null>(null);
  const fallbackAdapterRef = useRef<MockPerceptionAdapter | null>(null);
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
    });
    samplerRef.current = sampler;

    const dispatcher = new FeedbackDispatcher();
    dispatcherRef.current = dispatcher;

    const diag = new DiagnosticsCollector();
    diagnosticsRef.current = diag;

    // Direct fallback processor for local execution & synthetic mode
    const fallbackAdapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");
    fallbackAdapterRef.current = fallbackAdapter;
    const processor = new PipelineProcessor({
      adapter: fallbackAdapter,
      config: DEFAULT_CONFIG,
    });
    fallbackProcessorRef.current = processor;

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
            2,
            Math.round(now - res.timestamp),
          );

          setComposition(res.composition);
          setGuidance(res.guidance);
          setCaptureDecision(res.capture);

          dispatcher.dispatch(res.guidance, res.capture);
        });

        workerBridgeRef.current = bridge;
      }
    } catch {
      // Fallback runs directly in-thread
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
    }, 1000);

    return () => {
      clearInterval(diagTimer);
      manager.stop();
      sampler.stopSampling();
      workerBridgeRef.current?.terminate();
      syntheticSourceRef.current?.stop();
    };
  }, []);

  // Update mock preset when changed
  useEffect(() => {
    if (fallbackAdapterRef.current) {
      fallbackAdapterRef.current.setPreset(syntheticPreset);
    }
  }, [syntheticPreset]);

  // Capture frame action
  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !composition) return;

    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 200);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

      setCapturedPhoto({
        dataUrl,
        timestamp: Date.now(),
        score: composition.overallScore,
        composition,
        profile: composition.profile,
      });
    }
  }, [composition, videoRef]);

  // Auto-capture monitor: triggers takePhoto when ready
  useEffect(() => {
    if (isAutoCapture && captureDecision?.ready && !capturedPhoto) {
      takePhoto();
    }
  }, [isAutoCapture, captureDecision?.ready, capturedPhoto, takePhoto]);

  // Camera start method
  const startCamera = async (deviceId?: string) => {
    if (useSynthetic) {
      // Start synthetic stream
      setCameraStatus("STREAMING");
      const synthetic = new SyntheticCameraSource({ fps: 15 });
      syntheticSourceRef.current = synthetic;
      synthetic.start(async (frame) => {
        diagnosticsRef.current?.recordCameraFrame();
        if (fallbackProcessorRef.current) {
          const res = await fallbackProcessorRef.current.processFrame(frame);
          setComposition(res.composition);
          setGuidance(res.guidance);
          setCaptureDecision(res.capture);
          dispatcherRef.current?.dispatch(res.guidance, res.capture);
        }
      });
      return;
    }

    if (!cameraManagerRef.current) return;
    try {
      const stream = await cameraManagerRef.current.start({
        deviceId,
        width: 1920,
        height: 1080,
        targetFps: 30,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraStatus("STREAMING");
      setActiveDeviceId(cameraManagerRef.current.getActiveDeviceId());

      // Start frame sampler
      if (samplerRef.current && videoRef.current) {
        samplerRef.current.startSampling(videoRef.current, async (extracted) => {
          diagnosticsRef.current?.recordCameraFrame();

          // Dispatch to Web Worker or direct fallback processor
          if (workerBridgeRef.current) {
            workerBridgeRef.current.dispatchFrame(extracted);
          } else if (fallbackProcessorRef.current) {
            const res = await fallbackProcessorRef.current.processFrame(extracted.cameraFrame);
            setComposition(res.composition);
            setGuidance(res.guidance);
            setCaptureDecision(res.capture);
            dispatcherRef.current?.dispatch(res.guidance, res.capture);
          }
        });
      }
    } catch (err) {
      setCameraStatus("ERROR");
      console.error("Camera start error:", err);
    }
  };

  const stopCamera = () => {
    samplerRef.current?.stopSampling();
    cameraManagerRef.current?.stop();
    syntheticSourceRef.current?.stop();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStatus("IDLE");
  };

  const switchCamera = async (deviceId: string) => {
    stopCamera();
    await startCamera(deviceId);
  };

  const updateFeedbackSettings = (settings: Partial<FeedbackSettings>) => {
    dispatcherRef.current?.updateSettings(settings);
  };

  return {
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
    clearCapturedPhoto: () => setCapturedPhoto(null),
    startCamera,
    stopCamera,
    switchCamera,
    takePhoto,
    updateFeedbackSettings,
  };
}
