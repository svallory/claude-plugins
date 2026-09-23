# Adding a Plugin

Step-by-step to scaffold a new plugin. See [Build System](/contribute/build-system) for how these pieces get compiled.

## 1. Scaffold the directory

```
src/plugins/<name>/
  plugin.yaml
  README.md
  skills/       # optional
  agents/       # optional
  commands/     # optional
```

The directory name is discovered automatically — `compile.ts` treats any directory under `src/plugins/` containing a `plugin.yaml` as a plugin. No registration step elsewhere is required for the plugin to be picked up.

## 2. Write `plugin.yaml`

These keys are **required** — the build fails, naming the file and the missing key, if any is absent or empty:

```yaml
name: my-plugin              # MUST match the directory name exactly
version: 0.1.0
description: >-
  One or two sentences. This is what shows up in marketplace catalogs.
author: Your Name
keywords: [optional, list]   # optional
interface:
  displayName: My Plugin
  shortDescription: Short tagline for catalog listings
```

`name` must equal the directory name (`src/plugins/my-plugin/` → `name: my-plugin`) — a mismatch is a build error, because catalog entries use `plugin.name` while output directories use the directory name, and the two have to agree.

## 3. Add content directories

Any of `skills/`, `agents/`, `commands/` that exist in the plugin directory are detected automatically and listed in the platform manifests (`claude`'s `.claude-plugin/plugin.json`, `kimi`'s `kimi.plugin.json`). You don't declare them anywhere else.

If a file needs to vary per platform (e.g. referencing `$CLAUDE_PLUGIN_ROOT` vs `$KIMI_PLUGIN_ROOT`), name it `*.jig` — see [Build System § Jig templates](/contribute/build-system#jig-templates).

## 4. Restrict platforms (optional)

By default a plugin builds for every platform in `tutor.config.yaml`'s `platforms:` map. To restrict it, add an entry under `plugins:`:

```yaml
plugins:
  my-plugin:
    platforms: [claude, kimi]   # omit omni, for example
```

## 5. Build

```bash
bun run build
```

This wipes and regenerates every `dist/<platform>/`, so your new plugin appears at `dist/claude/plugins/my-plugin/`, `dist/kimi/plugins/my-plugin/` (per its platform restriction), and gets an entry in the root `.claude-plugin/marketplace.json` and (if built for `kimi`) `dist/kimi/marketplace.json`.

Commit `dist/`, `.claude-plugin/marketplace.json`, and any `skills.sh.json` change together with your `src/plugins/my-plugin/` addition — `bun run build:check` (what CI runs) fails otherwise.

## 6. Verify

```bash
bun run build:check
```

Should report `all N generated files up to date`. If it lists `missing` entries for your new plugin, you forgot to commit the generated output.

## 7. Document the plugin (optional but expected)

Add an entry to `docs/docs/<name>.md` (see the existing stubs for the short-stub format) and a row to `docs/docs/index.md`'s table.
