export { CameraManager, type MediaDevicesProvider } from "./manager.js";
export { FrameSampler, type FrameSamplerOptions } from "./sampler.js";
export {
  SyntheticCameraSource,
  type SyntheticCameraOptions,
} from "./synthetic.js";
export {
  CameraError,
  type CameraConstraintsConfig,
  type CameraDeviceInfo,
  type CameraErrorCode,
  type CameraStatus,
  type ExtractedFrame,
  type WorkerInboundMessage,
  type WorkerOutboundMessage,
} from "./types.js";
export {
  PipelineWorkerBridge,
  type ErrorCallback,
  type FrameResultCallback,
  type PipelineWorkerLike,
} from "./worker-bridge.js";
