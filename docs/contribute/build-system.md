# Build System

`build/compile.ts` compiles canonical plugin sources into per-platform distributable trees. This page is the source of truth for how that compilation works — every claim here is checked against `build/compile.ts` and `tutor.config.yaml`.

## Canonical sources

Everything under `dist/`, the root `.claude-plugin/marketplace.json`, and `skills.sh.json` is **compiled, not hand-edited**. The inputs are:

- **`src/plugins/<name>/`** — one directory per plugin, discovered automatically (any directory containing a `plugin.yaml`). Holds:
  - `plugin.yaml` — plugin metadata (never shipped as-is; compiled into each platform's manifest)
  - `skills/`, `agents/`, `commands/` — component directories, detected automatically per plugin
  - `README.md` and any other content, copied verbatim
  - `*.jig` files anywhere in the tree — rendered per platform (see [Jig templates](#jig-templates))
- **`tutor.config.yaml`** — the single build config, with three required top-level sections (the build exits with an error naming any that's missing):

  | Section | Purpose |
  |---|---|
  | `marketplace` | Catalog `name` + `owner`, plus `external` plugins sourced from another repo (e.g. `hyper`, via `git-subdir`) |
  | `platforms` | One entry per build target — see [Platforms](#platforms) below |
  | `skills` | `public` (skill names exposed via omni/skills.sh) and `groups` (grouped listing for `skills.sh.json`) |

  A fourth, optional section:

  | Section | Purpose |
  |---|---|
  | `plugins.<name>.platforms` | Restrict which platforms a plugin builds for (array of platform ids). Omitted = all platforms. |

- **`build/templates/*.jig.edge`** — manifest templates (Jig's disk loader requires the `.edge` extension). Four templates exist: `claude-plugin.jig.edge`, `kimi-plugin.jig.edge`, `kimi-marketplace.jig.edge`, `marketplace.jig.edge`.

### `plugin.yaml` required keys

`compile.ts` validates every `plugin.yaml` against a fixed key list before rendering anything, and fails the build (naming the file and the missing key) if any are absent:

```
name, version, description, author, interface.displayName, interface.shortDescription
```

`name` must also match the plugin's directory name exactly — a mismatch is a build error, not a warning (this keeps `dist/<platform>/plugins/<name>/` output dirs and catalog `plugin.name` fields in sync). `keywords` is optional but used if present.

## Platforms

`tutor.config.yaml`'s `platforms:` map currently defines three targets:

| Platform | `harness` | `configDir` | `pluginRootVar` | `models` |
|---|---|---|---|---|
| `claude` | Claude Code | `.claude` | `$CLAUDE_PLUGIN_ROOT` | `fast`/`balanced`/`strong`/`orchestrator` tiers |
| `kimi` | Kimi Code | `.kimi-code` | `$KIMI_PLUGIN_ROOT` | (none) |
| `omni` | your AI coding agent | `.agents` | `$SKILL_DIR` | (none) |

Each platform's `.jig` templates render with `{{ platform.* }}` in scope, so `platform.configDir`, `platform.pluginRootVar`, and `platform.models.fast` (etc.) are all available. Platforms without a `models` key (currently `kimi` and `omni`) must be handled by templates via `@if(platform.models) … @else … @end` — there is no default tier to fall back to.

## What gets generated, per platform

For every platform in `tutor.config.yaml`'s `platforms:` map, the build **owns `dist/<platform-id>/` entirely**: it is wiped (`rmSync` with `recursive: true, force: true`) and regenerated from `src/` on every `bun run build`, so a deleted or renamed source file never leaves a stale output behind.

### `claude` and `kimi` — plugin-scoped

Both are plugin-scoped: each plugin lands at `dist/<platform>/plugins/<name>/` with every file copied verbatim except:

- `plugin.yaml` itself — never copied (its data is compiled into the manifest instead)
- `*.jig` files — rendered, extension stripped (`SKILL.md.jig` → `SKILL.md`)

Plus a platform-specific manifest:

- **`claude`** — `.claude-plugin/plugin.json`, rendered from `claude-plugin.jig.edge` with `{ plugin, components }` in scope, where `components` is the list of `{ key, value }` pairs for whichever of `skills/`, `agents/`, `commands/` exist in that plugin (e.g. `{"key": "skills", "value": "./skills/"}`). The **Claude catalog stays at the repo root**: `.claude-plugin/marketplace.json` (a Claude platform requirement, not a per-platform dist path), rendered from `marketplace.jig.edge` and pointing local plugins at `./dist/claude/plugins/<name>`.
- **`kimi`** — `kimi.plugin.json` per plugin (rendered from `kimi-plugin.jig.edge`), plus a `dist/kimi/marketplace.json` catalog (rendered from `kimi-marketplace.jig.edge`, listing every plugin built for `kimi`).

A plugin can restrict which platforms it builds for via `plugins.<name>.platforms` in `tutor.config.yaml` — e.g. `ghostwriter` in the current config is restricted to `[claude, kimi]`, so it never appears in `dist/omni/` even though it defines skills.

### `omni` — skill-scoped

`omni` has **no manifest and no catalog**. Instead of iterating plugins, it iterates `skills.public` from `tutor.config.yaml` and writes `dist/omni/skills/<skill-name>/` for each one, copied from that skill's source directory (`src/plugins/<plugin>/skills/<skill-name>/`) and rendered with the `omni` platform's vars. A skill not listed in `skills.public` — including every skill belonging to a plugin restricted away from `omni` — never appears under `dist/omni/`.

### The marketplace catalogs

Two catalogs exist:

1. **Root Claude catalog** — `.claude-plugin/marketplace.json`. Entries are every local plugin built for `claude` (`name`, `description`, `external: false`) plus every entry under `tutor.config.yaml`'s `marketplace.external` (`external: true`, using that entry's own `source` block, e.g. `hyper`'s `git-subdir` source). Rendered from `marketplace.jig.edge` with `{ marketplace, plugins, sourcePrefix: './dist/claude/plugins' }`.
2. **Kimi catalog** — `dist/kimi/marketplace.json`. Entries are every plugin built for `kimi` (`id`, `displayName`, `source: "./plugins/<name>"`). Rendered from `kimi-marketplace.jig.edge`.

### `skills.sh.json` generation and public skills

Before generating anything skill-related, `compile.ts` walks every plugin's `skills/<dir>/` looking for `SKILL.md` or `SKILL.md.jig`, and builds a name → skill map from each file's YAML frontmatter (`name:` frontmatter key if present, else the directory name). Two things fail the build here:

- Two plugins defining a skill with the same `name`.
- A skill directory whose frontmatter sets `metadata.internal: true` appearing in `skills.public` or any `skills.groups[].skills` entry — internal skills must never be listed as public.

`skills.sh.json` (repo root, committed) is then generated from `tutor.config.yaml`'s `skills.groups`, with a fixed shape:

```json
{
  "$schema": "https://skills.sh/schemas/skills.sh.schema.json",
  "notGrouped": "bottom",
  "groupings": [ /* skills.groups, verbatim */ ]
}
```

Validation before generation:

- Every `skills.groups[i]` needs a non-empty `title` and a non-empty `skills` array, or the build fails naming the index/title.
- Every skill name referenced by `skills.public` or any group must resolve to an actual `skills/<dir>/SKILL.md(.jig)` — an unresolvable name fails the build.
- Every skill name inside a `skills.groups[].skills` array must also appear in `skills.public` — a group can't list a skill that isn't public.

In the current `tutor.config.yaml`, `skills.public` is `[okf-open-knowledge-format, team-lead, demo-video, decompose]`, grouped into four `skills.groups` entries (Knowledge, Agent Workflow, Demos & Video, Problem Solving). Ghostwriter's skills are not public — they stay internal to the plugin's own agent pipeline.

## Jig templates

Any `*.jig` file inside a plugin's `src/plugins/<name>/` tree is a [Jig](https://jig.saulo.engineer) template. Two kinds appear in this repo:

- **In-tree templates** (e.g. `src/plugins/team-lead/skills/team-lead/SKILL.md.jig`) — rendered with `edge.renderRawSync(source, { platform, plugin }, filePath)` and written to the same relative path with `.jig` stripped. Only the `.jig` file lives in `src/`; **do not commit the rendered sibling next to it** — `compile.ts`'s `add()` function detects two sources producing the same output path and fails the build (`two sources produce <path> (a file next to its own .jig template?)`).
- **Disk-loaded manifest templates** (`build/templates/*.jig.edge`) — mounted once via `edge.mount(join(BUILD, 'templates'))` at the top of `compile.ts`. Jig's disk loader requires the `.edge` extension on top of `.jig`, which is why these live as `claude-plugin.jig.edge` etc. rather than plain `.jig`.

### Template syntax rules that matter

Looking at the actual templates in `build/templates/`:

- **Block tags (`@if`, `@each`, `@else`, `@end`) must start at the beginning of a line.** They are not inline expressions — see how `claude-plugin.jig.edge` opens `@if(plugin.keywords && plugin.keywords.length)` flush-left, or how `marketplace.jig.edge` uses `@each((plugin, index) in plugins)` / `@if(index > 0)` for comma handling between array entries.
- **`{{ json :: value }}`** is the filter syntax for JSON-encoding a value inside a template (registered once via `edge.registerFilter('json', (value) => JSON.stringify(value))` at the top of `compile.ts`). Every manifest field is emitted this way — e.g. `"name": {{ json :: plugin.name }}` — because manifests are JSON and Jig doesn't auto-escape.
- **`add()` re-parses and re-prints JSON output** (`{ json: true }` option) rather than trusting template whitespace — `JSON.stringify(JSON.parse(content), null, 2)`. If a template renders invalid JSON, the build fails immediately naming the target path, rather than committing malformed output.
- **`{{ platform.* }}` scope** — in-tree `.jig` templates render with `{ platform, plugin }` in scope (the specific platform being built for, plus that plugin's parsed `plugin.yaml`). Manifest templates render with whatever that manifest needs (`{ plugin, components }` for `claude-plugin.jig.edge`, `{ plugins }` for the marketplace catalogs).

## Running the build

```bash
bun install       # first time only
bun run build      # bun build/compile.ts — wipes and regenerates dist/, marketplace.json, skills.sh.json
bun run build:check   # bun build/compile.ts --check — renders in memory, diffs against committed files, never writes
```

`build:check` (what CI runs) reports, for every stale file:

- `missing` — expected output doesn't exist on disk
- `outdated` — content differs from what's committed
- `mode` — executable bit differs (source files with the execute bit set are copied through with `0o755`; everything else is `0o644`)
- `unexpected` — a file exists under an owned `dist/<platform>/` directory that the build didn't generate (e.g. a leftover from a deleted plugin)
- `orphaned` — a whole `dist/<id>/` tree exists with no matching `<id>` entry under `platforms:` in `tutor.config.yaml` (a removed platform leaves its dist tree behind; the build never touches it again, so it must be deleted by hand)

## CI enforcement

CI runs `bun run build:check`. Any source change that isn't reflected in the committed `dist/`, `.claude-plugin/marketplace.json`, or `skills.sh.json` fails CI. The fix is always the same: run `bun run build` locally and commit the regenerated output together with the source change — never hand-edit anything under `dist/`.
