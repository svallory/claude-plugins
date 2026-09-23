---
name: demo-video
description: Use when the user wants a narrated demo/walkthrough video of a web app feature — "record a demo", "demo video", "feature walkthrough video", "what's new video" — or wants the demo-video pipeline installed, a demo script written, or several demos merged into one video.
---

# Demo Video

## Overview

Produce narrated, subtitled MP4 demos of web-app features: a Playwright script records the browser with an animated cursor, ffmpeg assembles takes into clips paced by TTS narration, with optional title cards, subtitles, and an outro slate. `templates/` holds the complete pipeline, ready to copy into any Node-ecosystem project.

## Workflow

1. **Read project options.** Check `.claude/demo-video-skill.config.json` at the target project root.
   - Exists → use it; do NOT re-ask the questions below.
   - Missing → first ask: **quick defaults or customize?** Quick = narration on (gemini-tts), subtitles on, title cards on with the product's name, no outro, cursor on — only confirm product name, base URL (Vite 5173 / Angular 4200 / etc.), and package runner. Customize = ask grouped (AskUserQuestion):
     - Voice narration? If yes: engine (`gemini-tts`, needs `GEMINI_API_KEY`; or `qwen3-tts-mlx`, offline, ~2 GB first download) and voice.
     - Burned-in subtitles?
     - Title cards? If yes: product name, intro phrase, kicker (the small label line printed above the feature name on the card), accent color.
     - Outro slate? If yes: SVG logo path or plain text.
     - Cursor overlay + click ripples? Output dir, size budget (default 5 MB), dev-server base URL, package runner (`npx`/`bunx`/`pnpm exec`).
   - Then ask: **remember these for this project?** Either way, write the config file (schema: `templates/demo-video-skill.config.example.json`) — the pipeline reads it at every run, so it must exist. Yes → offer to commit it. No → add it to `.gitignore` and tell the user it stays local.

2. **Install if absent.** No `scripts/demo/` in the project → follow `reference/install.md` (copy templates, adapt `e2e/demo/login.ts`, register `video:doctor|build|merge` scripts and a Playwright config for the project's package manager, run doctor).

3. **Write the demo script** at `e2e/demos/<slug>.demo.ts` following `reference/script-writing.md` — take scoping, narration-first, motion/dwell rules. Read the app's actual templates before writing selectors.

4. **Record + build:** dev server running at the config's baseURL, clean seeded DB if the app has one, then `<pkg-runner> video:build -- <slug>` (bun: no `--`). Rebuild without re-recording via `--no-record` after narration-only edits.

5. **Verify like a viewer:** extract frames at cue boundaries and look at them, then watch the whole mp4. A green build ≠ a good video.

6. **Merging:** `video:merge -- <slugA> <slugB> --out <slug>` after each source is recorded. Read the printed narration plan before rendering.

## Quick reference

| Need | Where |
| --- | --- |
| Install / adapt to a project | `reference/install.md` |
| Take scoping, narration, selectors, dwell | `reference/script-writing.md` |
| Config schema | `templates/demo-video-skill.config.example.json` |
| Pipeline source | `templates/scripts/demo/`, `templates/e2e/demo/` |
| Per-project options | `.claude/demo-video-skill.config.json` in the project |

## Common mistakes

- Re-asking options a project config already answers.
- Editing `scripts/demo/config.ts` for per-project choices — the JSON config is the source of truth; config.ts values are fallbacks.
- Skipping `video:doctor` and hitting missing ffmpeg/API-key mid-build.
- Recording against a dirty database.
- Declaring the video done without watching it.
