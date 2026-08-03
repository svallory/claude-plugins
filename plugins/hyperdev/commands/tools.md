---
name: tools
description: Detect the project's toolchain and set up the real-time check hook using the tools that project actually uses
argument-hint: [project-path]
---

# Tools

Wires HyperDev's *Tools Integration* and *Real-time Feedback* principles into a
project: after each edit, the project's own linter or typechecker runs and any
failure goes straight back to the agent.

The commands are **project-dependent**. Detect them; do not assume them.

## Step 1 — detect

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/hyperdev-stack.sh" detect [path]
```

Emits `KEY=VALUE` facts. Keys are omitted when not verifiable:

| Key | Meaning |
|---|---|
| `STACK` | `node`, `go`, or `unknown` |
| `PM` / `PM_RUN` | package manager and its run prefix (`bun run`, `npm run`, …) |
| `LINT` / `FORMAT` / `TYPECHECK` / `TEST` | the *script name* that exists in the project |
| `LINT_TOOL` / `TYPECHECK_TOOL` | underlying tool inferred from config files |
| `LINT_MISSING` | configured but not installed |

**A missing key means unknown, not "use the default."** `npm run lint` in a
project with no `lint` script fails every time and teaches everyone to ignore
the hook.

## Step 2 — ask when detection is incomplete

Read the results, then ask the user about anything unresolved:

- **No `TYPECHECK`/`LINT` key but `LINT_TOOL` or `tsconfig.json` present** — the
  tool is configured but has no script. Ask whether to add a script or invoke
  the binary directly.
- **`PM=unknown`** (no lockfile, no `packageManager` field) — ask which package
  manager. Never default to npm.
- **`LINT_MISSING`** — tell the user it is configured but not installed; ask
  whether to install it or skip the hook.
- **Both `LINT` and `TYPECHECK` exist** — ask which to run per-edit. Typecheck
  usually catches more real breakage; lint is usually faster. Running both on
  every edit is normally too slow.
- **`STACK=unknown`** — ask for the check command outright, or skip.

Prefer the project's own script name over a raw binary. Scripts already encode
flags, config paths, and monorepo wiring (`moon run :lint`, `tsc -p server/...`).

## Step 3 — write the config

Write `<project>/.claude/hyperdev.json`:

```json
{
  "check": {
    "enabled": true,
    "run": "typecheck",
    "extensions": [".ts", ".tsx"],
    "timeout": 60
  }
}
```

- `run` — a script name, invoked with the detected `PM_RUN`.
- `command` — an explicit command; overrides `run`. Use for Go or non-script
  entry points (`go build ./...`, `make lint`).
- `extensions` — restrict to files worth checking. Omit to check every edit.
- `timeout` — seconds; the check is killed past this and reported as a timeout.

The hook is inert until `enabled` is true, so a project that has not run this
command is unaffected.

## Step 4 — verify before claiming it works

Run the command manually first:

```bash
cd <project> && <the command>
```

Confirm it exits 0 on a clean tree. A check that fails on unmodified code will
fire on every edit and is worse than no check. If it fails, fix the command or
leave the hook disabled — do not enable it and hope.

**Exit 0 alone is not proof the check ran.** With a build cache (turbo, nx,
gradle, bazel) a replayed cache hit is indistinguishable from real work by exit
code. Confirm the check actually executes and actually fails:

```bash
bun run typecheck -- --force      # args after -- reach the underlying tool
bunx turbo run typecheck --force  # or invoke the runner directly
# nx: --skip-nx-cache   gradle: --rerun-tasks   bazel: --nocache_test_results
```

Watch the duration. A "passing" typecheck that finishes in 30ms did not run
`tsc`; a cold run takes seconds. Then prove it detects a real fault — add a
file with a deliberate type error, confirm non-zero exit and the error in the
output, and delete it. A check that cannot fail is worse than none, because it
reports safety that does not exist.

Also confirm the check actually covers the files the hook will fire on. In a
monorepo, a package with no `typecheck` script is silently skipped: editing a
file there matches the extension filter, runs the command, and passes without
ever inspecting the file. Compare the packages the command touches against the
workspace list, and either narrow `extensions` or note the gap.

## Security

`command` is executed as written, from a file inside the repository. A checkout
you do not trust can therefore run arbitrary code the first time you edit a
file in it.

Read `.claude/hyperdev.json` before enabling the hook in an unfamiliar repo,
the same way you would read a `Makefile` before running `make`. Prefer `run`
(a script name) over `command` where possible: it still resolves through
`package.json`, but it keeps the moving part in one place the team reviews.

## Notes

- Config lives in the project's `.claude/`, so it is committed and shared with
  the team; the container-level `.claude/` is local-only.
- Timeouts matter: a 3-minute typecheck on every edit makes the agent unusable.
  For large projects prefer a fast scoped command, or lint over typecheck.
