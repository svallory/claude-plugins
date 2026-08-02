#!/usr/bin/env bash
# Retrofit the container layout onto an existing container.
# Usage: hyper-adopt.sh [container-root] [--apply]
#
# Without --apply this only reports. Nothing moves until you pass --apply,
# and even then only the directory scaffold and docs are written — loose files
# are always listed as suggestions for a human to act on.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/hyper-lib.sh"

root=""
apply=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=1; shift ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) root="$1"; shift ;;
  esac
done

if [[ -z "$root" ]]; then
  root="$(find_container_root "$PWD")" || {
    echo "not inside a container (no bare .git + worktrees/ found)" >&2
    echo "pass a path explicitly, or use hyper-init.sh to create one" >&2
    exit 1
  }
fi

root="$(cd "$root" && pwd)"

if ! is_container "$root"; then
  echo "not a container: $root" >&2
  echo "expected a bare .git and a worktrees/ directory" >&2
  exit 1
fi

name="$(basename "$root")"

echo "Container: $root"
echo

if [[ $apply -eq 1 ]]; then
  echo "Directories:"
  scaffold_dirs "$root"
  mkdir -p "$root/.claude"
  write_hyperdev_md "$root" "$name"
  write_memory_seed "$root" "$name"
  echo "  wrote    HYPERDEV.md"
  echo "  wrote    .claude/memory/hyperdev-layout.md"
else
  echo "Directories (dry run):"
  for d in "${CONTAINER_DIRS[@]}"; do
    if [[ -d "$root/$d" ]]; then
      echo "  exists   $d/"
    else
      echo "  would create  $d/  — $(dir_purpose "$d")"
    fi
  done
  [[ -f "$root/HYPERDEV.md" ]] \
    && echo "  exists   HYPERDEV.md" \
    || echo "  would create  HYPERDEV.md"
fi

echo
echo "Loose entries at container root (suggestions only — nothing is moved):"

found_loose=0
while IFS= read -r entry; do
  base="$(basename "$entry")"

  # Skip the structural pieces and the directories we manage.
  case "$base" in
    .git|.claude|HYPERDEV.md|.DS_Store) continue ;;
  esac
  skip=0
  for d in "${CONTAINER_DIRS[@]}"; do
    [[ "$base" == "$d" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue

  found_loose=1

  # Suggest a destination by shape: big binaries and dumps to data/,
  # markdown and docs to notes/, executables to bin/, rest unclassified.
  suggestion=""
  if [[ -e "$entry/.git" ]]; then
    # A checkout sitting at the container root — never a data/ or notes/ file.
    # Distinguish a live worktree from an orphan whose registration git has
    # already pruned, because the remedies are opposite.
    if [[ -f "$entry/.git" ]] \
       && gitdir="$(sed -n 's/^gitdir: //p' "$entry/.git" 2>/dev/null)" \
       && [[ -n "$gitdir" ]] && [[ ! -d "$gitdir" ]]; then
      suggestion="ORPHANED worktree (gitdir missing) — recover or delete; do NOT move"
    else
      suggestion="git checkout — belongs in worktrees/; move with git worktree, not mv"
    fi
    size="$(du -sh "$entry" 2>/dev/null | cut -f1 || echo '?')"
    printf '  %-32s %6s  → %s\n' "$base" "$size" "$suggestion"
    continue
  fi

  if [[ -d "$entry" ]]; then
    case "$base" in
      *data*|*fixtures*|*dump*|*db*) suggestion="data/" ;;
      *doc*|*note*|*handoff*|*brief*) suggestion="notes/" ;;
      *bin|*scripts*)                 suggestion="bin/" ;;
      *)                              suggestion="notes/ or data/ (inspect contents)" ;;
    esac
  else
    case "$base" in
      *.sql|*.csv|*.dump|*.tar|*.tar.gz|*.zip|*.parquet|*.db|*.sqlite) suggestion="data/" ;;
      *.md|*.txt|*.pdf)                                                suggestion="notes/" ;;
      *.sh|*.py|*.rb)                                                  suggestion="bin/" ;;
      *)                                                               suggestion="scratch/ if disposable" ;;
    esac
  fi

  size="$(du -sh "$entry" 2>/dev/null | cut -f1 || echo '?')"
  printf '  %-32s %6s  → %s\n' "$base" "$size" "$suggestion"
done < <(find "$root" -mindepth 1 -maxdepth 1)

if [[ $found_loose -eq 0 ]]; then
  echo "  (none)"
fi

echo
if [[ $apply -eq 1 ]]; then
  echo "Scaffold applied. Move loose entries yourself — the suggestions above are"
  echo "heuristics, and only you know which files still matter."
else
  echo "Dry run. Re-run with --apply to create directories and docs."
fi
