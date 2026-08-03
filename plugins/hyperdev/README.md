# hyperdev

Project spaces and real-time toolchain feedback for Claude Code. Implements
the two principles of the [Hyper Coding](https://hyperdev.saulo.engineer)
methodology a plugin can deliver today: **Tools Integration** and
**Real-time Feedback**.

## What is a space

A space gives a project a fixed shape: the git repo, every worktree, and a
small set of local-only directories (`data/`, `notes/`, `scratch/`, `bin/`)
for files that must never be committed. `HYPERDEV.md` at the space root is
the opt-in marker. Two layouts exist — both first-class, because converting
between them means re-cloning.

### Bare layout

```
<space>/
├── .git/         bare — no working tree
├── .claude/      settings + memory
├── worktrees/    one checkout per branch
├── data/  notes/  scratch/  bin/
└── HYPERDEV.md
```

The root is not a working tree, so nothing there can be committed — not by
accident, not by a stray `git add -A`. Local-only files get a home that is
*structurally* incapable of reaching the remote.

### Checkout layout

```
<project>/            ordinary working tree, code at the root
├── .git/
├── src/ …            tracked source
├── .claude/worktrees/
├── data/  notes/  scratch/  bin/   ← gitignored
└── HYPERDEV.md
```

The root **is** the repo, so the safety property inverts: local-only dirs
are protected by `.gitignore`, not by construction. A top-level `worktrees/`
would sit inside the working tree, so worktrees live under `.claude/`.

## Install

```
/plugin marketplace add svallory/claude-plugins
/plugin install hyperdev@svallory-plugins
```

## Commands

| Command | What it does |
|---|---|
| `/hyperdev:init <repo-url> [space-name] [--layout bare\|checkout] [--default-branch <name>]` | Create a new space from a git remote |
| `/hyperdev:adopt [space-path] [--apply]` | Retrofit the layout onto an existing repo — additive only, never moves or deletes |
| `/hyperdev:audit [space-path]` | Read-only drift report: missing dirs, loose files, stale worktrees |
| `/hyperdev:tools [project-path]` | Detect the project's own toolchain and wire up the check hook |
| `/hyperdev:plan <feature> [phase]` | 4-phase spec-driven workflow — Define, Design, Decompose, Develop — with artifacts in `notes/specs/` |
| `/hyperdev:gen [template] [dest]` | Generate files from a project template — deterministic copy, agent authoring only inside marked prompt regions |

## Hooks

Three hook scripts ship. Each is a silent no-op until its own opt-in, and the
opt-ins differ:

- **SessionStart** — injects space context (layout, worktrees, toolchain)
  at the start of each session. Its opt-in is the space itself: it fires once
  the project has the space markers (`HYPERDEV.md`, or the layout's worktrees
  directory), with or without `.claude/hyperdev.json`.
- **PostToolUse** — after every `Edit`/`Write`/`NotebookEdit`, runs the
  project's *own* linter or typechecker and feeds failures straight back; a
  companion hook flags dependency drift after `Edit`/`Write` on a manifest.
  Both opt in via the project's `.claude/hyperdev.json`:

```jsonc
{
  "check": {
    "enabled": true,
    "run": "typecheck",            // package script — or an explicit "command"
    "extensions": [".ts", ".tsx"],
    "timeout": 60
  },
  "deps": { "enabled": true }
}
```

Multiple checks go in a `"checks"` array, each with its own filter.
`/hyperdev:tools` writes this file for you from what it detects.

## Principles

**Report only what is verifiable. Absence means unknown, never a default.**

Detection omits any key it cannot prove: a missing lint command means "this
project has no lint script", not "try `npm run lint`". With no lockfile and no
`packageManager` field the package manager is `unknown` and the check hook
declines to run rather than defaulting to npm. A wrong check that fails on every edit gets ignored
within a day — and the real failures get ignored with it.

Nothing deletes or moves user files automatically: audits and adopt runs
report; a human acts.
