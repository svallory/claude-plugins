#!/usr/bin/env bash
# Retrofit the space layout onto an existing space.
# Usage: hyperdev-adopt.sh [space-root] [--apply]
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
  root="$(find_space_root "$PWD")" || {
    echo "not inside a space (no bare .git + worktrees/ found)" >&2
    echo "pass a path explicitly, or use hyperdev-init.sh to create one" >&2
    exit 1
  }
fi

root="$(cd "$root" && pwd)"

# adopt is the command that performs the opt-in, so it must accept a plain
# repository that space_layout would still reject. Any git root qualifies;
# detection tightens again once the marker exists.
if ! git -C "$root" rev-parse --git-dir >/dev/null 2>&1; then
  echo "not a git repository: $root" >&2
  exit 1
fi

if [[ ! -d "$root/.git" ]]; then
  echo "not a repository root: $root" >&2
  echo "this looks like a linked worktree; adopt the space it belongs to" >&2
  exit 1
fi

name="$(basename "$root")"
# Fall back by inspecting core.bare directly, since space_layout declines
# to classify a checkout that has not opted in yet.
layout="$(space_layout "$root" 2>/dev/null)" || {
  if [[ "$(git --git-dir="$root/.git" config --get core.bare 2>/dev/null)" == "true" ]]; then
    layout=bare
  else
    layout=checkout
  fi
}

echo "Space: $root"
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
  # Additive only, as the docs promise: these files are the user's to edit
  # once they exist, so a re-adopt must never regenerate over their changes.
  if [[ -f "$root/HYPERDEV.md" ]]; then
    echo "  exists   HYPERDEV.md (left untouched)"
  else
    write_hyperdev_md "$root" "$name"
    echo "  wrote    HYPERDEV.md"
  fi
  if [[ -f "$root/.claude/memory/hyperdev-layout.md" ]]; then
    echo "  exists   .claude/memory/hyperdev-layout.md (left untouched)"
  else
    write_memory_seed "$root" "$name"
    echo "  wrote    .claude/memory/hyperdev-layout.md"
  fi
else
  echo "Directories (dry run):"
  wt_abs_dry="$(worktrees_dir "$root")" || wt_abs_dry="$root/worktrees"
  for d in "${SPACE_DIRS[@]}"; do
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
  echo "Loose entries at space root (suggestions only — nothing is moved):"
fi

