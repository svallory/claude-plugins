---
name: help
description: What hyperdev is, what commands exist, and the standard flow for getting a project set up
argument-hint: ""
---

# Help

Summarize the plugin for the user, then point them at the right first step.
Keep it short — this is orientation, not the manual.

## What to tell the user

**hyperdev** implements the [Hyper Coding methodology](https://hyperdev.saulo.engineer)
for Claude Code. Two ideas:

1. **Spaces.** A space wraps a project: bare `.git` at the root, every
   checkout under `worktrees/<branch>`, and local-only dirs (`data/` `notes/`
   `scratch/` `bin/`) that can never be committed — dumps, briefs, and
   secrets get a home that is structurally incapable of reaching the remote.
   Space files and project files never mix.
2. **Toolchain integration.** The project's *own* linter/typechecker runs
   after every edit and failures feed straight back to the agent — plus
   friction on new dependencies, session context injection, spec-driven
   planning, and template-driven generation.

## Commands

| Command | What it does |
|---|---|
| `/hyperdev:init <repo-url>` | create a new space from a remote |
| `/hyperdev:adopt [path]` | bring an existing repo into the layout — scaffolds a bare repo, **converts** an ordinary checkout (dry run first, four data-safety guarantees) |
| `/hyperdev:tools` | detect the project's toolchain, wire the per-edit check hook |
| `/hyperdev:audit` | read-only health report: drift, debris, stale branches, secrets |
| `/hyperdev:plan <feature>` | four-phase spec-driven workflow: Define → Design → Decompose → Develop |
| `/hyperdev:gen <template>` | generate files from project templates, verbatim outside marked regions |

Hooks (automatic): SessionStart context injection inside a space; per-edit
check hook and new-dependency friction hook, both opt-in via
`.claude/hyperdev.json`.

## The standard flow

For an existing project:

1. `/hyperdev:adopt` — dry run. Show the user the plan (for an ordinary
   checkout this is a **conversion** — get explicit confirmation), then
   `--apply`.
2. `/hyperdev:tools` — detect the toolchain, agree on the check commands,
   write `.claude/hyperdev.json`, and **prove the hook can fail** (inject an
   error, expect exit 2).
3. `/hyperdev:audit` — periodically, to catch drift and debris.
4. `/hyperdev:plan` when starting a feature; `/hyperdev:gen` when the team
   has patterns worth templating.

For a brand-new setup: `/hyperdev:init <repo-url>` instead of step 1.

## If the user asks for more

- Layout rules and conventions: the `hyperdev` skill, or `HYPERDEV.md` in
  their space.
- Domain language and design rules: `docs/concepts.md` in the plugin.
- What maps to which Hyper Coding pillar: the "Methodology coverage" section
  of the plugin README.
