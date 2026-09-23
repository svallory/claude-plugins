# Contribute

Tutor is a compiled monorepo: plugin sources live under `src/plugins/`, and a build step (`bun run build`) renders them into per-platform distributables under `dist/`. Nothing in `dist/`, the root `.claude-plugin/marketplace.json`, or `skills.sh.json` is hand-edited — they're all generated from canonical sources and committed alongside the change that produced them.

## Start here

- **[Build System](/contribute/build-system)** — canonical sources, what gets generated per platform, the `.jig` templating rules, and CI enforcement. Read this first.
- **[Adding a Plugin](/contribute/adding-a-plugin)** — scaffold a new plugin from scratch.
- **[Adding a Skill](/contribute/adding-a-skill)** — add a skill to an existing plugin, and decide whether it should be public.

## Quick reference

```bash
bun install     # first time
bun run build   # regenerate dist/, root marketplace.json, skills.sh.json
bun run build:check  # verify committed output is fresh (what CI runs)
```

If `build:check` fails, run `bun run build` and commit the result together with your source change.
