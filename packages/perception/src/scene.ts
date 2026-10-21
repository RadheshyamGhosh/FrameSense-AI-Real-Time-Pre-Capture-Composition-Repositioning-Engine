import type {
  Detection,
  FaceResult,
  HorizonResult,
  SceneResult,
  SceneType,
} from "@framesense/core";

export interface SceneClassificationInput {
  readonly faces?: readonly FaceResult[];
  readonly detections?: readonly Detection[];
  readonly horizon?: HorizonResult;
}

const FOOD_KEYWORDS = ["food", "dish", "plate", "bowl", "pizza", "sandwich", "fruit", "drink", "cup"];
const ARCH_KEYWORDS = ["building", "architecture", "house", "window", "door", "bridge", "monument"];

/**
 * Deterministically classifies the scene category from detected entities.
 */
export function classifyScene(input: SceneClassificationInput): SceneResult {
  const faces = input.faces ?? [];
  const detections = input.detections ?? [];
  const horizon = input.horizon;

  // 1. Group portrait: 2 or more faces
  if (faces.length >= 2) {
    return {
      type: "GROUP",
      confidence: 0.95,
    };
  }

  // 2. Solo portrait: exactly 1 face
  if (faces.length === 1) {
    return {
      type: "PORTRAIT",
      confidence: 0.95,
    };
  }

  // 3. Pose or person detection without clear face
  const hasPerson = detections.some((d) => d.category.toLowerCase().includes("person"));
  if (hasPerson) {
    return {
      type: "PORTRAIT",
      confidence: 0.8,
    };
  }

  // 4. Food detection
  const hasFood = detections.some((d) =>
    FOOD_KEYWORDS.some((kw) => d.category.toLowerCase().includes(kw)),
  );
  if (hasFood) {
    return {
      type: "FOOD",
      confidence: 0.88,
    };
  }

  // 5. Architecture detection
  const hasArch = detections.some((d) =>
    ARCH_KEYWORDS.some((kw) => d.category.toLowerCase().includes(kw)),
  );
  if (hasArch) {
    return {
      type: "ARCHITECTURE",
      confidence: 0.85,
    };
  }

  // 6. Landscape: no people, prominent horizon line detected
  if (horizon && horizon.detected && horizon.confidence >= 0.6) {
    return {
      type: "LANDSCAPE",
      confidence: 0.85,
    };
  }

  return {
    type: "UNKNOWN" as SceneType,
    confidence: 0.5,
  };
}
