import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "@framesense/camera";
import {
  PipelineProcessor,
  RealPerceptionAdapter,
} from "@framesense/perception";

let processor: PipelineProcessor | null = null;
const realAdapter = new RealPerceptionAdapter();

// Initialize the real adapter (tries FaceDetector API)
realAdapter.initialize().catch(() => {
  // Silently fall back to pixel-only analysis
});

self.addEventListener("message", async (ev: MessageEvent<WorkerInboundMessage>) => {
  const data = ev.data;
  if (!data) return;

  switch (data.type) {
    case "INIT": {
      processor = new PipelineProcessor({
        adapter: realAdapter,
        config: data.config,
      });

      const readyMsg: WorkerOutboundMessage = { type: "READY" };
      self.postMessage(readyMsg);
      break;
    }

    case "PROCESS_FRAME": {
      if (!processor) {
        const errorMsg: WorkerOutboundMessage = {
          type: "ERROR",
          error: "Pipeline worker is not initialized.",
        };
        self.postMessage(errorMsg);
        return;
      }

      try {
        // Attach the bitmap to the frame object so RealPerceptionAdapter can
        // access pixel data for on-device analysis. This is safe because the
        // bitmap has been transferred (zero-copy) to this worker's scope.
        const frame = {
          frameId: data.frameId,
          timestamp: data.timestamp,
          width: data.width,
          height: data.height,
          orientation: "LANDSCAPE" as const,
          source: { type: "WEBCAM" as const },
          payload: { kind: "OPAQUE_REF" as const, refId: data.frameId },
          // Non-standard attachment — picked up by RealPerceptionAdapter
          __bitmap: data.bitmap,
        };

        const result = await processor.processFrame(frame);

        // Release the GPU bitmap memory after analysis
        if (data.bitmap && typeof data.bitmap.close === "function") {
          data.bitmap.close();
        }

        const response: WorkerOutboundMessage = {
          type: "FRAME_PROCESSED",
          frameId: result.frameId,
          timestamp: result.timestamp,
          processingTimeMs: result.processingTimeMs,
          composition: result.composition,
          guidance: result.guidance,
          capture: result.capture,
        };

        self.postMessage(response);
      } catch (err) {
        if (data.bitmap && typeof data.bitmap.close === "function") {
          data.bitmap.close();
        }
        const errorMsg: WorkerOutboundMessage = {
          type: "ERROR",
          error: String(err),
        };
        self.postMessage(errorMsg);
      }
      break;
    }

    case "RESET": {
      if (processor) {
        processor.reset();
      }
      break;
    }
  }
});
