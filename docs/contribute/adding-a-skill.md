# Adding a Skill

How to add a skill to an existing plugin, and how to decide whether it should be public.

## 1. Scaffold the skill directory

```
src/plugins/<plugin>/skills/<skill-dir-name>/
  SKILL.md          # or SKILL.md.jig if it needs per-platform rendering
```

`compile.ts` discovers skills by walking every plugin's `skills/` directory and looking for `SKILL.md` or `SKILL.md.jig`. The skill's canonical name comes from the `name:` key in its YAML frontmatter — if absent, the directory name is used instead. Two plugins cannot define a skill with the same resolved name; the build fails naming both.

## 2. Write the frontmatter

```yaml
---
name: my-skill
description: Use when... Triggers on "...", "...".
metadata:
  internal: true   # optional — see "Public vs internal" below
---
```

## 3. Public vs internal

A skill is **internal** if its frontmatter sets `metadata.internal: true`. Internal skills:

- Are still built into the plugin's own platform output (`dist/claude/plugins/<plugin>/skills/<skill>/`, etc.) — the plugin's own agent pipeline can use them.
- Must **never** appear in `tutor.config.yaml`'s `skills.public` or any `skills.groups[].skills` list — the build fails naming the skill if it does.
- Never ship to `dist/omni/skills/` and never appear in `skills.sh.json`.

Ghostwriter's helper skills (`detector-red-flags`, `surgical-update`, `writer-examples`) are the existing example: internal, used only inside ghostwriter's own agent pipeline, hidden from the public skills CLI listing.

A skill is **public** if it's listed in `tutor.config.yaml`'s `skills.public` array:

```yaml
skills:
  public: [okf-open-knowledge-format, team-lead, demo-video, my-skill]
```

Being public means:

- It ships to `dist/omni/skills/<skill-name>/` (rendered with the `omni` platform's vars — no `models` key, so any `@if(platform.models)` branch in its template takes the `@else` path).
- It's eligible to appear in `skills.sh.json`, discoverable via `npx skills add svallory/claude-plugins`.

A public skill does **not** have to belong to a `skills.groups` entry — `skills.sh.json`'s `notGrouped: "bottom"` setting means ungrouped public skills still show up, just at the bottom of the skills.sh page.

## 4. Group it (optional)

To have the skill show up under a named heading on skills.sh, add it to a group in `tutor.config.yaml`:

```yaml
skills:
  public: [my-skill]
  groups:
    - title: My Category
      description: One line describing what this group of skills does.
      skills: [my-skill]
```

Every group needs a non-empty `title` and a non-empty `skills` array. Every skill name inside a group's `skills` array must also be in `skills.public` — the build fails otherwise.

## 5. When to make it a `.jig` template

Use `SKILL.md.jig` instead of a plain `SKILL.md` when the skill's content needs to differ per platform — most commonly referencing the platform's plugin-root variable (`$CLAUDE_PLUGIN_ROOT` vs `$KIMI_PLUGIN_ROOT` vs `$SKILL_DIR`) or gating content on whether the platform has a `models` tier map (`@if(platform.models) … @else … @end`). `src/plugins/team-lead/skills/team-lead/SKILL.md.jig` and `src/plugins/demo-video/skills/demo-video/SKILL.md.jig` are existing examples.

If the content is identical across every platform the plugin builds for, a plain `SKILL.md` is simpler — don't reach for `.jig` by default.

Only the `.jig` file belongs in `src/`. Never commit the rendered `SKILL.md` next to `SKILL.md.jig` — the build detects two sources producing the same output path and fails.

## 6. Build and verify

```bash
bun run build
bun run build:check
```

See [Build System](/contribute/build-system) for what gets validated and how.
