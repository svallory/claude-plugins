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

See [ghostwriter README](src/plugins/ghostwriter/README.md) for full documentation.

### Team Lead

```
/plugin install team-lead@svallory-plugins
```

Hand it a batch of tasks ("team-lead this sprint", "assign these tickets to devs"). Requires `git`, `gh`, `jq`, and [worktrunk](https://github.com/max-sixty/worktrunk); Herdr integration is optional.

See [team-lead README](src/plugins/team-lead/README.md) for the full dependency table and workflow.

### Demo Video

```
/plugin install demo-video@svallory-plugins
```

Ask for a "demo video" or "feature walkthrough video" of a web-app feature. The skill installs the pipeline into the project on first use (`scripts/demo/`, `e2e/demo/`), writes `.claude/demo-video-skill.config.json`, then records, narrates and builds the MP4.

Requires ffmpeg, Playwright, and either `GEMINI_API_KEY` (gemini-tts) or the offline `qwen3-tts-mlx` engine.

See [demo-video README](src/plugins/demo-video/README.md) for config schema, commands, and troubleshooting.

### OKF

```
/plugin install okf@svallory-plugins
```

Teaches the agent the [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format): create bundles, validate them (via [okflint](https://github.com/mattdav/okflint) or the bundled fallback script), enrich concepts with provenance and trust fields, migrate v0.1 → v0.2, and convert Notion/Obsidian/CSV sources.

See [okf README](src/plugins/okf/README.md) for contents and details.

## Individual skills via the skills CLI

The standalone skills are also installable with the [skills CLI](https://skills.sh) (works with Claude Code, Codex, Cursor, and others):

```
npx skills add svallory/claude-plugins
```

This lists `okf-open-knowledge-format`, `team-lead`, and `demo-video`. Ghostwriter's internal helper skills (`detector-red-flags`, `surgical-update`, `writer-examples`) are marked internal and hidden by default — they only make sense inside the ghostwriter plugin's agent pipeline.

The repo's [skills.sh](https://skills.sh/svallory/claude-plugins) page layout is configured in [skills.sh.json](skills.sh.json).

## For maintainers

Repo layout:

```
src/plugins/<name>/         # canonical sources: plugin.yaml, content, *.jig templates, README
build/                      # compile.ts, platforms/<id>.yaml, templates/*.jig.edge
dist/<platform>/plugins/    # compiled per-platform plugins (committed, never hand-edited)
dist/kimi/marketplace.json  # Kimi catalog
.claude-plugin/marketplace.json  # Claude catalog (must stay at the repo root), points at ./dist/claude/plugins/<name>
```

Everything under `dist/` and the root `.claude-plugin/marketplace.json` is **compiled, not hand-edited**. Canonical sources:

- `src/plugins/<name>/plugin.yaml` — one per plugin (name, version, description, author, keywords, interface). A plugin's `skills/`, `agents/`, and `commands/` dirs are detected automatically.
- `marketplace.yaml` — marketplace name/owner + externally sourced plugins (e.g. hyper)
- `build/platforms/<platform>.yaml` — per-platform variables (harness name, config dir, model tiers). Each file is a build target.
- Any `*.jig` file inside a plugin — a [Jig](https://jig.saulo.engineer) template rendered per platform (`{{ platform.configDir }}`, `{{ platform.models.fast }}`, `@if(platform.models) …`) to its stripped name (`SKILL.md.jig` → `SKILL.md`). Only the `.jig` lives in `src/`; don't add the rendered sibling next to it (the build fails if you do).
- Manifest templates live in `build/templates/*.jig.edge` (Jig's disk loader requires the `.edge` extension).

After changing any of these:

```
bun install     # first time
bun run build
```

The build wipes and regenerates each `dist/<platform>/` from scratch, so deleted or renamed source files never leave stale outputs behind. For every platform it writes `dist/<platform>/plugins/<name>/` (all content copied verbatim except `plugin.yaml`, `*.jig` rendered) plus the platform manifest:

- Claude: `dist/claude/plugins/<name>/.claude-plugin/plugin.json`, and the root `.claude-plugin/marketplace.json`
- Kimi: `dist/kimi/plugins/<name>/kimi.plugin.json`, and `dist/kimi/marketplace.json`

Commit the regenerated `dist/` together with the source change. CI runs `bun run build:check`, which renders in memory and fails naming every generated file that is missing, outdated, has the wrong executable bit, or should no longer exist.
