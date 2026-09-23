# demo-video

Narrated, subtitled MP4 demos of web-app features, produced by Claude Code.

A Playwright script records the browser with an animated cursor and click ripples. ffmpeg assembles the takes into clips paced by TTS narration, adds burned-in subtitles, optional title cards, and an optional outro slate. Several demos can be merged into one "what's new" video with a single intro and outro.

## Install

```
/plugin marketplace add svallory/claude-plugins
/plugin install demo-video
```

## Requirements

| Need | Notes |
| --- | --- |
| Node-ecosystem project | Any package manager (npm, pnpm, bun). TypeScript runner: tsx, ts-node, or bun. |
| `@playwright/test` | Installed as a devDependency if absent. |
| `ffmpeg` / `ffprobe` | On PATH. `brew install ffmpeg`. |
| Narration (optional) | `gemini-tts`: `GEMINI_API_KEY` in the shell. `qwen3-tts-mlx`: offline, needs `uv`, ~2 GB model download on first run (Apple Silicon). |
| Dev server | Running at the configured `baseURL` before every recording. The pipeline never starts it. |

## Usage

With the dev server running, ask Claude Code:

> Record a demo video of the invoice export feature

Or: "demo video", "feature walkthrough video", "what's new video", "merge the demos into one video".

What happens:

1. **Config.** Claude looks for `.claude/demo-video-skill.config.json` in the project. If missing, it asks quick defaults or customize, writes the file, and offers to commit it or gitignore it.
2. **Install.** If `scripts/demo/` is missing, Claude copies the pipeline into the project (`scripts/demo/`, `e2e/demo/`), adapts the login seam, registers `video:doctor|build|merge` scripts, ensures a Playwright config, and runs the doctor.
3. **Script.** Claude writes `e2e/demos/<slug>.demo.ts`: a list of takes, each one narration sentence plus one Playwright action, after reading the app's real templates for selectors.
4. **Build.** `video:build -- <slug>` records, synthesizes narration, assembles the MP4 and a poster PNG into `assetsDir`.
5. **Verify.** Claude extracts frames at cue boundaries and watches the result before calling it done.

## Project config

`.claude/demo-video-skill.config.json`, read by `scripts/demo/config.ts` on every run. Missing keys fall back to defaults in `config.ts`. Never edit `config.ts` for per-project choices.

```json
{
  "branding": {
    "productName": "Acme Dashboard",
    "introPhrase": "What's new in Acme Dashboard",
    "openingKicker": "WHAT'S NEW IN ACME DASHBOARD",
    "intermediaryKicker": "ALSO IN THIS RELEASE",
    "accentColor": "#f36f21",
    "outroLogoSvg": null,
    "outroText": "Acme Inc."
  },
  "features": {
    "narration": true,
    "subtitles": true,
    "titleCards": true,
    "outro": true,
    "cursorOverlay": true
  },
  "ttsEngine": "gemini-tts",
  "voice": "Autonoe",
  "geminiModel": "gemini-3.1-flash-tts-preview",
  "assetsDir": "assets/demo-videos",
  "sizeBudgetMb": 5,
  "baseURL": "http://localhost:5173",
  "packageRunner": "npx",
  "slowdownFactor": 1,
  "titleCardSeconds": { "min": 3 },
  "outro": { "seconds": 3, "fadeSec": 0.8 }
}
```

| Key | Meaning |
| --- | --- |
| `branding.productName` | Used on title cards and in generated slate narration. |
| `branding.introPhrase` | Spoken on the opening slate. |
| `branding.openingKicker` | Small label above the feature name on the first title card. |
| `branding.intermediaryKicker` | Kicker for title cards between features in a merged video. |
| `branding.accentColor` | Title-card rule, kicker, and click ripples. |
| `branding.outroLogoSvg` | Repo-relative SVG for the outro slate. Fills forced white on black. |
| `branding.outroText` | Plain text outro when no SVG. Outro on with both null fails the build. |
| `features.*` | Toggle narration, subtitles, title cards, outro, cursor overlay. |
| `ttsEngine` | `gemini-tts` or `qwen3-tts-mlx`. |
| `voice`, `geminiModel` | TTS voice and Gemini model. The preview model name will rot; update if TTS reports model not found. |
| `assetsDir` | Where `<slug>.mp4` and `<slug>.png` land. |
| `sizeBudgetMb` | Build fails when the MP4 exceeds it. |
| `baseURL` | Dev server the recording runs against. |
| `packageRunner` | `npx`, `bunx`, or `pnpm exec`. Used to invoke Playwright. |
| `slowdownFactor` | Slows the whole recording in post (ffmpeg), timings scaled to match. 1 = real time. |
| `titleCardSeconds.min` | Minimum title-card duration. |
| `outro.seconds`, `outro.fadeSec` | Outro length and fade. |

## Commands

Registered in `package.json` during install. With npm/pnpm pass args after `--`; with bun omit it.

```
video:doctor                              # verify ffmpeg, TTS engine, API key
video:build -- <slug>                     # record + narrate + assemble
video:build -- <slug> --no-record         # reuse the recording, redo narration/assembly
video:merge -- <slugA> <slugB> --out <slug>   # combine recorded demos into one video
```

TTS output is cached by engine, voice, and text under `scripts/demo/.cache/`. Delete it to force resynthesis.

## Demo script shape

```typescript
import { expect } from '@playwright/test';
import { defineDemo } from '../demo/define';

export default defineDemo({
  feature: 'Invoice export',
  slug: 'invoice-export',
  takes: [
    {
      narration: 'The invoices page lists every open invoice.',
      action: async (page) => {
        await page.goto('/invoices');
        await expect(page.getByRole('table')).toBeVisible();
        await page.waitForTimeout(800);
      }
    }
  ]
});
```

Rules Claude follows, and you should too when editing by hand:

- One take is one visual beat and one spoken sentence, about 15 words, present tense, describing what the viewer sees.
- Real `expect()` calls in every take so a broken feature fails the recording.
- Use `glideTo`, `glideClick`, `smoothScrollBy` from `e2e/demo/actions.ts`. Raw `.click()` teleports the cursor.
- First take dwells ~800 ms before acting. Last take ends with ~4500 ms so the final subtitle clears.
- Login lives in `e2e/demo/login.ts` and runs outside the recorded context.
- Never put the brand line in a take's narration. The opening slate owns it.

## Before every recording

- Dev server up at `baseURL`.
- Clean, seeded database. Leftover rows appear on video.
- Reset "new/unseen" badges the demo depends on.
- Nothing else on the dev server port.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Doctor fails on `GEMINI_API_KEY` | Export it in the shell. Never commit it. |
| TTS model not found | Update `geminiModel` in the config. |
| "TTS split X into multiple audio segments" | Shorten that narration line, rebuild with `--no-record`. |
| Over size budget | Fewer takes, shorter narration, or raise `sizeBudgetMb`. |
| Blank footage | Dev server was not running at `baseURL`. |
| `EADDRINUSE` | Kill the other process on the port. |

## Layout

```
plugins/demo-video/
├── .claude-plugin/plugin.json
└── skills/demo-video/
    ├── SKILL.md                      # workflow Claude follows
    ├── reference/install.md          # per-project install steps
    ├── reference/script-writing.md   # take scoping, narration, selectors
    └── templates/                    # pipeline copied into projects
        ├── demo-video-skill.config.example.json
        ├── scripts/demo/             # build, merge, tts, ffmpeg, cards, doctor
        └── e2e/demo/                 # runner, cursor, actions, define, login.example
```
