# FrameSense AI Engineering Rules

These rules apply to all future work in this repository.

1. Do not bypass architectural layers.
2. Keep UI separate from business and domain logic.
3. Keep model adapters separate from domain logic.
4. Expensive inference must not block the browser main thread.
5. Avoid hardcoded configurable thresholds.
6. Use strict TypeScript.
7. Prefer deterministic algorithms when AI is unnecessary.
8. Do not invent performance or accuracy claims.
9. Add tests for non-trivial logic.
10. Avoid unrelated refactors.
11. Do not implement future tasks automatically.
12. Do not add dependencies without justification.
13. Keep APIs between modules typed and explicit.
14. Preserve existing working behavior.
15. Stop when the requested task is complete.
