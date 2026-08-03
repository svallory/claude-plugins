#!/usr/bin/env bash
# Retrofit the container layout onto an existing container.
# Usage: hyperdev-adopt.sh [container-root] [--apply]
#
# Without --apply this only reports. Nothing moves until you pass --apply,
# and even then only the directory scaffold and docs are written — loose files
# are always listed as suggestions for a human to act on.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/hyperdev-lib.sh"

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
    echo "pass a path explicitly, or use hyperdev-init.sh to create one" >&2
    exit 1
  }
fi

root="$(cd "$root" && pwd)"

# adopt is the command that performs the opt-in, so it must accept a plain
# repository that container_layout would still reject. Any git root qualifies;
# detection tightens again once the marker exists.
if ! git -C "$root" rev-parse --git-dir >/dev/null 2>&1; then
  echo "not a git repository: $root" >&2
  exit 1
fi

if [[ ! -d "$root/.git" ]]; then
  echo "not a repository root: $root" >&2
  echo "this looks like a linked worktree; adopt the container it belongs to" >&2
  exit 1
fi

name="$(basename "$root")"
# Fall back by inspecting core.bare directly, since container_layout declines
# to classify a checkout that has not opted in yet.
layout="$(container_layout "$root" 2>/dev/null)" || {
  if [[ "$(git --git-dir="$root/.git" config --get core.bare 2>/dev/null)" == "true" ]]; then
    layout=bare
  else
    layout=checkout
  fi
}

echo "Container: $root"
echo "Layout:    $layout"
if [[ "$layout" == checkout ]]; then
  echo "           code lives at the root; worktrees in .claude/worktrees/;"
  echo "           local-only dirs are protected by .gitignore"
fi
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
  wt_abs_dry="$(worktrees_dir "$root")" || wt_abs_dry="$root/worktrees"
  for d in "${CONTAINER_DIRS[@]}"; do
    if [[ "$d" == worktrees ]]; then
      target="$wt_abs_dry"; label="${wt_abs_dry#"$root"/}"
    else
      target="$root/$d"; label="$d"
    fi
    if [[ -d "$target" ]]; then
      echo "  exists   $label/"
    else
      echo "  would create  $label/  — $(dir_purpose "$d")"
    fi
  done
  [[ -f "$root/HYPERDEV.md" ]] \
    && echo "  exists   HYPERDEV.md" \
    || echo "  would create  HYPERDEV.md"
  [[ "$layout" == checkout ]] \
    && echo "  would ensure  .gitignore covers data/ notes/ scratch/ bin/"
fi

echo
if [[ "$layout" == checkout ]]; then
  # In a checkout the root is full of tracked source files. Listing those as
  # "loose" would be nonsense, so only consider what git does not track.
  echo "Untracked/ignored entries at root (suggestions only — nothing is moved):"
else
  echo "Loose entries at container root (suggestions only — nothing is moved):"
fi

found_loose=0
while IFS= read -r entry; do
  base="$(basename "$entry")"

  # Skip the structural pieces and the directories we manage.
  case "$base" in
    .git|.claude|HYPERDEV.md|.DS_Store) continue ;;
  esac

  # Checkout layout: anything git tracks is source, not a stray local file.
  if [[ "$layout" == checkout ]]; then
    git -C "$root" ls-files --error-unmatch "$base" >/dev/null 2>&1 && continue
  fi
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

  # Tool-managed directories and local secrets must stay exactly where they
  # are: their location is part of a contract with a package manager, build
  # tool, or runtime. Moving them breaks the project.
  case "$base" in
    node_modules|.turbo|.cache|.next|.nuxt|.svelte-kit|dist|build|out|coverage|target|vendor|.venv|venv|__pycache__|.pytest_cache|.gradle|.angular|.parcel-cache|.vite)
      size="$(du -sh "$entry" 2>/dev/null | cut -f1 || echo '?')"
      printf '  %-32s %6s  → %s\n' "$base" "$size" \
        "tool-managed — leave in place (delete to reclaim space, never move)"
      continue ;;
    .env|.env.*|*.pem|*.key|id_rsa|id_ed25519|.npmrc|.netrc)
      size="$(du -sh "$entry" 2>/dev/null | cut -f1 || echo '?')"
      printf '  %-32s %6s  → %s\n' "$base" "$size" \
        "local secrets — leave in place; tools read this exact path"
      continue ;;
  esac

  if [[ -d "$entry" ]]; then
    case "$base" in
      *data*|*fixtures*|*dump*|*db*) suggestion="data/" ;;
      *doc*|*note*|*handoff*|*brief*) suggestion="notes/" ;;
      *bin|*scripts*)                 suggestion="bin/" ;;
      *result*|*report*|*output*)     suggestion="scratch/ (regenerated output)" ;;
      *)                              suggestion="notes/ or data/ (inspect contents)" ;;
    esac
  else
    case "$base" in
      # SQLite sidecars are live database state, not disposable scratch.
      *.sqlite-shm|*.sqlite-wal|*.db-shm|*.db-wal)
        suggestion="live DB sidecar — move only alongside its .sqlite/.db" ;;
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
