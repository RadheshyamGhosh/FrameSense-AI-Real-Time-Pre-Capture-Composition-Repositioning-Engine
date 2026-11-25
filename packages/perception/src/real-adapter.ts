/**
 * RealPerceptionAdapter
 *
 * Production on-device computer vision adapter.
 * Analyzes actual pixel data from the live camera stream.
 *
 * Features:
 * 1. Native FaceDetector API (up to 5 faces, when supported by browser/worker)
 * 2. Deterministic YCbCr skin-chroma clustering fallback (Chai-Ngan 1999)
 * 3. Scanline luminance gradient regression horizon detection
 * 4. Empty-frame / no-subject discrimination
 */

import type {
  CameraFrame,
  FaceResult,
  FrameQualityMetrics,
  HorizonResult,
  PerceptionResult,
} from "@framesense/core";
import { detectHorizonFromPixels } from "./horizon.js";
import { evaluateFrameQuality } from "./quality.js";
import { classifyScene } from "./scene.js";
import type { PerceptionAdapter, PerceptionProcessOptions } from "./types.js";

interface BrowserFaceDetector {
  detect(source: ImageBitmap | HTMLVideoElement | HTMLCanvasElement): Promise<
    Array<{
      boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>
  >;
}

/** Check if pixel is human skin using standard Chai-Ngan YCbCr model */
export function isHumanSkin(r: number, g: number, b: number): boolean {
  // YCbCr transformation
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  // Universal skin-color cluster boundaries
  const isSkinChroma = y > 35 && cb >= 77 && cb <= 135 && cr >= 130 && cr <= 180;
  if (!isSkinChroma) return false;

  // Additional RGB rule: R > G and R > B in typical skin
  return r > g && r > b && Math.abs(r - g) >= 8;
}

/** Extract downsampled pixels from ImageBitmap via OffscreenCanvas */
function extractPixelsFromBitmap(
  bitmap: ImageBitmap,
  sampleW = 120,
  sampleH = 80,
): { data: Uint8ClampedArray; w: number; h: number } | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(sampleW, sampleH);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
      const img = ctx.getImageData(0, 0, sampleW, sampleH);
      return { data: img.data, w: sampleW, h: sampleH };
    }
  } catch {
    // Canvas context error fallback
  }
  return null;
}

export interface DetectedClusterBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly confidence: number;
}

/**
 * Multi-face connected-component clustering over Chai-Ngan YCbCr skin probabilities.
 * Isolates multiple faces for GROUP framing and rejects flat large background walls.
 */
export function detectFaceClusters(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  maxFaces = 5,
): DetectedClusterBox[] {
  const maxScanY = Math.floor(h * 0.82);
  const mask = new Uint8Array(w * maxScanY);
  let totalSkin = 0;

  for (let y = 0; y < maxScanY; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (r !== undefined && g !== undefined && b !== undefined && isHumanSkin(r, g, b)) {
        mask[y * w + x] = 1;
        totalSkin++;
      }
    }
  }

  const totalPixels = w * maxScanY;
  if (totalSkin < totalPixels * 0.008) {
    return [];
  }

  const visited = new Uint8Array(w * maxScanY);
  const minClusterPixels = Math.max(12, Math.floor(totalPixels * 0.006));
  const candidates: Array<DetectedClusterBox & { area: number }> = [];

  const queueX = new Int32Array(w * maxScanY);
  const queueY = new Int32Array(w * maxScanY);

  for (let sy = 0; sy < maxScanY; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const startIdx = sy * w + sx;
      if (mask[startIdx] !== 1 || visited[startIdx] === 1) continue;

      let head = 0;
      let tail = 0;
      queueX[tail] = sx;
      queueY[tail] = sy;
      tail++;
      visited[startIdx] = 1;

      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      let minLum = 255;
      let maxLum = 0;

      while (head < tail) {
        const cx = queueX[head] ?? 0;
        const cy = queueY[head] ?? 0;
        head++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const pIdx = (cy * w + cx) * 4;
        const lum =
          0.299 * (data[pIdx] ?? 0) +
          0.587 * (data[pIdx + 1] ?? 0) +
          0.114 * (data[pIdx + 2] ?? 0);
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;

        // 4-connected neighbors
        const neighbors: [number, number][] = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= maxScanY) continue;
          const nIdx = ny * w + nx;
          if (mask[nIdx] === 1 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail++;
          }
        }
      }

      const pixelCount = tail;
      if (pixelCount < minClusterPixels) continue;

      const compW = maxX - minX + 1;
      const compH = maxY - minY + 1;
      const aspect = compW / Math.max(1, compH);
      const frameAreaRatio = pixelCount / totalPixels;

      // Reject elongated background strips and uniform flat warm-colored walls
      if (aspect < 0.35 || aspect > 1.75) continue;
      if (frameAreaRatio > 0.48 && maxLum - minLum < 10) continue;

      const padX = Math.round(compW * 0.12);
      const padY = Math.round(compH * 0.16);
      const finalMinX = Math.max(0, minX - padX);
      const finalMaxX = Math.min(w - 1, maxX + padX);
      const finalMinY = Math.max(0, minY - padY);
      const finalMaxY = Math.min(h - 1, maxY + padY);

      const normX = finalMinX / w;
      const normY = finalMinY / h;
      const normW = Math.max(0.01, (finalMaxX - finalMinX) / w);
      const normH = Math.max(0.01, (finalMaxY - finalMinY) / h);
      const boxArea = normW * normH;
      const confidence = Math.min(0.95, Math.max(0.65, 0.52 + boxArea * 1.4));

      candidates.push({
        x: Number(normX.toFixed(3)),
        y: Number(normY.toFixed(3)),
        width: Number(normW.toFixed(3)),
        height: Number(normH.toFixed(3)),
        confidence: Number(confidence.toFixed(2)),
        area: pixelCount,
      });
    }
  }

  candidates.sort((a, b) => b.area - a.area);
  return candidates.slice(0, maxFaces).map(({ x, y, width, height, confidence }) => ({
    x,
    y,
    width,
    height,
    confidence,
  }));
}

