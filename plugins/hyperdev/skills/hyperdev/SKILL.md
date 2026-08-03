---
name: hyperdev
description: Use when working in or setting up a project space — a bare git repo with worktrees/ and local-only directories. Covers where files belong, why the space root is never committed, and how worktrees are created. Triggers on "space", "worktree layout", "where should this file go", "bare repo", "wt switch".
---

# Project Spaces

A space gives a project a fixed shape: every worktree in one place, plus
directories for files that must never be committed.

Two layouts exist, because both are legitimate and converting between them
means re-cloning. **Detect which one you have before acting.**

## Bare layout

```
<space>/
├── .git/         bare repo — shared object store, no working tree
├── .claude/      settings and memory scoped to this project
├── worktrees/    one worktree per branch, created by `wt switch`
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
│   └── worktrees/    one worktree per branch
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

For the layout, `hyperdev-lib.sh` exposes `space_layout <dir>` (prints
`bare`, `checkout`, or nothing) and `worktrees_dir <dir>`. Rules of thumb:

- `.git` is a **directory** with `core.bare=true`, with a `worktrees/` dir or
  `HYPERDEV.md` beside it → bare layout. A bare repo with *neither* is a plain
  mirror or hosting remote, not a space — `space_layout` prints nothing for it.
- `.git` is a **directory**, not bare, and the dir is the repo root → checkout.
- `.git` is a **file** → you are in a linked worktree, not a space root.

A plain repository is *not* treated as a space until it opts in: a checkout by
having `HYPERDEV.md` or `.claude/worktrees/`, a bare repo by having
`HYPERDEV.md` or a top-level `worktrees/`. Without those gates every repo and
mirror on the machine would claim to be one.

## The shared corollary

**Nothing at the space root is backed up.** A dump in `data/` exists on
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

- **Bare layout: never commit from the space root.** The bare repo has no
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
  Space-level `.claude/` is local and shared across all worktrees.

## Which command, in what order

There is no single "set this project up" command. For an existing project:

1. `/hyperdev:adopt <path>` — dry run first, read the output.
2. Act on the loose-file suggestions **one at a time**, confirming each. They
   are heuristics; several categories are explicitly "leave in place".
3. `/hyperdev:adopt <path> --apply` — create the scaffold.
4. `/hyperdev:tools <path>` — detect the toolchain and wire the check hook.
5. `/hyperdev:audit <path>` — the judgement checks, any time after.

`/hyperdev:init` is only for creating a *new* space from a remote. It does
not apply to a project that already exists on disk.

Nothing in the plugin deletes anything. Orphaned worktrees, stale branches and
oversized `scratch/` are reported for you to act on by hand.

## Commands

- `/hyperdev:init <repo-url> [name]` — create a new space
- `/hyperdev:adopt [path] [--apply]` — retrofit the layout onto an existing one
- `/hyperdev:audit [path]` — report drift, read-only. The mechanical checks
  are scripted (`hyperdev-audit.sh`); judging each finding is not.
- `/hyperdev:tools [path]` — detect the project toolchain and wire the
  check hook. See the `hyperdev-tooling` skill; the commands are
  project-specific and must be detected or asked about, never assumed. The
  same config file gates the deps friction hook, which asks for one sentence
  of justification when an edit adds a new dependency.
- `/hyperdev:plan <feature> [phase]` — the four-phase spec workflow: Define,
  Design, Decompose, Develop. Artifacts live under `notes/specs/`.
- `/hyperdev:gen [template] [dest]` — generate files from a project template;
  deterministic copy, agent authoring only inside marked prompt regions.

## Detecting a space

See "Which one am I in" above for the layout rules. `HYPERDEV.md` is the
explicit marker, but the bare layout is also recognised from structure alone —
a bare `.git` with a top-level `worktrees/` beside it — so spaces predating
this plugin still work without the marker.

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
space's `worktrees/`. Because this is user-level, it applies to every
project — a bare-layout space must use that directory name for `wt` to work
correctly.

The checkout layout does not match that template: its worktrees live in
`.claude/worktrees/`. Either add a project-level `.config/wt.toml` overriding
`worktree-path`, or create those worktrees with `git worktree add` and accept
that `wt switch` will place new ones elsewhere. Check where existing worktrees
actually are (`git worktree list`) before assuming either.

Worktrees of a bare repo get a `.git` *file* rather than a directory, which
breaks relative `core.hooksPath`. The worktrunk `post-start` hook fixes it with
`git config core.hooksPath "$(git rev-parse --git-common-dir)/hooks"`.
