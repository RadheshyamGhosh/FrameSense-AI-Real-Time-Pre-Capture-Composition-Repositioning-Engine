import type { BoundingBox, PerceptionResult, Point2D } from "@framesense/core";
import type { PrimarySubject } from "./types.js";

/**
 * Extracts or aggregates the primary subject from the perception result.
 */
export function extractPrimarySubject(perception: PerceptionResult): PrimarySubject {
  const faces = perception.faces ?? [];
  const poses = perception.poses ?? [];
  const detections = perception.detections ?? [];

  // 1. Faces take highest priority in portrait scenarios
  if (faces.length > 0) {
    if (faces.length === 1) {
      const face = faces[0];
      const box = face.boundingBox;
      return {
        boundingBox: box,
        center: {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        },
        // In portrait photography, the eyes/upper face are the primary visual focal point
        focalPoint: {
          x: box.x + box.width / 2,
          y: box.y + box.height * 0.35,
        },
        confidence: face.confidence,
        source: "FACE",
      };
    }

    // Multiple faces: compute bounding envelope covering all faces
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    let totalConf = 0;

    for (const face of faces) {
      minX = Math.min(minX, face.boundingBox.x);
      minY = Math.min(minY, face.boundingBox.y);
      maxX = Math.max(maxX, face.boundingBox.x + face.boundingBox.width);
      maxY = Math.max(maxY, face.boundingBox.y + face.boundingBox.height);
      totalConf += face.confidence;
    }

    const box: BoundingBox = {
      x: Math.max(0, minX),
      y: Math.max(0, minY),
      width: Math.min(1, Math.max(0, maxX - minX)),
      height: Math.min(1, Math.max(0, maxY - minY)),
    };

    return {
      boundingBox: box,
      center: {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      },
      focalPoint: {
        x: box.x + box.width / 2,
        y: box.y + box.height * 0.4,
      },
      confidence: totalConf / faces.length,
      source: "FACE",
    };
  }

  // 2. Pose estimation fallback
  if (poses.length > 0) {
    const pose = poses[0];
    if (pose.boundingBox) {
      const box = pose.boundingBox;
      return {
        boundingBox: box,
        center: {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        },
        focalPoint: {
          x: box.x + box.width / 2,
          y: box.y + box.height * 0.25,
        },
        confidence: pose.confidence,
        source: "POSE",
      };
    }

    const landmarks = pose.landmarks ?? [];
    if (landmarks.length > 0) {
      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;

      for (const lm of landmarks) {
        minX = Math.min(minX, lm.position.x);
        minY = Math.min(minY, lm.position.y);
        maxX = Math.max(maxX, lm.position.x);
        maxY = Math.max(maxY, lm.position.y);
      }

      const box: BoundingBox = {
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        width: Math.min(1, Math.max(0, maxX - minX)),
        height: Math.min(1, Math.max(0, maxY - minY)),
      };

      return {
        boundingBox: box,
        center: {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        },
        focalPoint: {
          x: box.x + box.width / 2,
          y: box.y + box.height * 0.25,
        },
        confidence: pose.confidence,
        source: "POSE",
      };
    }
  }

  // 3. Object detections fallback
  if (detections.length > 0) {
    // Prefer "person" category if present, or highest confidence
    const sorted = [...detections].sort((a, b) => {
      const aIsPerson = a.category.toLowerCase().includes("person") ? 1 : 0;
      const bIsPerson = b.category.toLowerCase().includes("person") ? 1 : 0;
      if (aIsPerson !== bIsPerson) return bIsPerson - aIsPerson;
      return b.confidence - a.confidence;
    });

    const primary = sorted[0];
    const box = primary.boundingBox;
    return {
      boundingBox: box,
      center: {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      },
      focalPoint: {
        x: box.x + box.width / 2,
        y: box.y + box.height * 0.35,
      },
      confidence: primary.confidence,
      source: "DETECTION",
    };
  }

  // 4. Default: No salient subject detected, point to frame center
  const defaultBox: BoundingBox = {
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.5,
  };

  const centerPoint: Point2D = { x: 0.5, y: 0.5 };

  return {
    boundingBox: defaultBox,
    center: centerPoint,
    focalPoint: centerPoint,
    confidence: 0,
    source: "FRAME_CENTER",
  };
}
