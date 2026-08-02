#!/usr/bin/env bash
# Shared helpers for container init/adopt/audit.
# Sourced, not executed directly.

set -euo pipefail

# The scaffolded directories and what each is for. Order matters for display.
CONTAINER_DIRS=(worktrees data notes scratch bin)

dir_purpose() {
  case "$1" in
    worktrees) echo "git worktrees, one per branch (managed by wt)" ;;
    data)      echo "DB dumps, fixtures, large blobs" ;;
    notes)     echo "briefs, handoffs, working docs" ;;
    scratch)   echo "throwaway files; safe to delete at any time" ;;
    bin)       echo "local helper scripts for this project" ;;
    *)         echo "" ;;
  esac
}

# A container is a directory holding a bare .git plus a worktrees/ dir.
# CONTAINER.md is the explicit marker but we detect structurally too, so
# `adopt` works on containers created before this plugin existed.
is_container() {
  local d="${1:-$PWD}"
  [[ -f "$d/CONTAINER.md" ]] && return 0
  [[ -d "$d/worktrees" ]] && [[ -d "$d/.git" ]] \
    && [[ "$(git --git-dir="$d/.git" config --get core.bare 2>/dev/null)" == "true" ]]
}

# Walk up from cwd to find the enclosing container root, if any.
find_container_root() {
  local d="${1:-$PWD}"
  while [[ "$d" != "/" ]]; do
    if is_container "$d"; then
      echo "$d"
      return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

# True when cwd is the container root itself rather than inside a worktree.
# This is where the dangerous mistakes happen (committing, loose files).
at_container_root() {
  local root
  root="$(find_container_root "$PWD")" || return 1
  [[ "$root" == "$PWD" ]]
}

write_container_md() {
  local root="$1" name="$2"
  cat > "$root/CONTAINER.md" <<EOF
# $name

Project **container**. This directory is not a git worktree — nothing here is
committed. Real checkouts live in \`worktrees/\`.

## Layout

| Path | Purpose |
|------|---------|
| \`.git/\` | bare repository (shared object store for all worktrees) |
| \`.claude/\` | Claude settings and memory scoped to this project |
| \`worktrees/\` | $(dir_purpose worktrees) |
| \`data/\` | $(dir_purpose data) |
| \`notes/\` | $(dir_purpose notes) |
| \`scratch/\` | $(dir_purpose scratch) |
| \`bin/\` | $(dir_purpose bin) |

## Rules

- Do not run \`git commit\` from the container root; \`cd\` into a worktree first.
- Create worktrees with \`wt switch <branch>\`, never \`git worktree add\` by hand.
- \`scratch/\` is disposable. Anything you would miss belongs in \`data/\` or \`notes/\`.
- Files here never reach the remote. Secrets are local-only by construction,
  but that also means nothing here is backed up.
EOF
}

# Seed .claude/ with a memory describing the layout, so future sessions in this
# project know the conventions without relying on the hook alone.
write_memory_seed() {
  local root="$1" name="$2"
  local mem="$root/.claude/memory"
  mkdir -p "$mem"

  cat > "$mem/container-layout.md" <<EOF
---
name: container-layout
description: $name uses a container layout; worktrees live in worktrees/, container root is never committed
metadata:
  type: project
---

\`$root\` is a project container, not a checkout. The \`.git\` there is bare and
the working copies are in \`worktrees/<branch>\`, created via \`wt switch\`.

Local-only directories at the container root: \`data/\` (dumps, fixtures),
\`notes/\` (briefs, handoffs), \`scratch/\` (disposable), \`bin/\` (helper scripts).
None of it is committed or backed up.

**Why:** keeps a single object store across branches and gives local-only files a
home that cannot accidentally be committed.

**How to apply:** never commit from the container root; put new local files in the
matching directory instead of loose at the root. See \`CONTAINER.md\`.
EOF

  local index="$root/.claude/MEMORY.md"
  if [[ ! -f "$index" ]]; then
    printf '# Memory index\n\n' > "$index"
  fi
  if ! grep -q 'container-layout.md' "$index" 2>/dev/null; then
    printf -- '- [Container layout](memory/container-layout.md) — worktrees/, local-only dirs, root is never committed\n' >> "$index"
  fi
}

# Create the directory set. Idempotent: reports created vs already-present.
scaffold_dirs() {
  local root="$1"
  local d
  for d in "${CONTAINER_DIRS[@]}"; do
    if [[ -d "$root/$d" ]]; then
      echo "  exists   $d/"
    else
      mkdir -p "$root/$d"
      # .gitkeep is pointless (nothing is committed) but a README explains itself
      # to whoever opens the folder six months later.
      printf '%s\n' "$(dir_purpose "$d")" > "$root/$d/.what-goes-here"
      echo "  created  $d/"
    fi
  done
}
