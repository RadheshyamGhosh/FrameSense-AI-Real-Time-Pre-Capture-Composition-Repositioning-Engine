import {
  CameraError,
  type CameraConstraintsConfig,
  type CameraDeviceInfo,
  type CameraErrorCode,
  type CameraStatus,
} from "./types.js";

export interface MediaDevicesProvider {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
}

function resolveMediaDevices(): MediaDevicesProvider | null {
  if (typeof navigator !== "undefined" && navigator.mediaDevices) {
    return navigator.mediaDevices;
  }
  return null;
}

export class CameraManager {
  private status: CameraStatus = "IDLE";
  private currentStream: MediaStream | null = null;
  private currentDeviceId: string | null = null;
  private readonly mediaDevicesProvider: MediaDevicesProvider | null;

  constructor(customProvider?: MediaDevicesProvider) {
    this.mediaDevicesProvider = customProvider ?? resolveMediaDevices();
  }

  public getStatus(): CameraStatus {
    return this.status;
  }

  public getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  public getActiveDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /**
   * Enumerates available video input cameras.
   */
  public async listDevices(): Promise<CameraDeviceInfo[]> {
    if (!this.mediaDevicesProvider) {
      throw new CameraError("NOT_SUPPORTED", "MediaDevices API is not available in this environment.");
    }

    try {
      const devices = await this.mediaDevicesProvider.enumerateDevices();
      return devices
        .filter((d) => d.kind === "videoinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
          groupId: d.groupId,
        }));
    } catch (err) {
      throw this.normalizeError(err);
    }
  }

  /**
   * Starts a camera stream with the requested constraints.
   */
  public async start(options?: CameraConstraintsConfig): Promise<MediaStream> {
    if (!this.mediaDevicesProvider) {
      this.status = "ERROR";
      throw new CameraError("NOT_SUPPORTED", "MediaDevices API is not available.");
    }

    this.status = "INITIALIZING";

    // Clean up any existing stream before starting a new one
    this.stop();

    const videoConstraints: MediaTrackConstraints = {
      width: options?.width ? { ideal: options.width } : { ideal: 1920 },
      height: options?.height ? { ideal: options.height } : { ideal: 1080 },
      frameRate: options?.targetFps ? { ideal: options.targetFps } : { ideal: 30 },
      facingMode: options?.facingMode ?? "user",
    };

    if (options?.deviceId) {
      videoConstraints.deviceId = { exact: options.deviceId };
    }

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: false,
    };

    try {
      const stream = await this.mediaDevicesProvider.getUserMedia(constraints);
      this.currentStream = stream;
      this.status = "STREAMING";

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        this.currentDeviceId = videoTrack.getSettings()?.deviceId ?? options?.deviceId ?? null;
      }

      return stream;
    } catch (err) {
      this.status = "ERROR";
      throw this.normalizeError(err);
    }
  }

  /**
   * Switches to a specific camera device.
   */
  public async switchCamera(deviceId: string, options?: Omit<CameraConstraintsConfig, "deviceId">): Promise<MediaStream> {
    return this.start({
      ...options,
      deviceId,
    });
  }

  /**
   * Stops all active camera tracks and resets status to IDLE.
   */
  public stop(): void {
    if (this.currentStream) {
      for (const track of this.currentStream.getTracks()) {
        track.stop();
      }
      this.currentStream = null;
    }
    this.currentDeviceId = null;
    this.status = "IDLE";
  }

  private normalizeError(error: unknown): CameraError {
    if (error instanceof CameraError) {
      return error;
    }

    if (error && typeof error === "object" && "name" in error) {
      const name = (error as { name: string; message?: string }).name;
      const message = (error as { message?: string }).message || "Camera operation failed";

      let code: CameraErrorCode = "UNKNOWN";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        code = "PERMISSION_DENIED";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        code = "DEVICE_NOT_FOUND";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        code = "DEVICE_IN_USE";
      } else if (name === "OverconstrainedError") {
        code = "OVERCONSTRAINED";
      }

      return new CameraError(code, `${code}: ${message}`);
    }

    return new CameraError("UNKNOWN", String(error));
  }
}
