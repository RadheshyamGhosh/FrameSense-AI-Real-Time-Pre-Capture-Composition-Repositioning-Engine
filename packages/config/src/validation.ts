import type {
  CompositionConfig,
  ConfigValidationIssue,
  FrameSenseConfig,
  GuidanceConfig,
  InferenceConfig,
  PerformanceConfig,
} from "./types.js";

type UnknownRecord = Readonly<Record<string, unknown>>;

export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigValidationIssue[];

  constructor(issues: readonly ConfigValidationIssue[]) {
    super(formatIssues(issues));
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

export function validateFrameSenseConfig(input: unknown): FrameSenseConfig {
  const issues: ConfigValidationIssue[] = [];
  const root = readRecord(input, "config", issues);

  const config: FrameSenseConfig = {
    composition: readCompositionConfig(root.composition, "composition", issues),
    inference: readInferenceConfig(root.inference, "inference", issues),
    guidance: readGuidanceConfig(root.guidance, "guidance", issues),
    performance: readPerformanceConfig(root.performance, "performance", issues),
  };

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return config;
}

export function validateCompositionConfig(input: unknown): CompositionConfig {
  const issues: ConfigValidationIssue[] = [];
  const config = readCompositionConfig(input, "composition", issues);
  throwIfInvalid(issues);
  return config;
}

export function validateInferenceConfig(input: unknown): InferenceConfig {
  const issues: ConfigValidationIssue[] = [];
  const config = readInferenceConfig(input, "inference", issues);
  throwIfInvalid(issues);
  return config;
}

export function validateGuidanceConfig(input: unknown): GuidanceConfig {
  const issues: ConfigValidationIssue[] = [];
  const config = readGuidanceConfig(input, "guidance", issues);
  throwIfInvalid(issues);
  return config;
}

export function validatePerformanceConfig(input: unknown): PerformanceConfig {
  const issues: ConfigValidationIssue[] = [];
  const config = readPerformanceConfig(input, "performance", issues);
  throwIfInvalid(issues);
  return config;
}

function readCompositionConfig(
  input: unknown,
  path: string,
  issues: ConfigValidationIssue[],
): CompositionConfig {
  const record = readRecord(input, path, issues);
  return {
    minimumAcceptableScore: readScore(record, "minimumAcceptableScore", path, issues),
    excellentScore: readScore(record, "excellentScore", path, issues),
    ruleOfThirdsTolerance: readRatio(record, "ruleOfThirdsTolerance", path, issues),
    minimumHeadroomRatio: readRatio(record, "minimumHeadroomRatio", path, issues),
    minimumSubjectSizeRatio: readRatio(record, "minimumSubjectSizeRatio", path, issues),
    maximumSubjectSizeRatio: readRatio(record, "maximumSubjectSizeRatio", path, issues),
    maximumHorizonAngleDegrees: readHorizonAngle(
      record,
      "maximumHorizonAngleDegrees",
      path,
      issues,
    ),
    minimumConfidence: readRatio(record, "minimumConfidence", path, issues),
  };
}

function readInferenceConfig(
  input: unknown,
  path: string,
  issues: ConfigValidationIssue[],
): InferenceConfig {
  const record = readRecord(input, path, issues);
  return {
    targetInferenceFps: readNonNegativeNumber(record, "targetInferenceFps", path, issues),
    minimumInferenceIntervalMs: readNonNegativeNumber(
      record,
      "minimumInferenceIntervalMs",
      path,
      issues,
    ),
    modelConfidenceThreshold: readRatio(record, "modelConfidenceThreshold", path, issues),
    maximumProcessingWidth: readPositiveInteger(record, "maximumProcessingWidth", path, issues),
    maximumProcessingHeight: readPositiveInteger(record, "maximumProcessingHeight", path, issues),
    inferenceEnabled: readBoolean(record, "inferenceEnabled", path, issues),
  };
}

function readGuidanceConfig(
  input: unknown,
  path: string,
  issues: ConfigValidationIssue[],
): GuidanceConfig {
  const record = readRecord(input, path, issues);
  return {
    minimumGuidanceConfidence: readRatio(record, "minimumGuidanceConfidence", path, issues),
    guidanceCooldownMs: readNonNegativeNumber(record, "guidanceCooldownMs", path, issues),
    recommendationPersistenceMs: readNonNegativeNumber(
      record,
      "recommendationPersistenceMs",
      path,
      issues,
    ),
    stabilityDurationMs: readNonNegativeNumber(record, "stabilityDurationMs", path, issues),
    maximumRepeatedAnnouncements: readNonNegativeInteger(
      record,
      "maximumRepeatedAnnouncements",
      path,
      issues,
    ),
  };
}

function readPerformanceConfig(
  input: unknown,
  path: string,
  issues: ConfigValidationIssue[],
): PerformanceConfig {
  const record = readRecord(input, path, issues);
  return {
    targetCameraFps: readNonNegativeNumber(record, "targetCameraFps", path, issues),
    targetProcessingFps: readNonNegativeNumber(record, "targetProcessingFps", path, issues),
    targetInferenceLatencyMs: readNonNegativeNumber(
      record,
      "targetInferenceLatencyMs",
      path,
      issues,
    ),
    targetEndToEndLatencyMs: readNonNegativeNumber(record, "targetEndToEndLatencyMs", path, issues),
    diagnosticsSamplingIntervalMs: readNonNegativeNumber(
      record,
      "diagnosticsSamplingIntervalMs",
      path,
      issues,
    ),
  };
}

function readRecord(input: unknown, path: string, issues: ConfigValidationIssue[]): UnknownRecord {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as UnknownRecord;
  }

  issues.push({ path, message: "Expected an object." });
  return {};
}

function readScore(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  return readBoundedNumber(record, key, path, 0, 100, "Expected a score from 0 to 100.", issues);
}

function readRatio(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  return readBoundedNumber(record, key, path, 0, 1, "Expected a ratio from 0 to 1.", issues);
}

function readHorizonAngle(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  return readBoundedNumber(
    record,
    key,
    path,
    0,
    180,
    "Expected a horizon angle from 0 to 180 degrees.",
    issues,
  );
}

function readNonNegativeNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  const value = readNumber(record, key, path, issues);
  if (value < 0) {
    issues.push({ path: `${path}.${key}`, message: "Expected a non-negative number." });
  }
  return value;
}

function readPositiveInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  const value = readNumber(record, key, path, issues);
  if (!Number.isInteger(value) || value <= 0) {
    issues.push({ path: `${path}.${key}`, message: "Expected a positive integer." });
  }
  return value;
}

function readNonNegativeInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  const value = readNumber(record, key, path, issues);
  if (!Number.isInteger(value) || value < 0) {
    issues.push({ path: `${path}.${key}`, message: "Expected a non-negative integer." });
  }
  return value;
}

function readBoundedNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  minimum: number,
  maximum: number,
  message: string,
  issues: ConfigValidationIssue[],
): number {
  const value = readNumber(record, key, path, issues);
  if (value < minimum || value > maximum) {
    issues.push({ path: `${path}.${key}`, message });
  }
  return value;
}

function readNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): number {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  issues.push({ path: `${path}.${key}`, message: "Expected a finite number." });
  return Number.NaN;
}

function readBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ConfigValidationIssue[],
): boolean {
  const value = record[key];
  if (typeof value === "boolean") {
    return value;
  }

  issues.push({ path: `${path}.${key}`, message: "Expected a boolean." });
  return false;
}

function throwIfInvalid(issues: readonly ConfigValidationIssue[]): void {
  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }
}

function formatIssues(issues: readonly ConfigValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
}
