# Demo Video

Narrated, subtitled MP4 demos of web-app features. Playwright records the browser with an animated cursor and click ripples; ffmpeg assembles the takes into clips paced by TTS narration, with burned-in subtitles, optional title cards, and an optional outro slate. Several demos can be merged into one "what's new" video with a single intro.

## Install

```
/plugin marketplace add svallory/tutor
/plugin install demo-video@tutor
```

Or as a standalone skill via the [skills CLI](https://skills.sh):

```
npx skills add svallory/tutor --skill demo-video
```

## Requirements

| Need | Notes |
|---|---|
| Node-ecosystem project | Any package manager. TypeScript runner: `tsx`, `ts-node`, or `bun`. |
| `@playwright/test` | Installed as a devDependency if absent. Also used by the build scripts to render cards. |
| `ffmpeg` and `ffprobe` | On PATH — `brew install ffmpeg`. |
| `curl` | Used for the Gemini TTS call. |
| Narration engine | `gemini-tts` needs `GEMINI_API_KEY` in the shell; `qwen3-tts-mlx` is offline, needs `uv`, and downloads ~2 GB on first run (Apple Silicon). |
| Dev server | Must already be running at `baseURL`. **The pipeline never starts it.** |

There's deliberately no default for `GEMINI_API_KEY` — the build fails loudly rather than silently producing a silent video.

## Usage

With the dev server running, ask for a demo:

> Record a demo video of the invoice export feature

Also triggers on "demo video", "feature walkthrough video", "what's new video", and "merge the demos into one video".

What happens:

1. **Config.** The skill looks for `.claude/demo-video-skill.config.json`. If it's missing, it offers quick defaults or a guided setup, writes the file, and asks whether to commit it or gitignore it. If it exists, it is used as-is and you aren't asked again.
2. **Install.** If `scripts/demo/` is missing, the pipeline is copied into the project (`scripts/demo/`, `e2e/demo/`), the login seam is adapted, `video:doctor|build|merge` are registered in `package.json`, and the doctor runs.
3. **Script.** A demo script is written to `e2e/demos/<slug>.demo.ts` — a list of takes, each one narration sentence plus one Playwright action — after reading the app's real templates for selectors.
4. **Build.** `video:build -- <slug>` records, synthesizes narration, and assembles the MP4 plus a poster PNG into `assetsDir`.
5. **Verify.** Frames get extracted at cue boundaries and the result watched before it's called done. A green build is not a good video.

## Commands

Registered in `package.json` at install. With npm or pnpm, pass args after `--`; with bun, omit it.

```
video:doctor                                   # verify ffmpeg, TTS engine, API key
video:build -- <slug>                          # record + narrate + assemble
video:build -- <slug> --no-record              # reuse the recording, redo narration/assembly
video:merge -- <slugA> <slugB> --out <slug>    # combine recorded demos into one video
```

TTS output is cached under `scripts/demo/.cache/`, keyed by engine, voice, and text. Delete it to force resynthesis.

## Demo script format

```typescript
import { expect } from '@playwright/test';
import { defineDemo } from '../demo/define';

export default defineDemo({
  feature: 'Invoice export',     // title card + slate narration text
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

### Rules for writing takes

- **One take is one visual beat and one spoken sentence** — about 15 words, present tense, describing what the viewer sees. "Navigate AND open AND fill AND save" must be split.
- **Write the narration first.** The subtitle pill wraps at roughly 42 characters per line, two lines maximum.
- **Real `expect()` calls in every take**, so a broken feature fails the recording instead of quietly filming the wrong thing.
- **Use `glideTo`, `glideClick`, and `smoothScrollBy`** from `e2e/demo/actions.ts`. A raw `.click()` teleports the cursor.
- **Pacing** — the first take dwells ~800 ms before acting, middle takes end with 600–900 ms, and the last take ends with ~4500 ms so the final subtitle clears.
- **Selectors** are semantic (`getByRole`, stable classes), never framework binding attributes. Read the real templates first — custom-element hosts often have no box, so `toBeVisible()` lies; assert on an inner element instead.
- **Login lives in `e2e/demo/login.ts`** and runs outside the recorded context.
- **Never put the brand line in a take's narration** — the opening slate owns it.

## Configuration

`.claude/demo-video-skill.config.json`, read on every run. Missing keys fall back to built-in defaults. Never edit `config.ts` for per-project choices.

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

| Key | Meaning | Default |
|---|---|---|
| `branding.productName` | Used on title cards and in generated slate narration | `the app` |
| `branding.introPhrase` | Spoken on the opening slate | `What's new in the app` |
| `branding.openingKicker` | Small label above the feature name on the first title card | `WHAT'S NEW` |
| `branding.intermediaryKicker` | Kicker for title cards between features in a merged video | `ALSO IN THIS RELEASE` |
| `branding.accentColor` | Title-card rule, kicker, and click ripples | `#f36f21` |
| `branding.outroLogoSvg` | Repo-relative SVG for the outro slate; fills are forced white on black | `null` |
| `branding.outroText` | Plain-text outro when there's no SVG | `null` |
| `features.narration` | Synthesize and pace by speech | `true` |
| `features.subtitles` | Burn in the subtitle pill | `true` |
| `features.titleCards` | Render feature title cards | `true` |
| `features.outro` | Append the outro slate | `false` |
| `features.cursorOverlay` | Draw the animated cursor and ripples | `true` |
| `ttsEngine` | `gemini-tts` or `qwen3-tts-mlx` | `gemini-tts` |
| `voice` | TTS voice | `Autonoe` |
| `geminiModel` | Gemini TTS model | `gemini-3.1-flash-tts-preview` |
| `assetsDir` | Where `<slug>.mp4` and `<slug>.png` land | `assets/demo-videos` |
| `sizeBudgetMb` | Build fails when the MP4 exceeds it | `5` |
| `baseURL` | Dev server the recording runs against | `http://localhost:5173` |
| `packageRunner` | `npx`, `bunx`, or `pnpm exec` | `npx` |
| `slowdownFactor` | Slows the whole recording in post, timings scaled to match. 1 = real time | `1` |
| `titleCardSeconds.min` | Minimum title-card duration | `3` |
| `outro.seconds`, `outro.fadeSec` | Outro length and fade | `3`, `0.8` |

Turning `features.outro` on while both `outroLogoSvg` and `outroText` are null fails the build.

> The `geminiModel` value is a preview model name and will eventually stop resolving. If TTS reports "model not found", update this key.

## How the pipeline works

**Recording.** `video:build` shells out to Playwright with `DEMO=<slug>`, producing exactly two artifacts: `demo-output/<slug>/raw.webm` and `takes.json` with per-take timings. The browser records at 1280×720, and login happens outside the recorded context.

**The animated cursor.** Playwright videos don't capture the OS cursor, so the pipeline injects one. The visual cursor is deliberately *not* driven by real mouse events — Playwright dispatches those in coarse steps that stutter on video. Instead the page animates it with a CSS transition at full frame rate, and the real mouse teleports invisibly afterwards so hover and click behavior stay truthful.

**Assembly.** The recording is converted (and optionally slowed), then split per take. Each take's narration is synthesized, and whichever of audio or video is shorter gets padded so the two stay in sync. The build **fails hard** rather than shipping a desynced video if the recording is shorter than the take timings imply.

**Subtitles.** This ffmpeg build has no libass, and timeline gating proved unreliable, so the subtitle window is made physical: the clip is cut at the narration end, the pill PNG is overlaid onto the first piece only, and the pieces are rejoined. A `subs.srt` is still written as an inspectable timing artifact.

**Finalize.** Clips are concatenated, the outro faded in if enabled, the poster frame extracted, and the size budget checked **before** anything is copied into `assetsDir` — an over-budget build leaves the file in the work directory and touches nothing.

## Merging demos

```
video:merge -- <slugA> <slugB> --out whats-new
```

Order is taken verbatim — never sorted or deduplicated, because which feature plays first is an editorial decision. `--out` is required, and it can't collide with a source slug.

The first segment gets the opening narration (`"<introPhrase>: <feature>."`); later segments get a transition (`"Next up: <feature>."`, then "Then:", then "Also:"). The build asserts that exactly one slate carries the intro phrase and that it comes first.

Each source demo must be recorded before merging, and each should stand alone without re-orienting the viewer.

## Before every recording

- Dev server up at `baseURL`.
- Clean, seeded database — leftover rows appear on video.
- Reset any "new" or "unseen" badges the demo depends on.
- Nothing else on the dev server port.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Doctor fails on `GEMINI_API_KEY` | Export it in the shell. Never commit it. |
| TTS model not found | Update `geminiModel` in the config. |
| "TTS split X into multiple audio segments" | Shorten that narration line, rebuild with `--no-record`. |
| Over size budget | Fewer takes, shorter narration, or raise `sizeBudgetMb`. |
| Blank footage | The dev server wasn't running at `baseURL`. |
| `EADDRINUSE` | Kill the other process on the port. |
| Desync error on build | The recording is shorter than the takes imply — re-record. |

## See also

- [Plugin overview](/docs/) — the rest of the marketplace.
