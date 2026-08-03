---
name: hyperdev
description: Use when working in or setting up a project container — a bare git repo with worktrees/ and local-only directories. Covers where files belong, why the container root is never committed, and how worktrees are created. Triggers on "container", "worktree layout", "where should this file go", "bare repo", "wt switch".
---

# Project Containers

A container gives a project a fixed shape: every worktree in one place, plus
directories for files that must never be committed.

Two layouts exist, because both are legitimate and converting between them
means re-cloning. **Detect which one you have before acting.**

## Bare layout

```
<container>/
├── .git/         bare repo — shared object store, no working tree
├── .claude/      settings and memory scoped to this project
├── worktrees/    one checkout per branch, created by `wt switch`
│   ├── main/
│   └── fix-thing/
├── data/  notes/  scratch/  bin/
└── HYPERDEV.md
```

The root is not a working tree. Nothing there can be committed — not by
accident, not by a stray `git add -A`. Local-only files get a home structurally
incapable of reaching the remote.

## Checkout layout

```
<project>/            ← ordinary working tree, code lives here
├── .git/             normal repo
├── src/  package.json  …   tracked source
├── .claude/
│   └── worktrees/    one checkout per branch
├── data/  notes/  scratch/  bin/    ← gitignored
└── HYPERDEV.md
```

The root **is** the repository, so the safety property inverts: local-only
directories are protected by `.gitignore`, not by construction. Delete those
entries and a dump in `data/` becomes committable. A top-level `worktrees/`
would sit inside the working tree, so worktrees live under `.claude/` instead.

## Which one am I in

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-stack.sh" detect   # toolchain
```

For the layout, `hyperdev-lib.sh` exposes `container_layout <dir>` (prints
`bare`, `checkout`, or nothing) and `worktrees_dir <dir>`. Rules of thumb:

- `.git` is a **directory** with `core.bare=true` → bare layout.
- `.git` is a **directory**, not bare, and the dir is the repo root → checkout.
- `.git` is a **file** → you are in a linked worktree, not a container root.

A plain repository is *not* treated as a container until it opts in, by having
`HYPERDEV.md` or `.claude/worktrees/`. Without that gate every repo on the
machine would claim to be one.

## The shared corollary

**Nothing at the container root is backed up.** A dump in `data/` exists on
exactly one disk, in either layout.

## Where a file goes

| The file is… | Put it in |
|---|---|
| a DB dump, CSV fixture, tarball, sample dataset | `data/` |
| a review brief, handoff doc, design note, scratch writing | `notes/` |
| output you will not miss tomorrow | `scratch/` |
| a script you run against this project | `bin/` |
| part of the codebase | a worktree — it gets committed |

When unsure between `notes/` and `scratch/`: if losing it would cost you more
than ten minutes, it is not scratch.

## Rules

- **Bare layout: never commit from the container root.** The bare repo has no
  index in the usual sense; `cd` into a worktree first.
- **Checkout layout: the root is a normal working tree** — commit there as
  usual, but run `git status` first. The local-only directories are held out of
  git only by `.gitignore`.
- **Create worktrees with `wt switch <branch>`**, not `git worktree add`. The
  user's worktrunk config controls placement and strips branch prefixes, so
  `fix/foo` becomes `worktrees/foo`. Doing it by hand puts the tree in the
  wrong place and skips post-start hooks (dependency install, hooksPath fix).
- **`scratch/` is disposable.** Anything there may be deleted without warning.
- Worktrees have their own `.claude/` and `CLAUDE.md`; those *are* committed.
  Container-level `.claude/` is local and shared across all worktrees.

## Commands

- `/hyperdev:init <repo-url> [name]` — create a new container
- `/hyperdev:adopt [path] [--apply]` — retrofit the layout onto an existing one
- `/hyperdev:audit [path]` — report drift, read-only
- `/hyperdev:tools [path]` — detect the project toolchain and wire the
  per-edit check hook. See the `hyperdev-tooling` skill; the commands are
  project-specific and must be detected or asked about, never assumed.

## Detecting a container

See "Which one am I in" above for the layout rules. `HYPERDEV.md` is the
explicit marker, but bare-layout detection does not depend on it, so containers
predating this plugin still work.

To find the root from anywhere inside, walk up until that shape appears. A
linked worktree has a `.git` *file*, so it is skipped and the walk continues to
the real root. When `cwd` is the root itself, take extra care — that is where
commits and loose files go wrong.

## Worktrunk interaction

Placement comes from the user-level worktrunk config, roughly:

```toml
worktree-path = "{{ repo_path }}/../worktrees/{{ branch | replace('fix/', '') | ... | sanitize }}"
```

`repo_path` is the worktree `wt` runs from, so `../worktrees/` resolves to the
container's `worktrees/`. Because this is user-level, it applies to every
project — a bare-layout container must use that directory name for `wt` to work
correctly.

The checkout layout does not match that template: its worktrees live in
`.claude/worktrees/`. Either add a project-level `.config/wt.toml` overriding
`worktree-path`, or create those worktrees with `git worktree add` and accept
that `wt switch` will place new ones elsewhere. Check where existing worktrees
actually are (`git worktree list`) before assuming either.

Worktrees of a bare repo get a `.git` *file* rather than a directory, which
breaks relative `core.hooksPath`. The worktrunk `post-start` hook fixes it with
`git config core.hooksPath "$(git rev-parse --git-common-dir)/hooks"`.
