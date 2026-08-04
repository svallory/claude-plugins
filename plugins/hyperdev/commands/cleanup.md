---
name: cleanup
description: Delete what audit found — orphaned worktrees, parked leftovers, gone branches, scratch contents — every deletion confirmed per item
argument-hint: "[space-path]"
---

# Cleanup

The audit-findings executor: the **one** command in the plugin that deletes
anything. Audit reports; cleanup acts — and only on what audit already
classifies as debris, only for ids the user confirmed, each re-verified at
deletion time. There is no `--all` flag, deliberately, and never will be.

## Usage

```
/hyperdev:cleanup
/hyperdev:cleanup ~/work/mosaic/compliance
```

## The id classes

The script (`hyperdev-cleanup.sh`) knows exactly six kinds of debris — the
same classifications `hyperdev-audit.sh` makes, nothing of its own:

| Id | What it is |
|---|---|
| `worktree:<name>` | `worktrees/` entry that is ORPHANED (gitdir missing) or leftover build output (no `.git`). A live registered worktree is refused loudly. |
| `parked:<name>` | entry under the legacy `.claude/worktrees/` that conversion parked — not a registered worktree |
| `backup:memory-index` | `.claude/MEMORY.md.hyperdev-orig`, the pre-conversion memory index backup |
| `evidence:preflight` | `.hyperdev-convert.preflight`, a conversion's capture file |
| `branch:<name>` | local branch whose upstream is gone. Deleted with `git branch -d` **only** — never `-D`; an unmerged branch is refused with instructions for the human. |
| `scratch:contents` | the contents of `scratch/` (the directory itself stays) |

## The flow

1. **List.** Run list mode and show the user everything found, with sizes and
   evidence:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-cleanup.sh" [path]
   ```

   No `--delete` means nothing is deleted — it is safe to run any time. If it
   prints "Nothing to clean.", say so and stop.

2. **Confirm per item** with AskUserQuestion. Never infer consent from "clean
   it up" alone for `worktree:`, `parked:`, or `branch:` items — each one is
   an explicit yes or no. With more than 4 items, batch into multiple
   questions, or use multiSelect where the items are independent.
   `scratch:contents` and `evidence:preflight` may be confirmed as a single
   batch — they are disposable by contract.

3. **Delete**, one visible step per confirmed id:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-cleanup.sh" [path] --delete <id>
   ```

   Each id is re-verified against its candidate class at deletion time — the
   script never trusts the earlier listing.

4. **Re-run list mode** and show the user the clean result.

5. **If an id is refused**, relay the script's reason verbatim. A refusal
   means the re-verification found the world changed since the listing — a
   worktree came alive, a branch grew commits. Never retry with force, never
   escalate `-d` to `-D`, never fall back to a raw `rm`.

## Output

Per item: `deleted <id> (<size>)` or `refused <id>: <reason>`, then a summary
line. Exit 0 when everything named was deleted, 1 when anything was refused.
