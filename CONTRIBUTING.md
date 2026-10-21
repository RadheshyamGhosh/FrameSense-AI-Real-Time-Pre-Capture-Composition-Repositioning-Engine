# Contributing

FrameSense AI is in its repository foundation stage. Contributions should keep changes focused,
small, and aligned with the project structure.

## Local Setup

```sh
npm install
npm run build
npm run lint
npm run test
```

## Guidelines

- Keep dependencies minimal and justified.
- Preserve strict TypeScript settings.
- Add tests when behavior is introduced.
- Do not commit generated build output or local environment files.
- Keep camera, AI, and composition logic out of foundation-only changes.

## Commit Hygiene

Use clear commit messages that describe the user-facing or engineering outcome. Separate unrelated
changes into separate commits.
