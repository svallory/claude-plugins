---
name: adopt
description: Retrofit the container layout onto an existing container — adds missing dirs and docs, suggests homes for loose files
argument-hint: [container-path] [--apply]
---

# Adopt

Brings an existing container up to the standard layout. Additive only: it
creates what is missing and never moves or deletes anything.

## Usage

```
/hyperdev:adopt                      # dry run on the enclosing container
/hyperdev:adopt --apply              # create missing dirs and docs
/hyperdev:adopt ~/work/foo --apply
```

## What it does

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-adopt.sh" [path] [--apply]
```

Dry run by default — it prints what it would create and lists loose entries at
the container root with a suggested destination based on file type.

With `--apply` it creates the missing directories, writes `HYPERDEV.md`, and
seeds `.claude/memory/hyperdev-layout.md`. Existing files are left alone.

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
