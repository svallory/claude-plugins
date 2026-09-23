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
| **team-lead** | Dev team leader: decomposes a batch of tasks, assigns them to developer agents at the cheapest adequate model, reviews their work, and tracks progress. |
| **demo-video** | Narrated, subtitled MP4 demos of web-app features: Playwright recording with animated cursor, ffmpeg assembly paced by TTS narration, title cards and outro. |
| **okf** | Create, validate, and enrich Open Knowledge Format (OKF) bundles — knowledge as markdown files with YAML frontmatter, incl. v0.2 provenance, trust, and Attested Computations. |
| **hyper** | Hyper Coding workflow support: project spaces (a bare repo wrapping all of a project's worktrees), per-edit integration with a project's own linters/typecheckers, spec-driven planning, and template-driven generation. Sourced externally from [hyper-coding](https://github.com/svallory/hyper-coding). |

### Ghostwriter

```
/plugin install ghostwriter@svallory-plugins
```

Then run `/setup` to configure your author profile and first publication.

See [ghostwriter README](plugins/ghostwriter/README.md) for full documentation.

### Team Lead

```
/plugin install team-lead@svallory-plugins
```

Hand it a batch of tasks ("team-lead this sprint", "assign these tickets to devs"). Requires `git`, `gh`, `jq`, and [worktrunk](https://github.com/max-sixty/worktrunk); Herdr integration is optional.

See [team-lead README](plugins/team-lead/README.md) for the full dependency table and workflow.

### Demo Video

```
/plugin install demo-video@svallory-plugins
```

Ask for a "demo video" or "feature walkthrough video" of a web-app feature. The skill installs the pipeline into the project on first use (`scripts/demo/`, `e2e/demo/`), writes `.claude/demo-video-skill.config.json`, then records, narrates and builds the MP4.

Requires ffmpeg, Playwright, and either `GEMINI_API_KEY` (gemini-tts) or the offline `qwen3-tts-mlx` engine.

See [demo-video README](plugins/demo-video/README.md) for config schema, commands, and troubleshooting.

### OKF

```
/plugin install okf@svallory-plugins
```

Teaches the agent the [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format): create bundles, validate them (via [okflint](https://github.com/mattdav/okflint) or the bundled fallback script), enrich concepts with provenance and trust fields, migrate v0.1 → v0.2, and convert Notion/Obsidian/CSV sources.

See [okf README](plugins/okf/README.md) for contents and details.

## Individual skills via the skills CLI

The standalone skills are also installable with the [skills CLI](https://skills.sh) (works with Claude Code, Codex, Cursor, and others):

```
npx skills add svallory/claude-plugins
```

This lists `okf-open-knowledge-format`, `team-lead`, and `demo-video`. Ghostwriter's internal helper skills (`detector-red-flags`, `surgical-update`, `writer-examples`) are marked internal and hidden by default — they only make sense inside the ghostwriter plugin's agent pipeline.

The repo's [skills.sh](https://skills.sh/svallory/claude-plugins) page layout is configured in [skills.sh.json](skills.sh.json).

## For maintainers

Plugin metadata and platform-specific content are **compiled, not hand-edited**. Canonical sources:

- `plugins/<name>/plugin.yaml` — one per plugin (name, version, description, author, keywords, interface)
- `marketplace.yaml` — marketplace name/owner + externally sourced plugins (e.g. hyper)
- `build/platforms/<platform>.yaml` — per-platform variables (harness name, config dir, model tiers)
- Any `*.jig` file inside a plugin — a [Jig](https://jig.saulo.engineer) template rendered per platform (`{{ platform.configDir }}`, `{{ platform.models.fast }}`, `@if(platform.models) …`). The rendered sibling (`SKILL.md`, etc.) is committed — **never edit it directly**, edit the `.jig`.
- Manifest templates live in `build/templates/*.jig.edge` (Jig's disk loader requires the `.edge` extension).

After changing any of these:

```
bun install     # first time
bun run build
```

Outputs:

- `plugins/<name>/.claude-plugin/plugin.json` and `kimi.plugin.json` (co-located manifests)
- `.claude-plugin/marketplace.json` (Claude marketplace catalog)
- Rendered `*.jig` siblings in place — the Claude target is this repo itself
- `dist/kimi/` (gitignored): a self-contained Kimi tree with its own `marketplace.json` catalog, ready for zip/release distribution

CI runs `bun run build:check`, which fails if any committed generated file is stale.
