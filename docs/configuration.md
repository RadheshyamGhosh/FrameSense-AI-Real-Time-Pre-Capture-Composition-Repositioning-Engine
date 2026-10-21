# Configuration

FrameSense AI uses local static JSON configuration files as the source of truth for runtime tuning
values. JSON is used instead of YAML to avoid adding a parser dependency.

## Locations

```text
configs/
  composition/default.json
  inference/default.json
  guidance/default.json
  performance/default.json
```

Future modules should consume configuration through `@framesense/config` rather than reading files
directly.

## Categories

- Composition: score thresholds, normalized tolerances and ratios, horizon angle tolerance, and
  minimum confidence.
- Inference: target inference FPS, minimum inference interval, model confidence threshold,
  processing dimensions, and inference enablement.
- Guidance: minimum guidance confidence, cooldown, persistence, stability duration, and repeated
  announcement limit.
- Performance: engineering targets for camera FPS, processing FPS, inference latency, end-to-end
  latency, and diagnostics sampling interval.

Initial values are tuning defaults only. They have not been empirically validated.

## Units

- Scores use a `0..100` scale.
- Ratios use normalized `0..1` values.
- Horizon angles use degrees.
- Durations and latencies use milliseconds.
- Target FPS values are configuration targets, not measured FPS.

Performance configuration values are targets, not measured results. Benchmark and diagnostic output
must be recorded separately from these defaults.

## Validation

`@framesense/config` validates loaded configuration before returning it. Validation rejects:

- scores outside `0..100`
- ratios outside `0..1`
- negative FPS values
- negative duration or latency values
- non-positive processing dimensions
- horizon angle limits outside `0..180` degrees
- missing or incorrectly typed required values

Validation failures throw `ConfigValidationError` with path-specific issues.

## Adding a Setting

1. Add the setting to exactly one file under `configs/<category>/default.json`.
2. Add the matching TypeScript field in `@framesense/config`.
3. Add explicit validation for its unit and allowed range.
4. Add or update focused tests for valid and invalid values.
5. Update this document if the setting introduces a new convention or unit.
