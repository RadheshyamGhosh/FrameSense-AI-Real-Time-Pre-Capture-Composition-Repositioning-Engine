import type { FrameSenseConfig } from "@framesense/config";
import type {
  ExtractedFrame,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "./types.js";

export interface PipelineWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: string, listener: (ev: MessageEvent) => void): void;
  terminate(): void;
}

export type FrameResultCallback = (
  result: Extract<WorkerOutboundMessage, { type: "FRAME_PROCESSED" }>,
) => void;

export type ErrorCallback = (error: string) => void;

export class PipelineWorkerBridge {
  private readonly worker: PipelineWorkerLike;
  private isBusy = false;
  private isReady = false;
  private onResultCallback: FrameResultCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private readonly messageHandler: (ev: MessageEvent) => void;

  constructor(worker: PipelineWorkerLike) {
    this.worker = worker;
    this.messageHandler = (ev: MessageEvent) => this.handleMessage(ev);
    this.worker.addEventListener("message", this.messageHandler);
  }

  /**
   * Initializes the pipeline worker with application configuration.
   */
  public initialize(config: FrameSenseConfig): void {
    const msg: WorkerInboundMessage = {
      type: "INIT",
      config,
    };
    this.worker.postMessage(msg);
  }

  /**
   * Registers a callback for processed frame outputs.
   */
  public onResult(callback: FrameResultCallback): void {
    this.onResultCallback = callback;
  }

  /**
   * Registers a callback for pipeline worker errors.
   */
  public onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  /**
   * Dispatches an extracted camera frame to the worker with zero-copy bitmap transfer.
   * If the worker is still processing a prior frame, skips this frame to prevent pipeline lag.
   */
  public dispatchFrame(extracted: ExtractedFrame): boolean {
    if (this.isBusy) {
      // Drop frame to ensure real-time responsiveness
      if (extracted.bitmap && typeof extracted.bitmap.close === "function") {
        extracted.bitmap.close();
      }
      return false;
    }

    this.isBusy = true;

    const msg: WorkerInboundMessage = {
      type: "PROCESS_FRAME",
      frameId: extracted.cameraFrame.frameId,
      timestamp: extracted.cameraFrame.timestamp,
      width: extracted.cameraFrame.width,
      height: extracted.cameraFrame.height,
      bitmap: extracted.bitmap,
    };

    const transferables: Transferable[] = [];
    if (extracted.bitmap) {
      transferables.push(extracted.bitmap);
    }

    this.worker.postMessage(msg, transferables);
    return true;
  }

  /**
   * Resets the worker's internal guidance & composition states.
   */
  public reset(): void {
    this.worker.postMessage({ type: "RESET" });
    this.isBusy = false;
  }

  /**
   * Shuts down the worker and cleans up listeners.
   */
  public terminate(): void {
    this.worker.removeEventListener("message", this.messageHandler);
    this.worker.terminate();
    this.isBusy = false;
    this.isReady = false;
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public getIsBusy(): boolean {
    return this.isBusy;
  }

  private handleMessage(ev: MessageEvent): void {
    const data = ev.data as WorkerOutboundMessage;
    if (!data) return;

    if (data.type === "READY") {
      this.isReady = true;
      return;
    }

    if (data.type === "FRAME_PROCESSED") {
      this.isBusy = false;
      if (this.onResultCallback) {
        this.onResultCallback(data);
      }
      return;
    }

    if (data.type === "ERROR") {
      this.isBusy = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(data.error);
      }
    }
  }
}