/** Find primary face/head bounding box using connected skin-tone cluster density map */
export function detectFaceCluster(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): DetectedClusterBox | null {
  return detectFaceClusters(data, w, h, 1)[0] ?? null;
}

function mirrorFaceBoxHorizontally(face: FaceResult): FaceResult {
  const flippedX = Math.max(0, Math.min(1, 1 - face.boundingBox.x - face.boundingBox.width));
  return {
    ...face,
    boundingBox: {
      ...face.boundingBox,
      x: Number(flippedX.toFixed(3)),
    },
  };
}

export class RealPerceptionAdapter implements PerceptionAdapter {
  private nativeDetector: BrowserFaceDetector | null = null;
  private nativeAvailable = false;
  private isInit = false;

  public async initialize(): Promise<void> {
    if (this.isInit) return;
    this.isInit = true;

    try {
      // Check native FaceDetector in global scope (window or self)
      const globalScope = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : null;
      if (globalScope && "FaceDetector" in globalScope) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DetectorClass = (globalScope as any).FaceDetector;
        this.nativeDetector = new DetectorClass({ fastMode: true, maxDetectedFaces: 5 });
        this.nativeAvailable = true;
      }
    } catch {
      this.nativeAvailable = false;
    }
  }

  public async processFrame(
    frame: CameraFrame,
    options?: PerceptionProcessOptions,
  ): Promise<PerceptionResult> {
    const t0 = performance.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bitmap: ImageBitmap | undefined = (frame as any).__bitmap;

    let faces: FaceResult[] = [];
    let horizon: HorizonResult | undefined;
    let quality: FrameQualityMetrics | undefined;
    let nativeSucceeded = false;

    if (bitmap && this.nativeAvailable && this.nativeDetector) {
      try {
        const detections = await this.nativeDetector.detect(bitmap);
        nativeSucceeded = true;
        if (detections && detections.length > 0) {
          faces = detections.map((d) => ({
            boundingBox: {
              x: Number((d.boundingBox.x / bitmap.width).toFixed(3)),
              y: Number((d.boundingBox.y / bitmap.height).toFixed(3)),
              width: Number((d.boundingBox.width / bitmap.width).toFixed(3)),
              height: Number((d.boundingBox.height / bitmap.height).toFixed(3)),
            },
            confidence: 0.94,
          }));
        }
      } catch {
        this.nativeAvailable = false;
      }
    }

    // Resolve pixel buffer from explicit options or transferred ImageBitmap
    const pixels = options?.pixelData
      ? { data: options.pixelData.data, w: options.pixelData.width, h: options.pixelData.height }
      : bitmap
        ? extractPixelsFromBitmap(bitmap, 120, 80)
        : null;

    if (pixels) {
      // Only fall back to deterministic connected-component chroma clustering when native FaceDetector is unavailable
      if (!nativeSucceeded) {
        const clusters = detectFaceClusters(pixels.data, pixels.w, pixels.h, 5);
        if (clusters.length > 0) {
          faces = clusters.map((cluster) => ({
            boundingBox: {
              x: cluster.x,
              y: cluster.y,
              width: cluster.width,
              height: cluster.height,
            },
            confidence: cluster.confidence,
          }));
        }
      }

      if (options?.detectHorizon !== false) {
        horizon = detectHorizonFromPixels({
          data: pixels.data,
          width: pixels.w,
          height: pixels.h,
        });
      }

      quality = evaluateFrameQuality(
        { data: pixels.data, width: pixels.w, height: pixels.h },
        faces[0]?.boundingBox,
      );
    }

    // Align normalized x-coordinates with mirrored selfie preview when requested
    const isMirrored = frame.payload.metadata?.mirrored === true;
    if (isMirrored && faces.length > 0) {
      faces = faces.map(mirrorFaceBoxHorizontally);
    }

    const scene = classifyScene({ faces, detections: [], horizon });

    return {
      frameId: frame.frameId,
      timestamp: frame.timestamp,
      detections: [],
      faces,
      poses: [],
      horizon,
      scene,
      quality,
      metadata: {
        processingTimeMs: Number((performance.now() - t0).toFixed(2)),
        backend: nativeSucceeded ? "native-FaceDetector" : "chroma-cluster",
      },
    };
  }

  public async dispose(): Promise<void> {
    this.nativeDetector = null;
  }
}
