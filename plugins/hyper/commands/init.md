---
name: init
description: Create a new project container — bare clone, worktrees/, and local-only directories
argument-hint: <repo-url> [container-name] [--default-branch <name>]
---

# Init

Creates a project container from a git remote: a bare clone, a worktree for the
default branch, and the standard local-only directories.

## Usage

```
/hyper:init git@github.com:org/repo.git
/hyper:init git@github.com:org/repo.git myname --default-branch develop
```

## What it does

Run the script from the directory that should hold the container:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyper-init.sh" <repo-url> [name] [--default-branch <b>]
```

It will:

1. `git clone --bare` into `<name>/.git`, then set the standard remote fetch
   refspec and fetch — a bare clone has no remote-tracking branches otherwise.
2. Record `worktrunk.default-branch` and `worktrunk.history` in the repo config.
3. Create `worktrees/ data/ notes/ scratch/ bin/`, each with a
   `.what-goes-here` note.
4. Write `HYPERDEV.md` and seed `.claude/memory/hyperdev-layout.md`.
5. Create the default-branch worktree via `wt switch`, falling back to
   `git worktree add` when `wt` is unavailable.

## Notes

- Refuses to overwrite an existing path.
- Worktree placement comes from the user's worktrunk config
  (`worktree-path = "{{ repo_path }}/../worktrees/..."`), which is why the
  script invokes `wt -C <container>` so that template resolves inside it.
- Report the final path and the worktree to `cd` into.
