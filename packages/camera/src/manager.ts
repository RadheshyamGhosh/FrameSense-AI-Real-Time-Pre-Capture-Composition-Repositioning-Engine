import {
  CameraError,
  type CameraCapabilities,
  type CameraConstraintsConfig,
  type CameraDeviceInfo,
  type CameraErrorCode,
  type CameraRangeCapability,
  type CameraStatus,
  type ResolutionPreset,
} from "./types.js";

interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  zoom?: { min?: number; max?: number; step?: number };
  exposureCompensation?: { min?: number; max?: number; step?: number };
  width?: { max?: number; min?: number };
  height?: { max?: number; min?: number };
}

interface ExtendedTrackSettings extends MediaTrackSettings {
  zoom?: number;
  exposureCompensation?: number;
  facingMode?: string;
}

const RESOLUTION_DIMENSIONS: Record<ResolutionPreset, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4K": { width: 3840, height: 2160 },
};

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
  private currentFacingMode: "user" | "environment" | undefined = undefined;
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
    };

    if (options?.deviceId) {
      videoConstraints.deviceId = { exact: options.deviceId };
      if (options.facingMode) {
        videoConstraints.facingMode = options.facingMode;
      }
    } else {
      videoConstraints.facingMode = options?.facingMode ?? "user";
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
        const settings = (
          typeof videoTrack.getSettings === "function" ? videoTrack.getSettings() : {}
        ) as ExtendedTrackSettings;
        this.currentDeviceId = settings.deviceId ?? options?.deviceId ?? null;
        if (settings.facingMode === "user" || settings.facingMode === "environment") {
          this.currentFacingMode = settings.facingMode;
        } else if (options?.facingMode) {
          this.currentFacingMode = options.facingMode;
        } else {
          this.currentFacingMode = undefined;
        }
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
    this.currentFacingMode = undefined;
    this.status = "IDLE";
  }

  /**
   * Probes hardware capabilities (zoom, EV, max resolution) of the active video track.
   */
  public getCapabilities(): CameraCapabilities {
    const track = this.currentStream?.getVideoTracks()[0];
    if (!track) {
      return {
        zoom: null,
        exposureCompensation: null,
        supportedResolutions: ["720p", "1080p"],
      };
    }

    const caps = (
      typeof track.getCapabilities === "function" ? track.getCapabilities() : {}
    ) as ExtendedTrackCapabilities;
    const settings = (
      typeof track.getSettings === "function" ? track.getSettings() : {}
    ) as ExtendedTrackSettings;

    const toRange = (
      range: { min?: number; max?: number; step?: number } | undefined,
      currentVal: number | undefined,
      fallbackCurrent: number,
    ): CameraRangeCapability | null => {
      if (
        !range ||
        typeof range.min !== "number" ||
        typeof range.max !== "number" ||
        range.max <= range.min
      ) {
        return null;
      }
      return {
        min: range.min,
        max: range.max,
        step: typeof range.step === "number" && range.step > 0 ? range.step : 0.1,
        current: typeof currentVal === "number" ? currentVal : fallbackCurrent,
      };
    };

    const maxW = caps.width?.max ?? settings.width ?? 1920;
    const supportedResolutions: ResolutionPreset[] = ["720p"];
    if (maxW >= 1920) supportedResolutions.push("1080p");
    if (maxW >= 3840) supportedResolutions.push("4K");

    let facingMode: "user" | "environment" | undefined;
    if (settings.facingMode === "user" || settings.facingMode === "environment") {
      facingMode = settings.facingMode;
    } else if (this.currentFacingMode) {
      facingMode = this.currentFacingMode;
    } else if (typeof track.label === "string" && /\b(back|rear|environment)\b/i.test(track.label)) {
      facingMode = "environment";
    }

    return {
      zoom: toRange(caps.zoom, settings.zoom, 1),
      exposureCompensation: toRange(caps.exposureCompensation, settings.exposureCompensation, 0),
      supportedResolutions,
      activeWidth: settings.width,
      activeHeight: settings.height,
      facingMode,
    };
  }

  /**
   * Applies hardware zoom constraint if supported by active track.
   */
  public async applyZoom(zoom: number): Promise<boolean> {
    const track = this.currentStream?.getVideoTracks()[0];
    if (!track || typeof track.applyConstraints !== "function") return false;

    try {
      await track.applyConstraints({
        advanced: [{ zoom } as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Applies hardware exposure compensation (EV) if supported by active track.
   */
  public async applyExposureCompensation(ev: number): Promise<boolean> {
    const track = this.currentStream?.getVideoTracks()[0];
    if (!track || typeof track.applyConstraints !== "function") return false;

    try {
      await track.applyConstraints({
        advanced: [{ exposureCompensation: ev } as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restarts active camera device stream with a target resolution preset,
   * preserving device/facing identity on failure so callers can recover the prior camera.
   */
  public async setResolution(preset: ResolutionPreset): Promise<MediaStream> {
    const dims = RESOLUTION_DIMENSIONS[preset];
    const prevDeviceId = this.currentDeviceId;
    const prevFacingMode = this.currentFacingMode;
    try {
      return await this.start({
        deviceId: prevDeviceId ?? undefined,
        facingMode: prevDeviceId ? undefined : prevFacingMode,
        width: dims.width,
        height: dims.height,
        targetFps: 30,
      });
    } catch (err) {
      this.currentDeviceId = prevDeviceId;
      this.currentFacingMode = prevFacingMode;
      throw err;
    }
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
