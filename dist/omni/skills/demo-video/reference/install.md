# Installing the demo-video pipeline into a project

One-time setup per project. The pipeline is TypeScript + Playwright + ffmpeg; it assumes a Node-ecosystem project with Playwright available (install `@playwright/test` as a devDependency if absent).

## 1. Copy the templates

From this skill's `templates/` directory into the project root:

```
templates/scripts/demo/*        -> scripts/demo/
templates/e2e/demo/*            -> e2e/demo/        (except login.example.ts)
templates/e2e/demo/login.example.ts -> e2e/demo/login.ts  (then ADAPT it)
```

Create `e2e/demos/` for the per-feature demo specs.

If the project already uses different directories for e2e tests, keep the `scripts/demo` <-> `e2e/demo` relative layout intact or fix the relative imports (`assemble.ts` and `runner.spec.ts` cross-import).

## 2. Write the project config

If the skill workflow hasn't already written it, write the user's chosen options to `.agents/demo-video-skill.config.json` (schema + example: `templates/demo-video-skill.config.example.json`). `scripts/demo/config.ts` reads it at startup — cwd-relative, so always run pipeline scripts from the repo root; missing keys fall back to defaults in that file. Do NOT edit config.ts for per-project choices.

`geminiModel` names a preview model that will eventually rot; if TTS fails with a model-not-found error, check the current Gemini TTS model name and update the JSON.

- `outroLogoSvg`: repo-relative path to an SVG whose `<path>` fills will be forced white on black. Or use `outroText`. `features.outro: true` with both null fails the build.
- `assetsDir`: where final `<slug>.mp4` + `<slug>.png` land. Pick somewhere the app can serve (or a `demos/` folder if videos are not shipped in-app).
- `baseURL`: the dev server the recording runs against.

## 3. Adapt the login seam

Edit `e2e/demo/login.ts`: log in against the real login form with test credentials and return `storageState`, or return `undefined` if the app has no auth. Login runs outside the recorded context so it never appears on video.

## 4. Register scripts

Add to `package.json` (adapt runner to the project's TS setup — ts-node, tsx, or bun):

```json
"video:doctor": "tsx scripts/demo/doctor.ts",
"video:build": "tsx scripts/demo/build.ts",
"video:merge": "tsx scripts/demo/merge-build.ts"
```

If the project uses ts-node with a custom tsconfig: `TS_NODE_PROJECT=<tsconfig> node -r ts-node/register scripts/demo/build.ts`. With bun, `bun scripts/demo/build.ts` works directly.

`recordDemo` shells out to `<packageRunner> playwright test e2e/demo/runner.spec.ts` — set `packageRunner` in the JSON config (`"bunx"` for bun, `"pnpm exec"` for pnpm); never edit assemble.ts for this.

Argument passing: with npm, `npm run video:build -- <slug>`; with bun, `bun run video:build <slug>` (no `--`; bun may pass a literal `--` through as an argument — build.ts tolerates it but don't rely on that).

## 4b. Playwright config

Ensure a Playwright config exists and picks up `e2e/demo/runner.spec.ts`. A fresh project may have none; minimal:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173' } // match the JSON config's baseURL
});
```

Viewport and video recording are set by the runner itself; the config only needs to find the spec.

## 5. External tools

- `ffmpeg`/`ffprobe` on PATH (`brew install ffmpeg`).
- Narration on + `gemini-tts`: `GEMINI_API_KEY` in the shell. Never commit it; the build fails loudly without it.
- Narration on + `qwen3-tts-mlx` (offline): `brew install uv`; first run downloads ~2 GB of model weights.

## 6. Verify

```
<pkg-runner> video:doctor
```

Fix every FAIL, then smoke-test with a trivial one-take demo spec before writing the real one.

## Before every recording

- **Start the dev server** at the config's `baseURL` — the pipeline never starts it for you; recording against a dead port produces blank footage.
- If the app has a database: record against a clean, seeded one — rows left over from earlier sessions WILL appear in the video.
- Reset any "unseen/new" badges or state the demo relies on.
- Kill anything else holding the dev server port.

## Troubleshooting

- **"TTS split X into multiple audio segments"** (offline engine): shorten that narration line, rebuild with `--no-record`.
- **Over the size budget**: fewer takes, shorter narration, or raise `sizeBudgetMb` if the target allows.
- **Changed a narration line only**: `video:build -- <slug> --no-record` reuses the recording; TTS wavs are cached by (engine, voice, text).
- **Clear TTS cache**: `rm -rf scripts/demo/.cache/`.
- **`EADDRINUSE`**: another dev server holds the port; kill it.
