---
name: init
description: Create a new project space — bare or checkout layout, worktrees, and local-only directories
argument-hint: <repo-url> [space-name] [--layout bare|checkout] [--default-branch <name>]
---

# Init

Creates a project space from a git remote in one of two layouts:

- **bare** (default) — bare clone at `<name>/.git`, no code at the root,
  checkouts in `worktrees/`. Local-only dirs sit at the root, which can
  never be committed.
- **checkout** — ordinary `git clone` with code at the root. Worktrees go
  under `.claude/worktrees/`, and the local-only dirs are protected by
  `.gitignore` instead of by construction.

Pick **bare** when the project is worktree-centric and nothing should ever be
committable from the root. Pick **checkout** when tooling expects a normal
working tree at the root (IDEs, scripts with hardcoded paths) or the team
workflow is a single main checkout with occasional worktrees.

## Usage

```
/hyperdev:init git@github.com:org/repo.git
/hyperdev:init git@github.com:org/repo.git myname --default-branch develop
/hyperdev:init git@github.com:org/repo.git --layout checkout
```

## What it does

Run the script from the directory that should hold the space:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-init.sh" <repo-url> [name] [--layout bare|checkout] [--default-branch <b>]
```

With the default `--layout bare` it will:

1. `git clone --bare` into `<name>/.git`, then set the standard remote fetch
   refspec and fetch — a bare clone has no remote-tracking branches otherwise.
2. Record `worktrunk.default-branch` and `worktrunk.history` in the repo config.
3. Create `worktrees/ data/ notes/ scratch/ bin/`, each with a
   `.what-goes-here` note.
4. Write `HYPERDEV.md` and seed `.claude/memory/hyperdev-layout.md`.
5. Create the default-branch worktree via `wt switch`, falling back to
   `git worktree add` when `wt` is unavailable.

With `--layout checkout` it will:

1. `git clone` normally into `<name>/` — the clone itself is the working
   tree, so there is no separate worktree-creation step.
2. Record `worktrunk.default-branch` and `worktrunk.history` in the repo config.
3. Create `.claude/worktrees/ data/ notes/ scratch/ bin/` (each with a
   `.what-goes-here` note) and add the local-only dirs plus
   `.claude/worktrees/` to `.gitignore`.
4. Write `HYPERDEV.md` and seed `.claude/memory/hyperdev-layout.md`.

## Notes

- Refuses to overwrite an existing path.
- In the bare layout, worktree placement comes from the user's worktrunk config
  (`worktree-path = "{{ repo_path }}/../worktrees/..."`), which is why the
  script invokes `wt -C <space>` so that template resolves inside it.
- In the checkout layout, `HYPERDEV.md` and the `.gitignore` additions appear
  as changes in `git status` — committing them is the project's choice; the
  script never commits.
- Report the final path and, for the bare layout, the worktree to `cd` into
  (for checkout the root itself is the working tree).
