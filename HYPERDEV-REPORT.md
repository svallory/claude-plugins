# hyperdev — build report and roadmap

Written 2026-08-03. Branch `feat/hyperdev-plugin` (pushed; the earlier
`feat/container-plugin` remote branch is the same work under its original name
and can be deleted). Version `0.2.0`. Not yet merged to `main`.

---

## What it is

Two things that turned out to belong together:

1. **Project containers.** A fixed directory shape per project — the git repo,
   every worktree, and a small set of directories for files that must never be
   committed.
2. **Toolchain integration.** A `PostToolUse` hook that runs the project's *own*
   linter or typechecker after each edit and feeds failures straight back.

The second exists because of [hyperdev.saulo.engineer](https://hyperdev.saulo.engineer).
Of its five principles, **Tools Integration** and **Real-time Feedback** are the
two a Claude Code plugin can actually deliver today. *Deterministic First* and
*Engineered Friction* need generators and complexity scoring; *Reactive Context*
is partly covered by the SessionStart hook. The site's `hyper gen` / `tools` /
`plan` / `watch` / `dash` toolkit does not exist yet, so nothing here stubs it.

---

## Layouts

Both are first-class, because converting between them means re-cloning.

### bare

```
<container>/
├── .git/         bare — no working tree
├── .claude/      settings + memory
├── worktrees/    one checkout per branch
├── data/  notes/  scratch/  bin/
└── HYPERDEV.md
```

The root cannot be committed to. Local-only files get a home that is
*structurally* incapable of reaching the remote.

### checkout

```
<project>/            ordinary working tree, code at the root
├── .git/
├── src/ …            tracked source
├── .claude/worktrees/
├── data/  notes/  scratch/  bin/   ← gitignored
└── HYPERDEV.md
```

The root **is** the repo, so the safety property inverts: local-only dirs are
protected by `.gitignore`, not by construction. A top-level `worktrees/` would
sit inside the working tree, so worktrees live under `.claude/`.

---

## Current surface

| Path | Lines | Purpose |
|---|---|---|
| `scripts/hyperdev-lib.sh` | 349 | layout detection, scaffolding, docs, gitignore |
| `scripts/hyperdev-adopt.sh` | 255 | retrofit onto an existing repo |
| `scripts/hyperdev-check.sh` | 122 | PostToolUse check hook |
| `scripts/hyperdev-init.sh` | 87 | create a new container from a remote |
| `scripts/hyperdev-stack.sh` | 67 | stack dispatcher |
| `scripts/hyperdev-context.sh` | 73 | SessionStart context hook |
| `stacks/node/detect.sh` | 113 | npm / pnpm / yarn / bun + TypeScript |
| `stacks/go/detect.sh` | 42 | go, golangci-lint, Makefile |
| `skills/hyperdev/SKILL.md` | 157 | layout conventions |
| `skills/hyperdev-tooling/SKILL.md` | 101 | toolchain detection rules |
| `commands/{init,adopt,audit,tools}.md` | 300 | four commands |

Registered in `.claude-plugin/marketplace.json`.

---

## The design rule that drove everything

**Report only what is verifiable. Absence means unknown, never a default.**

Three real projects proved why:

| Project | Detected |
|---|---|
| compliance | npm, **no lint script** despite an eslint config, `tsc`, prettier |
| rcl-tree-sitter | bun, every script delegates to `moon`, biome |
| Go fixture | golangci-lint **configured but not installed** |

So detection omits keys it cannot prove. A missing `LINT` means "this project
has no lint script" — not "try `npm run lint`". With no lockfile the package
manager resolves to `unknown` and the hook **declines to run** rather than
defaulting to npm, which would rewrite a bun project's lockfile.

The failure mode this avoids: a check that fails on every edit gets ignored
within a day, and the real failures get ignored with it.

---

## How it was validated

Two clean-room rounds. A subagent with **no context** was given only the goal
and the plugin path, then asked what confused it and what broke.

**Round 1** found:
- `.gitignore` entries duplicated when a path was already covered by
  `.git/info/exclude` → now asks `git check-ignore`
- dead checkouts inside `worktrees/` invisible to the maxdepth-1 scan → now
  listed as ok / orphaned / leftover build output
- "exit 0" was not sufficient verification under a build cache

One round-1 finding was **wrong**: it reported a phantom-pass typecheck caused
by turbo stripping `PROTO_HOME`. It did not reproduce — with `--force` all six
packages ran `tsc` in 5.8s and an injected `TS2322` failed correctly. The
agent's own environment, not the project. Not acted on; the doc weakness it
exposed was real and was fixed.

**Round 2** found:
- adopt suggested filing `pubflow.sqlite` under `data/` while separately warning
  its `-wal`/`-shm` sidecars were live state. The app resolves `PUBFLOW_DB` to a
  **relative** path, so the move would have silently created an empty database.
  Now flagged do-not-move.
- gitignored paths (`test-results`, `.turbo`) suggested for moving, when tooling
  recreates them in place. First fix over-corrected and suppressed every useful
  suggestion; ignore status is now a caution annotation, and specific rules win.
- `write_memory_seed` skipped the index line when present, so an interrupted run
  left a dangling pointer a later run treated as done. Now rewrites.
- No stated command order — both agents independently guessed, and both noted
  `init` does not apply to an existing project.

Also fixed from real use: configuring the hook against compliance surfaced that
**hooks do not inherit the shell**. `npm run typecheck:server` worked in a
terminal but failed under the hook with `proto::detect::failed`; and relative
paths resolve against the *config's* directory, so a container-root config using
`./node_modules/.bin/tsc` cannot work in the bare layout.

---

## Known gaps

### Real limitations

1. **`init` only creates bare containers.** `hyperdev-init.sh` has no notion of
   the checkout layout — it always bare-clones. Adopting an existing checkout
   works; creating one does not.
2. **`audit` has no script.** It is a markdown checklist that wraps the adopt dry
   run plus judgement checks. The command list implies parity with the other
   three that does not exist. Either write the mechanical half or keep saying so
   plainly.
3. **Nothing ever deletes.** Orphaned worktrees, stale branches, and an oversized
   `scratch/` are reported for a human to act on. Defensible, but it means the
   plugin can detect debris it will not clear.
4. **The check hook runs one command.** No lint-and-typecheck, no per-language
   routing in a polyglot repo, no incremental "only the edited file" mode. On a
   large codebase a full typecheck per edit is too slow, and the only lever is
   `extensions` plus `timeout`.
5. **Monorepo blind spot.** A package with no `typecheck` script is silently
   skipped: the hook fires, the command runs, it passes, and the edited file was
   never inspected. Documented in `tools.md`; not detected automatically.
6. **`command` executes arbitrary code from a repo file.** An untrusted checkout
   runs it on first edit. Documented rather than sandboxed.

### Missing infrastructure

7. **No tests.** Not one. Every fix in this report was verified by hand against
   real repos and throwaway fixtures. Bash is testable — `bats` or even a plain
   script over fixture directories would pin layout detection, the gitignore
   dedup, and the adopt suggestion matrix.
8. **No CI.** Nothing runs `bash -n`, let alone shellcheck.
9. **No README.** `REPORT.md` (this file) and the two skills are the only prose.

---

## What to do next, roughly in order

### High value, low effort

- **`bats` (or plain-bash) tests over fixture repos.** The highest-value gap.
  Fixtures for: bare container, checkout container, plain repo (must NOT match),
  linked worktree (must NOT match as root), and a repo with `info/exclude`
  coverage. This is where regressions will come from.
- **shellcheck + `bash -n` in CI.** All six scripts are `set -euo pipefail`;
  shellcheck would catch quoting bugs before a user does.
- **A README** covering the two layouts and the four commands. Currently a user
  has to read `SKILL.md` to learn what the plugin is.
- **Make `audit` real** — a script for the mechanical checks (stale branches,
  dirty worktrees, `scratch/` size, large loose files, secret-looking filenames),
  keeping the judgement calls in markdown.

### Medium

- **`init` for checkout containers.** `git clone` + scaffold + gitignore, sharing
  `scaffold_dirs`/`ensure_gitignored` with adopt. Mostly plumbing.
- **More stacks.** Adding one means a `stacks/<name>/detect.sh` with
  `stack_matches` + `stack_detect` — no dispatcher edit. Rust (`Cargo.toml`),
  Python (`pyproject.toml`, and the uv/poetry/pip split), Deno, Elixir.
- **Multi-command checks.** `"checks": [{run, extensions, timeout}, …]` so lint
  and typecheck can both fire on the files each cares about.
- **Detect the monorepo coverage hole.** Compare packages the check command
  touches against the workspace list; warn when a package has no script.
- **A cleanup command** (`/hyperdev:prune`) for the debris audit reports —
  explicit, confirmed, never automatic.

### Speculative

- **Per-file checks.** `tsc --noEmit <file>` is wrong for a project with path
  aliases, but `eslint <file>` is exactly right and much faster. Worth routing
  per tool.
- **A `worktrunk` bridge.** The checkout layout does not match the user-level
  `worktree-path` template (`{{ repo_path }}/../worktrees/…`), so `wt switch`
  places new worktrees outside `.claude/worktrees/`. Either generate a
  project-level `.config/wt.toml` during adopt, or document the mismatch harder
  than the current one paragraph in `SKILL.md`.
- **Container-level check config.** Today the config must live in the worktree
  because relative paths resolve against it. A container-level default that each
  worktree inherits — with paths resolved against the *edited file's* worktree —
  would remove the duplication.

---

## Notes for whoever picks this up

- **Never edit `~/.claude/plugins/marketplaces/svallory-plugins`.** It
  auto-updates and will discard uncommitted work. Develop in
  `~/work/claude-plugins`, commit, push.
- Adding a plugin needs **both** `plugins/<name>/` and an entry in
  `.claude-plugin/marketplace.json`. It is invisible without the second.
- Test hook changes by piping hook JSON into the script, not by running the
  command in a shell — only that exercises the real environment:

  ```bash
  echo '{"tool_input":{"file_path":"/abs/path/to/real.ts"}}' \
    | bash plugins/hyperdev/scripts/hyperdev-check.sh; echo "exit=$?"
  ```

  Exit 0 on a clean file, exit 2 on one with a deliberate error. If it cannot
  fail, it is not a check.
