---
name: audit
description: Report container drift — missing directories, loose files, stale worktrees
argument-hint: [container-path]
---

# Audit

Read-only report on a container's health. Changes nothing.

## Usage

```
/hyperdev:audit
/hyperdev:audit ~/work/mosaic/compliance
```

## What to check

Start with the adopt dry run, which covers layout and loose files:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-adopt.sh" [path]
```

Then add the checks that need judgement:

1. **Stale worktrees** — `wt list` (or `git worktree list`). Flag worktrees
   whose branch is merged or gone from the remote:
   `git branch -vv | grep ': gone]'`
2. **Scratch size** — `du -sh scratch/`. If it has grown large, remind the user
   it is disposable.
3. **Uncommitted work** — for each worktree, `git status --short`. Surface
   anything dirty that might be forgotten.
4. **Large files at the root** — anything over ~10MB sitting loose belongs in
   `data/`.
5. **Secrets** — loose `.env`, `.pem`, `id_rsa`, credential JSON at the
   container root. Report the path only; never print contents.

## Output

A short report grouped by severity. Recommend fixes but do not apply them —
this command is read-only by contract. Point at `/hyperdev:adopt --apply` for
layout gaps.