found_loose=0
while IFS= read -r entry; do
  base="$(basename "$entry")"

  # Skip the structural pieces and the directories we manage.
  case "$base" in
    .git|.claude|HYPERDEV.md|.DS_Store) continue ;;
  esac

  # /hyperdev:gen keeps bare-layout templates at <space>/templates/, so that
  # directory is managed, not a stray. (Checkout templates live under
  # .claude/templates/ and a root templates/ there really is loose.)
  [[ "$layout" != checkout && "$base" == templates && -d "$entry" ]] && continue

  # Checkout layout: anything git tracks is source, not a stray local file.
  if [[ "$layout" == checkout ]]; then
    git -C "$root" ls-files --error-unmatch "$base" >/dev/null 2>&1 && continue
  fi
  skip=0
  for d in "${SPACE_DIRS[@]}"; do
    [[ "$base" == "$d" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue

  found_loose=1

  # Suggest a destination by shape: big binaries and dumps to data/,
  # markdown and docs to notes/, executables to bin/, rest unclassified.
  suggestion=""
  if [[ -e "$entry/.git" ]]; then
    # A checkout sitting at the space root — never a data/ or notes/ file.
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

  # Being gitignored is a hint, not a verdict: a stray zip and a build cache are
  # both ignored, but only one is safe to file away. It is recorded here and
  # used to soften the wording, after the specific rules below have had a say.
  ignored=0
  if [[ "$layout" == checkout ]] \
     && git -C "$root" check-ignore -q "$base" 2>/dev/null; then
    ignored=1
  fi

  # A live database must not be moved: connection strings routinely use a
  # relative path, so moving it silently creates a fresh empty database
  # instead of failing loudly.
  case "$base" in
    *.sqlite|*.sqlite3|*.db|*.duckdb)
      size="$(du -sh "$entry" 2>/dev/null | cut -f1 || echo '?')"
      # Existence test, not compgen -G: a glob would let [ ? * in the DB's
      # own filename defeat (or false-positive) the liveness check.
      if [[ -e "$entry-wal" || -e "$entry-shm" ]]; then
        printf '  %-32s %6s  → %s\n' "$base" "$size" \
          "LIVE database (has -wal/-shm) — do not move; check the app's connection path first"
      else
        printf '  %-32s %6s  → %s\n' "$base" "$size" \
          "database — move to data/ only after confirming no relative path points here"
      fi
      continue ;;
  esac

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
      *.sql|*.csv|*.dump|*.tar|*.tar.gz|*.zip|*.parquet|*.db|*.sqlite|*dump*) suggestion="data/" ;;
      *.md|*.txt|*.pdf)                                                suggestion="notes/" ;;
      *.sh|*.py|*.rb)                                                  suggestion="bin/" ;;
      *)
        # Unrecognized extension: size decides. A big blob is data until
        # proven disposable (audit draws the same 10MB line — the two
        # commands must not give the same file opposite destinations).
        if [[ -n "$(find "$entry" -maxdepth 0 -size +10M 2>/dev/null)" ]]; then
          suggestion="data/ (large blob) — or scratch/ only if truly disposable"
        else
          suggestion="scratch/ if disposable"
        fi ;;
    esac
  fi

  # An ignored path may be one tooling recreates in place. Flag it so the
  # suggestion is checked before acting, without suppressing it outright.
  [[ $ignored -eq 1 ]] && suggestion="$suggestion  [gitignored — confirm nothing recreates it here]"

  size="$(du -sh "$entry" 2>/dev/null | cut -f1 || echo '?')"
  printf '  %-32s %6s  → %s\n' "$base" "$size" "$suggestion"
done < <(find "$root" -mindepth 1 -maxdepth 1)

if [[ $found_loose -eq 0 ]]; then
  echo "  (none)"
fi

# The loose-file scan above is maxdepth 1, so debris *inside* the worktrees
# directory never surfaces. Dead checkouts accumulate there — a removed
# worktree leaves build output behind, and it looks like a live branch until
# you inspect it.
wt_scan="$(worktrees_dir "$root" 2>/dev/null)" || wt_scan=""
if [[ -n "$wt_scan" && -d "$wt_scan" ]]; then
  echo
  echo "Worktree directory (${wt_scan#"$root"/}):"
  wt_found=0
  for w in "$wt_scan"/*/; do
    [[ -d "$w" ]] || continue
    wname="$(basename "$w")"
    wt_found=1
    if [[ ! -e "$w/.git" ]]; then
      wsize="$(du -sh "$w" 2>/dev/null | cut -f1 || echo '?')"
      printf '  %-32s %6s  → %s\n' "$wname" "$wsize" \
        "no .git — leftover build output, not a worktree; safe to delete"
    elif [[ -f "$w/.git" ]] \
         && wgd="$(sed -n 's/^gitdir: //p' "$w/.git" 2>/dev/null)" \
         && [[ -n "$wgd" && ! -d "$wgd" ]]; then
      wsize="$(du -sh "$w" 2>/dev/null | cut -f1 || echo '?')"
      printf '  %-32s %6s  → %s\n' "$wname" "$wsize" \
        "ORPHANED — gitdir missing; recover or delete"
    else
      wbranch="$(git -C "$w" branch --show-current 2>/dev/null || echo '?')"
      printf '  %-32s %6s  → %s\n' "$wname" "" "ok [$wbranch]"
    fi
  done
  [[ $wt_found -eq 0 ]] && echo "  (empty)"
fi

echo
if [[ $apply -eq 1 ]]; then
  echo "Scaffold applied. Move loose entries yourself — the suggestions above are"
  echo "heuristics, and only you know which files still matter."
else
  echo "Dry run. Re-run with --apply to create directories and docs."
fi
