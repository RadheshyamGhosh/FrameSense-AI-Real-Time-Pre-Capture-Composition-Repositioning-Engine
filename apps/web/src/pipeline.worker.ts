import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "@framesense/camera";
import {
  MockPerceptionAdapter,
  PipelineProcessor,
} from "@framesense/perception";

let processor: PipelineProcessor | null = null;
const perceptionAdapter = new MockPerceptionAdapter("PERFECT_PORTRAIT");

self.addEventListener("message", async (ev: MessageEvent<WorkerInboundMessage>) => {
  const data = ev.data;
  if (!data) return;

  switch (data.type) {
    case "INIT": {
      processor = new PipelineProcessor({
        adapter: perceptionAdapter,
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
        const frame = {
          frameId: data.frameId,
          timestamp: data.timestamp,
          width: data.width,
          height: data.height,
          orientation: "LANDSCAPE" as const,
          source: { type: "WEBCAM" as const },
          payload: { kind: "OPAQUE_REF" as const, refId: data.frameId },
        };

        const result = await processor.processFrame(frame);

        // Clean up the transferred ImageBitmap to prevent GPU/RAM memory leaks
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
