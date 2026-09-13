# Claude Plugins by svallory

A Claude Code plugin marketplace.

## Installation

```
/plugin marketplace add svallory/claude-plugins
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| **ghostwriter** | Adversarial AI text detection and humanization system. Detects AI-generated text and iteratively revises it to read as authentically human. |
| **demo-video** | Narrated, subtitled MP4 demos of web-app features: Playwright recording with animated cursor, ffmpeg assembly paced by TTS narration, title cards and outro. |

### Ghostwriter

```
/plugin install ghostwriter
```

Then run `/setup` to configure your author profile and first publication.

See [ghostwriter README](plugins/ghostwriter/README.md) for full documentation.

### Demo Video

```
/plugin install demo-video
```

Ask for a "demo video" or "feature walkthrough video" of a web-app feature. The skill installs the pipeline into the project on first use (`scripts/demo/`, `e2e/demo/`), writes `.claude/demo-video-skill.config.json`, then records, narrates and builds the MP4.

Requires ffmpeg, Playwright, and either `GEMINI_API_KEY` (gemini-tts) or the offline `qwen3-tts-mlx` engine.

See [demo-video README](plugins/demo-video/README.md) for config schema, commands, and troubleshooting.
