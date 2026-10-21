# @framesense/core

Domain contracts for the FrameSense AI runtime pipeline:

```text
Camera -> Perception -> Composition -> Guidance -> Feedback -> Capture
```

These contracts define the data passed between future modules. They do not implement camera access,
computer vision, composition rules, feedback delivery, capture decisions, diagnostics collection, or
model inference.

## Coordinate Convention

All `Point2D` and `BoundingBox` values use normalized coordinates:

- origin is the top-left of the frame
- `x` increases toward the right
- `y` increases toward the bottom
- valid normalized range is `0..1`
- `(0, 0)` is top-left
- `(0.5, 0.5)` is center
- `(1, 1)` is bottom-right

## Angle Units

Horizon angles use degrees. Positive and negative angle interpretation belongs to the future
horizon adapter and composition logic, not these contracts.

## Contract Responsibilities

- `CameraFrame` represents a source frame with an implementation-independent payload reference.
- `PerceptionResult` aggregates detections, faces, poses, horizon, and scene context.
- `CompositionContext` is the typed input boundary for future composition analysis.
- `CompositionResult` represents future composition measurements and issues.
- `GuidanceResult` describes future user-facing guidance without coupling to UI rendering.
- `FeedbackCommand` describes feedback intent without using browser speech or vibration APIs.
- `CaptureDecision` represents future capture readiness.
- `DiagnosticSample` represents future performance telemetry.

The package intentionally avoids React, DOM, browser media APIs, MediaPipe, ONNX Runtime, OpenCV,
WebGPU, and other model-library types so domain logic can remain stable across implementations.
