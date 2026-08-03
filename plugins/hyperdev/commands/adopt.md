---
name: adopt
description: Retrofit the space layout onto an existing space — adds missing dirs and docs, suggests homes for loose files
argument-hint: "[space-path] [--apply]"
---

# Adopt

Brings an existing space up to the standard layout. Additive only: it
creates what is missing and never moves or deletes anything.

## Usage

```
/hyperdev:adopt                      # dry run on the enclosing space
/hyperdev:adopt --apply              # create missing dirs and docs
/hyperdev:adopt ~/work/foo --apply
```

## What it does

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-adopt.sh" [path] [--apply]
```

Dry run by default — it prints what it would create and lists loose entries at
the space root with a suggested destination based on file type.

**Checkout layout: only untracked/ignored entries are listed.** Anything git
already tracks is treated as source, so a stray that was committed (an old
dump swept up by `git add -A`) will not appear. If the user suspects committed
junk, check `git ls-files` at the root; untracking (`git rm --cached`) and
re-running makes the entry show up with a suggestion.

With `--apply` it creates the missing directories, writes `HYPERDEV.md`, and
seeds `.claude/memory/hyperdev-layout.md`. Existing files are left alone —
an existing `HYPERDEV.md` or memory seed is reported as `exists` and never
regenerated, so user edits to those files survive a re-adopt.

## Handling loose files

The script only *suggests* destinations; it never moves them. That is
deliberate — the heuristics key off file extensions and directory names, and
they cannot tell a dump you still need from one you forgot to delete.

When running this for the user:

1. Run the dry run and show the output.
2. Go through the loose entries with the user and agree on a destination for
   each. Ask when a file's purpose is unclear rather than guessing.
3. Run with `--apply` to create the scaffold.
4. Move the agreed files with explicit `mv` commands, one per file, so each is
   visible and reversible. Never batch-move on inference alone.

Large files and anything that looks like a database dump or credentials
deserve an explicit confirmation before moving.
