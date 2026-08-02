---
name: hyper
description: Use when working in or setting up a project container — a bare git repo with worktrees/ and local-only directories. Covers where files belong, why the container root is never committed, and how worktrees are created. Triggers on "container", "worktree layout", "where should this file go", "bare repo", "wt switch".
---

# Project Containers

A container is a directory holding a bare git repo plus every worktree for that
project, alongside directories for files that must never be committed.

```
<container>/
├── .git/         bare repo — shared object store, no working tree
├── .claude/      settings and memory scoped to this project
├── worktrees/    one checkout per branch, created by `wt switch`
│   ├── main/
│   └── fix-thing/
├── data/         DB dumps, fixtures, large blobs
├── notes/        briefs, handoffs, working docs
├── scratch/      throwaway; safe to delete at any time
├── bin/          local helper scripts
└── HYPERDEV.md  what this is and where things go
```

## The core property

The container root is not a working tree. Nothing at that level can be
committed — not by accident, not by a stray `git add -A`. That is the whole
point: local-only files get a home that is structurally incapable of reaching
the remote.

The corollary is that **nothing at the container root is backed up**. A dump in
`data/` exists on exactly one disk.

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

- **Never commit from the container root.** The bare repo has no index in the
  usual sense; `cd` into a worktree first.
- **Create worktrees with `wt switch <branch>`**, not `git worktree add`. The
  user's worktrunk config controls placement and strips branch prefixes, so
  `fix/foo` becomes `worktrees/foo`. Doing it by hand puts the tree in the
  wrong place and skips post-start hooks (dependency install, hooksPath fix).
- **`scratch/` is disposable.** Anything there may be deleted without warning.
- Worktrees have their own `.claude/` and `CLAUDE.md`; those *are* committed.
  Container-level `.claude/` is local and shared across all worktrees.

## Commands

- `/hyper:init <repo-url> [name]` — create a new container
- `/hyper:adopt [path] [--apply]` — retrofit the layout onto an existing one
- `/hyper:audit [path]` — report drift, read-only

## Detecting a container

Structurally: a directory with `worktrees/` and a `.git` where
`core.bare == true`. `HYPERDEV.md` is the explicit marker, but detection does
not depend on it, so containers predating this plugin still work.

To find the root from anywhere inside, walk up until that shape appears. When
`cwd` is the root itself, take extra care — that is where commits and loose
files go wrong.

## Worktrunk interaction

Placement comes from the user-level worktrunk config, roughly:

```toml
worktree-path = "{{ repo_path }}/../worktrees/{{ branch | replace('fix/', '') | ... | sanitize }}"
```

`repo_path` is the worktree `wt` runs from, so `../worktrees/` resolves to the
container's `worktrees/`. Because this is user-level, it applies to every
project — a container must use that directory name for `wt` to work correctly.

Worktrees of a bare repo get a `.git` *file* rather than a directory, which
breaks relative `core.hooksPath`. The worktrunk `post-start` hook fixes it with
`git config core.hooksPath "$(git rev-parse --git-common-dir)/hooks"`.
