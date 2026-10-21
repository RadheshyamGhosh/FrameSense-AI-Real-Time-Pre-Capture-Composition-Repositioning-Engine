# Changelog

All notable changes to FrameSense AI will be documented in this file.

## [0.1.0] - 2026-10-09

### Added

#### Part 1: Core Composition Engine (`@framesense/composition`)
- Geometric Rule of Thirds evaluation with nearest intersection identification and normalization.
- Headroom, subject size, horizon tilt, and horizontal/vertical symmetry evaluation algorithms.
- Scene-adaptive weighting profiles for `PORTRAIT`, `GROUP`, `LANDSCAPE`, `ARCHITECTURE`, `FOOD`, and `UNKNOWN`.
- Comprehensive unit test coverage for composition calculations.

#### Part 2: Dynamic Guidance & Auto-Shutter State Machine (`@framesense/guidance`)
- Threshold-driven guidance resolver mapping metric defects to human-actionable direction cues (`TILT_UP`, `TILT_DOWN`, `ROTATE_LEFT`, `ROTATE_RIGHT`, `STEP_BACK`, `STEP_FORWARD`, `MOVE_LEFT`, `MOVE_RIGHT`, `LEVEL_HORIZON`, `HOLD_STEADY`).
- Stability tracker monitoring framing score and position drift over a configurable hold window ($750\text{ ms}$).
- Dynamic guidance engine with anti-flicker hysteresis, issue persistence windows, and repetition capping.
- Unit test suite verifying edge transitions, hysteresis thresholds, and auto-shutter capture readiness.

#### Part 3: Camera Ingestion & Worker Bridge (`@framesense/camera`)
- `CameraManager` providing resilient `navigator.mediaDevices.getUserMedia` handling, camera switching, and fallback handling.
- `FrameSampler` providing aspect-ratio preserving downsampling to $640\times360$ at 15 FPS.
- `SyntheticCameraSource` generating deterministic test feeds with 9 configurable scenario presets for offline development.
- `PipelineWorkerBridge` managing zero-copy `ImageBitmap` frame transfers to Web Workers with frame skipping when worker is busy.
- Unit test suite validating frame pacing, synthetic generation, and bridge messaging.

#### Part 4: On-Device Perception & Vision Adapters (`@framesense/perception`)
- Deterministic horizon gradient line estimator (`detectHorizonFromPixels`) with scanline contrast filtering and linear regression ($y = mx + c$).
- Rule-based scene classifier supporting multi-class composition routing.
- `MockPerceptionAdapter` simulating face and subject detections for all 9 preset scenarios.
- Integrated `PipelineProcessor` connecting perception, composition, guidance, and capture into a unified pipeline.
- Unit test suite for horizon detection, scene classification, and end-to-end processing.

#### Part 5: Multimodal Feedback & Telemetry Diagnostics (`@framesense/feedback`)
- `VoiceAnnouncer` supporting Web Speech API with speech queue throttling and priority preemption.
- `HapticController` implementing vibration patterns for guidance feedback, stability confirmation, and shutter clicks.
- `FeedbackDispatcher` coordinating concurrent audio and haptic events based on guidance state transitions.
- `DiagnosticsCollector` tracking rolling camera FPS, pipeline processing FPS, latency metrics, and performance SLA compliance.
- Unit test suite for feedback dispatching and telemetry compliance.

#### Part 6: AR Viewfinder UI & Capture Workflow (`@framesense/web`)
- Vite-bundled Web Worker (`pipeline.worker.ts`) handling pipeline execution off the main thread.
- `useCameraPipeline` React hook managing camera lifecycle, worker bridge, and capture logic.
- AR Viewfinder canvas component rendering Rule of Thirds grid, golden intersections, headroom bracket, and tilting artificial horizon level bar.
- Guidance HUD with dynamic status pill, real-time score gauge, and direction vectors.
- Camera controls with circular SVG stability countdown ring, auto-shutter toggle, and camera device selector.
- Post-capture review modal displaying photo capture, framing breakdown, and download capability.
- Floating Diagnostics overlay and configuration Settings modal.
- Modern camera viewfinder dark mode theme with glassmorphic accents.

#### Part 7: Benchmarks & Quality Verification
- Benchmark suite (`benchmarks/pipeline.benchmark.mjs`) validating latency (P50, P95, P99) and throughput.
- Verified sub-millisecond inference and end-to-end pipeline latency meeting all performance targets.
- 100% pass rate across 45 unit tests, strict TypeScript checks, ESLint verification, and production build packaging.
