import { useEffect, useRef, useState, useCallback } from "react";
import {
  CameraManager,
  FrameSampler,
  PipelineWorkerBridge,
  SyntheticCameraSource,
  computeAspectCropRect,
  computeNormalizedCropRegion,
  type AspectRatioPreset,
  type CameraCapabilities,
  type CameraDeviceInfo,
  type CameraStatus,
  type ExtractedFrame,
  type ResolutionPreset,
} from "@framesense/camera";
import { DEFAULT_FRAMESENSE_CONFIG } from "@framesense/config/defaults";
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

export interface CapturedPhoto {
  readonly id: string;
  readonly dataUrl: string;
  readonly timestamp: number;
  readonly score: number | null;
  readonly composition: CompositionResult | null;
  readonly profile: string;
  readonly aspectRatio: AspectRatioPreset;
}

const DEFAULT_CONFIG = DEFAULT_FRAMESENSE_CONFIG;

const RESOLUTION_DIMENSIONS: Record<ResolutionPreset, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4K": { width: 3840, height: 2160 },
};

function drawSyntheticSceneToCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  composition: CompositionResult | null,
  preset: MockPerceptionPreset,
): void {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#101826");
  grad.addColorStop(1, "#090d14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Simulated horizon line (composition.primarySubjectBounds already reflects active crop/zoom projection)
  const angleRad = ((composition?.horizonAngleDegrees ?? 0) * Math.PI) / 180;
  ctx.save();
  ctx.translate(w / 2, h * 0.52);
  ctx.rotate(angleRad);
  ctx.fillStyle = "rgba(30, 58, 95, 0.35)";
  ctx.fillRect(-w, 0, w * 2, h);
  ctx.restore();

  // Simulated subject silhouette matching current composition subject bounds
  const box = composition?.primarySubjectBounds;
  if (box) {
    const cx = (box.x + box.width / 2) * w;
    const cy = (box.y + box.height / 2) * h;
    const rx = Math.max(18, (box.width * w) / 2);
    const ry = Math.max(24, (box.height * h) / 2);

    ctx.fillStyle = "rgba(148, 163, 184, 0.24)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.78, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shoulders hint for portraits
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 1.45, rx * 1.45, ry * 0.75, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(46, 213, 115, 0.85)";
  ctx.font = `600 ${Math.max(12, Math.round(w / 48))}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(`SIMULATION: ${preset}`, 16, h - 16);
  ctx.restore();
}

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
  const aspectRatioRef = useRef<AspectRatioPreset>("VIEWPORT");
  const aspectBeforeTemplateRef = useRef<AspectRatioPreset>("VIEWPORT");
  const [mirrorSavedPhoto, setMirrorSavedPhoto] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset>("720p");
  const resolutionPresetRef = useRef<ResolutionPreset>("720p");
  const [cameraCapabilities, setCameraCapabilities] = useState<CameraCapabilities | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomLevelRef = useRef(1);
  const hasHwZoomRef = useRef(false);
  const [exposureEv, setExposureEv] = useState(0);
  const exposureEvRef = useRef(0);

  useEffect(() => {
    sceneProfileRef.current = sceneProfile;
    workerBridgeRef.current?.reset();
    fallbackProcessorRef.current?.reset();
    syntheticProcessorRef.current?.reset();
    setCaptureDecision(null);
  }, [sceneProfile]);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    aspectRatioRef.current = aspectRatio;
  }, [aspectRatio]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    exposureEvRef.current = exposureEv;
  }, [exposureEv]);

  useEffect(() => {
    resolutionPresetRef.current = resolutionPreset;
  }, [resolutionPreset]);

  useEffect(() => {
    hasHwZoomRef.current = Boolean(cameraCapabilities?.zoom);
  }, [cameraCapabilities?.zoom]);

  const setTemplate = useCallback(
    (nextTemplate: FramingTemplate) => {
      setTemplateState((prev) => {
        if (prev === "NONE" && nextTemplate !== "NONE") {
          aspectBeforeTemplateRef.current = aspectRatioRef.current;
        }
        return nextTemplate;
      });

      if (nextTemplate === "PASSPORT_ID") {
        setAspectRatio("1:1");
      } else if (nextTemplate === "CREATOR_TALKING_HEAD") {
        setAspectRatio("16:9");
      } else if (nextTemplate === "NONE") {
        setAspectRatio(aspectBeforeTemplateRef.current);
      }

      workerBridgeRef.current?.reset();
      fallbackProcessorRef.current?.reset();
      syntheticProcessorRef.current?.reset();
      setCaptureDecision(null);
    },
    [],
  );

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
  const videoFrameCbIdRef = useRef<number | null>(null);
  const cancelVideoFrameCbRef = useRef<(() => void) | null>(null);

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
      voiceMinIntervalMs: DEFAULT_CONFIG.guidance.voiceMinIntervalMs ?? 2200,
    });
    dispatcherRef.current = dispatcher;

    const diag = new DiagnosticsCollector();
    diagnosticsRef.current = diag;

    // In-thread fallback adapter (used only when Web Workers are unsupported)
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
            res.inferenceLatencyMs ?? res.processingTimeMs,
            res.guidanceLatencyMs ?? 0,
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
      cancelVideoFrameCbRef.current?.();
      cancelVideoFrameCbRef.current = null;
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
        if (mirrorSavedPhoto && isFrontCamera) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
      } else {
        drawSyntheticSceneToCanvas(
          ctx,
          canvas.width,
          canvas.height,
          composition,
          syntheticPreset,
        );
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
  }, [aspectRatio, cameraCapabilities?.zoom, composition, isFrontCamera, mirrorSavedPhoto, resetPipelineStates, syntheticPreset, useSynthetic, videoRef, zoomLevel]);

  // Auto-capture monitor: triggers takePhoto when ready
  useEffect(() => {
    if (isAutoCapture && captureDecision?.ready && !capturedPhoto) {
      takePhoto();
    }
  }, [isAutoCapture, captureDecision?.ready, capturedPhoto, takePhoto]);

  const attachStreamAndStartSampling = useCallback(
    async (stream: MediaStream) => {
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener("loadedmetadata", onReady);
            resolve();
          };
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
      if (cameraManagerRef.current) {
        setActiveDeviceId(cameraManagerRef.current.getActiveDeviceId());
        const probedCaps = cameraManagerRef.current.getCapabilities();
        const frontFacing = probedCaps.facingMode !== "environment";
        setIsFrontCamera(frontFacing);
        samplerRef.current?.setMirrorHorizontal(frontFacing);
        setCameraCapabilities(probedCaps);
        hasHwZoomRef.current = Boolean(probedCaps.zoom);
        const initialZoom = probedCaps.zoom ? probedCaps.zoom.current : 1;
        const initialEv = probedCaps.exposureCompensation ? probedCaps.exposureCompensation.current : 0;
        setZoomLevel(initialZoom);
        zoomLevelRef.current = initialZoom;
        setExposureEv(initialEv);
        exposureEvRef.current = initialEv;

        cameraManagerRef.current
          .listDevices()
          .then((devs) => setAvailableDevices(devs))
          .catch(() => {});
      }

      const currentVideo = videoRef.current;
      type VideoWithFrameCb = HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      const vWithCb = currentVideo as VideoWithFrameCb | null;
      const supportsVfc = Boolean(vWithCb && typeof vWithCb.requestVideoFrameCallback === "function");

      if (vWithCb && supportsVfc && vWithCb.requestVideoFrameCallback) {
        cancelVideoFrameCbRef.current?.();
        const trackCameraFps = () => {
          diagnosticsRef.current?.recordCameraFrame();
          if (videoRef.current === vWithCb && vWithCb.srcObject && vWithCb.requestVideoFrameCallback) {
            videoFrameCbIdRef.current = vWithCb.requestVideoFrameCallback(trackCameraFps);
          }
        };
        videoFrameCbIdRef.current = vWithCb.requestVideoFrameCallback(trackCameraFps);
        cancelVideoFrameCbRef.current = () => {
          if (videoFrameCbIdRef.current !== null && vWithCb.cancelVideoFrameCallback) {
            vWithCb.cancelVideoFrameCallback(videoFrameCbIdRef.current);
            videoFrameCbIdRef.current = null;
          }
        };
      }

      if (samplerRef.current && currentVideo) {
        samplerRef.current.startSampling(currentVideo, async (extracted: ExtractedFrame) => {
          if (!supportsVfc) {
            diagnosticsRef.current?.recordCameraFrame();
          }

          const override =
            sceneProfileRef.current === "AUTO" ? undefined : sceneProfileRef.current;
          const activeTpl = templateRef.current;
          const rect = currentVideo.getBoundingClientRect();
          const rawW = currentVideo.videoWidth || 1280;
          const rawH = currentVideo.videoHeight || 720;
          const activeDigitalZoom = hasHwZoomRef.current ? 1 : zoomLevelRef.current;
          const cropRegion = computeNormalizedCropRegion(
            rawW,
            rawH,
            aspectRatioRef.current,
            rect.width,
            rect.height,
            activeDigitalZoom,
          );

          const enrichedFrame: ExtractedFrame = {
            ...extracted,
            cameraFrame: {
              ...extracted.cameraFrame,
              payload: {
                ...extracted.cameraFrame.payload,
                metadata: {
                  ...extracted.cameraFrame.payload.metadata,
                  cropX: cropRegion.x,
                  cropY: cropRegion.y,
                  cropW: cropRegion.width,
                  cropH: cropRegion.height,
                  ...(override ? { profileOverride: override } : {}),
                  ...(activeTpl !== "NONE" ? { template: activeTpl } : {}),
                },
              },
            },
          };

          if (workerBridgeRef.current) {
            // Worker exists: dispatch off-thread or let bridge drop cleanly when busy (Rule 4)
            workerBridgeRef.current.dispatchFrame(enrichedFrame);
            return;
          }

          // Fallback ONLY when Web Worker runtime is unavailable
          if (fallbackProcessorRef.current) {
            try {
              const frameWithBitmap = {
                ...enrichedFrame.cameraFrame,
                __bitmap: enrichedFrame.bitmap,
              };
              const res = await fallbackProcessorRef.current.processFrame(
                frameWithBitmap,
                { profileOverride: override, template: activeTpl, cropRegion },
              );
              diagnosticsRef.current?.recordProcessingCycle(
                res.timestamp,
                res.inferenceLatencyMs ?? res.processingTimeMs,
                res.guidanceLatencyMs ?? 0,
                Math.max(0, Math.round(performance.now() - res.timestamp)),
              );
              setComposition(res.composition);
              setGuidance(res.guidance);
              setCaptureDecision(res.capture);
              dispatcherRef.current?.dispatch(res.guidance, res.capture);
            } finally {
              if (enrichedFrame.bitmap && typeof enrichedFrame.bitmap.close === "function") {
                enrichedFrame.bitmap.close();
              }
            }
          }
        });
      }
    },
    [videoRef],
  );

  // Camera start method – takes an explicit synthetic flag to avoid stale closure
  const startCamera = async (deviceId?: string, forceUseSynthetic?: boolean) => {
    const synthetic = forceUseSynthetic ?? useSynthetic;
    setCameraError(null);
    resetPipelineStates();
    diagnosticsRef.current?.reset();

    if (synthetic) {
      // Tear down any active live camera stream/callbacks/capabilities before entering simulation
      cancelVideoFrameCbRef.current?.();
      cancelVideoFrameCbRef.current = null;
      samplerRef.current?.stopSampling();
      cameraManagerRef.current?.stop();
      syntheticSourceRef.current?.stop();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setActiveDeviceId(null);
      setCameraCapabilities(null);
      hasHwZoomRef.current = false;
      setZoomLevel(1);
      zoomLevelRef.current = 1;
      setExposureEv(0);
      exposureEvRef.current = 0;
      setIsFrontCamera(true);
      samplerRef.current?.setMirrorHorizontal(true);
      if (fallbackAdapterRef.current) {
        fallbackAdapterRef.current.setPreset(syntheticPreset);
      }
      setCameraStatus("STREAMING");
      const synth = new SyntheticCameraSource({
        width: RESOLUTION_DIMENSIONS["720p"].width,
        height: RESOLUTION_DIMENSIONS["720p"].height,
        fps: DEFAULT_CONFIG.performance.targetProcessingFps,
      });
      syntheticSourceRef.current = synth;
      synth.start(async (frame) => {
        diagnosticsRef.current?.recordCameraFrame();
        if (syntheticProcessorRef.current) {
          const override =
            sceneProfileRef.current === "AUTO" ? undefined : sceneProfileRef.current;
          const activeDigitalZoom = hasHwZoomRef.current ? 1 : zoomLevelRef.current;
          const rect = videoRef.current?.getBoundingClientRect();
          const cropRegion = computeNormalizedCropRegion(
            frame.width,
            frame.height,
            aspectRatioRef.current,
            rect && rect.width > 0 ? rect.width : undefined,
            rect && rect.height > 0 ? rect.height : undefined,
            activeDigitalZoom,
          );
          const res = await syntheticProcessorRef.current.processFrame(frame, {
            profileOverride: override,
            template: templateRef.current,
            cropRegion,
          });
          diagnosticsRef.current?.recordProcessingCycle(
            res.timestamp,
            res.inferenceLatencyMs ?? res.processingTimeMs,
            res.guidanceLatencyMs ?? 0,
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
      const dims = RESOLUTION_DIMENSIONS[resolutionPresetRef.current];
      const stream = await cameraManagerRef.current.start({
        deviceId,
        width: dims.width,
        height: dims.height,
        targetFps: DEFAULT_CONFIG.performance.targetCameraFps,
      });
      await attachStreamAndStartSampling(stream);
    } catch (err) {
      setCameraStatus("ERROR");
      const message =
        err instanceof Error ? err.message : "Unable to access camera device.";
      setCameraError(message);
      console.error("Camera start error:", err);
    }
  };

  const stopCamera = () => {
    cancelVideoFrameCbRef.current?.();
    cancelVideoFrameCbRef.current = null;
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
    setActiveDeviceId(null);
    setComposition(null);
    setGuidance(null);
    setCameraCapabilities(null);
    hasHwZoomRef.current = false;
    setZoomLevel(1);
    zoomLevelRef.current = 1;
    setExposureEv(0);
    exposureEvRef.current = 0;
    setIsFrontCamera(true);
    samplerRef.current?.setMirrorHorizontal(true);
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
    const prevZoom = zoomLevelRef.current;
    setZoomLevel(nextZoom);
    if (hasHwZoomRef.current && cameraManagerRef.current) {
      const ok = await cameraManagerRef.current.applyZoom(nextZoom);
      if (!ok) {
        const caps = cameraManagerRef.current.getCapabilities();
        setZoomLevel(caps.zoom?.current ?? prevZoom);
      }
    }
  }, []);

  const changeExposure = useCallback(async (nextEv: number) => {
    const prevEv = exposureEvRef.current;
    setExposureEv(nextEv);
    if (cameraManagerRef.current) {
      const ok = await cameraManagerRef.current.applyExposureCompensation(nextEv);
      if (!ok) {
        const caps = cameraManagerRef.current.getCapabilities();
        setExposureEv(caps.exposureCompensation?.current ?? prevEv);
      }
    }
  }, []);

  const changeResolution = useCallback(
    async (nextPreset: ResolutionPreset) => {
      if (!cameraManagerRef.current || useSynthetic) return;
      const prevPreset = resolutionPresetRef.current;
      try {
        samplerRef.current?.stopSampling();
        resetPipelineStates();
        const stream = await cameraManagerRef.current.setResolution(nextPreset);
        setResolutionPreset(nextPreset);
        await attachStreamAndStartSampling(stream);
      } catch (err) {
        console.warn(`Resolution ${nextPreset} failed; recovering ${prevPreset}:`, err);
        try {
          const recovered = await cameraManagerRef.current.setResolution(prevPreset);
          setResolutionPreset(prevPreset);
          await attachStreamAndStartSampling(recovered);
        } catch (recoveryErr) {
          setCameraStatus("ERROR");
          setCameraError(
            recoveryErr instanceof Error
              ? recoveryErr.message
              : `Unable to switch camera to ${nextPreset}.`,
          );
        }
      }
    },
    [attachStreamAndStartSampling, resetPipelineStates, useSynthetic],
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
    isFrontCamera,
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
