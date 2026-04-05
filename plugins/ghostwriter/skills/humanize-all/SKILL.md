---
name: humanize-all
description: Humanize all .md files in a folder by running the humanize loop for each file
user-invocable: true
---

# Humanize-All Skill

Runs the humanize loop (from `.claude/commands/humanize.md`) on every `.md` file in a folder.

**CRITICAL CONSTRAINT:** Subagents cannot spawn subagents. This skill runs in the main agent context and must spawn all subagents (Writer, Reviewer, Detector, ai-engineer) directly via the Task tool. It cannot delegate to `/humanize` as a subagent.

## Usage

```bash
/humanize-all chapters/ output/ path/to/config.yml
/humanize-all chapters/ output/ path/to/config.yml --parallel 3
/humanize-all chapters/ output/ path/to/config.yml --parallel 2 max-rounds=5
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<input-folder>` | yes | — | Directory with `.md` files to humanize |
| `<output-folder>` | yes | — | Directory for final humanized files |
| `<config>` | yes | — | Path to YAML config file |
| `--parallel N` | no | `1` | Max concurrent files being processed |
| `max-rounds=N` | no | `5` | Max humanize rounds per file |

## Variables

- `INPUT_FOLDER`: First argument
- `OUTPUT_FOLDER`: Second argument
- `CONFIG`: Third argument
- `PARALLEL`: `--parallel` value, default `1`
- `MAX_ROUNDS`: `max-rounds=` value, default `5`

---

## How It Works

The humanize loop for a single file has sequential steps within each round:

```
Writer → Reviewer (→ Writer Fix → Re-review) → Detector → ai-engineer → next round
```

With `--parallel N`, the skill processes N files simultaneously by batching the same step across files. For example, with 3 files in parallel:

1. Spawn 3 Writer tasks simultaneously, wait for all
2. Spawn 3 Reviewer tasks simultaneously, wait for all
3. For files needing fixes: spawn Writer Fix tasks, wait, then re-review
4. Spawn 3 Detector tasks simultaneously, wait for all
5. For files that didn't pass: spawn ai-engineer tasks, wait
6. Next round for files still in progress

Files that pass detection are removed from the active batch. Files that hit MAX_ROUNDS are marked failed and removed.

---

## Step 0: Validate & Setup

1. Verify `.ghostwriter/config.json` exists in the current directory. Abort if not.
2. Verify `CONFIG` exists. Abort if not.
3. Verify `INPUT_FOLDER` exists and contains `.md` files (top-level only). Abort if empty.
4. Create `OUTPUT_FOLDER`.
5. Collect list of all `.md` files → `FILES[]`.
6. Resolve `PUB_ROOT` from CONFIG path: `PUB_ROOT = dirname(CONFIG)`
7. For each file, set up a session directory:

```bash
PUB_ROOT="$(dirname "{CONFIG}")"
# Compute next run number
LAST_RUN=$(ls -1 "$PUB_ROOT/pipeline/{BASENAME}/runs/" 2>/dev/null | grep -E '^run-[0-9]+$' | sed 's/run-//' | sort -n | tail -1)
NNN=$(printf "%03d" $(( ${LAST_RUN:-0} + 1 )))
SESSION="$PUB_ROOT/pipeline/{BASENAME}/runs/run-$NNN"
mkdir -p "$SESSION/current" "$SESSION/rounds" "$SESSION/debug"
cp "{CONFIG}" "$SESSION/config.yml"
cp "{INPUT_FOLDER}/{FILENAME}" "$SESSION/input.md"
yq 'del(.rules)' "$SESSION/config.yml" > "$SESSION/author-context.yml"
```

8. Initialize learnings log in each session.
9. Report:

```
Humanize-All: {N} files, parallel={PARALLEL}, max-rounds={MAX_ROUNDS}
Config: {CONFIG}

Files:
- file1.md
- file2.md
...
```

---

## Step 1: Process Files

Maintain a tracking table:

| Field | Description |
|-------|-------------|
| `basename` | Filename stem |
| `session` | Session directory path |
| `round` | Current round number (starts at 1) |
| `status` | `active` / `passed` / `failed` |
| `score` | Latest AI signal score |
| `confidence` | Latest confidence % |

### Batch Processing Loop

While there are `active` files:

1. Take up to `PARALLEL` active files as the current batch
2. Execute one humanize round for the batch (see below)
3. Update tracking: mark files as `passed` or `failed`, increment round
4. Files that passed: copy output to `{OUTPUT_FOLDER}/{BASENAME}.md`
5. Files at `round > MAX_ROUNDS` that haven't passed: mark `failed`

### One Round for a Batch

Follow the steps from `.claude/commands/humanize.md`, but spawn tasks for all batch files in parallel at each step.

**Read humanize.md first.** It is the source of truth for prompt templates, display conventions, and session file layout. The steps below are a summary — use the exact prompts and process from humanize.md.

#### Round Step 1: Writer

Spawn Writer tasks for all batch files simultaneously using the Task tool. Use the **Step 1** prompt template from humanize.md with each file's session path.

- Round 1: Writer applies Learned Patterns only
- Round N > 1: Writer also receives `feedback.md`
- Model: `opus`, subagent_type: `writer`

Wait for all to complete.

#### Round Step 2: Review Loop (max 2 iterations)

Spawn Reviewer tasks for all batch files simultaneously. Use the **Step 1.5a** prompt from humanize.md.

- Model: `sonnet`, subagent_type: `general-purpose` (NOT `reviewer` — that type isn't registered)
- The reviewer prompt in humanize.md includes the full process inline (config awareness, tool commands, report format)

Wait for all. For files that return "needs-revision":

- Spawn Writer Fix tasks in parallel (Step 1.5b from humanize.md)
- Wait, then spawn Reviewer again for those files
- If still failing after 2 iterations, proceed anyway

#### Round Step 3: Detector

Spawn Detector tasks for all batch files simultaneously. Use the **Step 2** prompt from humanize.md.

- Model: `sonnet`, subagent_type: `slop-detector`
- Detector is blind — never reveal revision context

Wait for all. Parse the 3-line return values.

#### Round Step 4: Check Success

For each file, check the SUCCESS_CONDITION from humanize.md:

```
classification == "likely_human"
AND (confidence > 80% OR AI Signal Score < 0.26)
```

- **Passed**: mark `status: passed`, copy to output folder
- **Not passed, round < MAX_ROUNDS**: continue to Step 5
- **Not passed, round == MAX_ROUNDS**: mark `status: failed`

Update learnings log for each file.

#### Round Step 5: Archive & Improve

For files still active:

1. Run `"$GHOSTWRITER_ROOT/agent/tools/version-round.sh" "{SESSION}"` for each file
2. Spawn ai-engineer tasks in parallel (Step 5 from humanize.md)
   - Model: `opus`, subagent_type: `ai-engineer`

Wait for all. Note changes for next ledger update.

#### Display

After each step, show a compact progress table:

```
━━━ Round {N}/{MAX_ROUNDS} — Step: {Writer|Review|Detection|Engineer} ━━━

| File | Status | Score | Confidence | Round |
|------|--------|-------|------------|-------|
| ch06 | active | 0.31  | 62%        | 2     |
| ch07 | passed | 0.23  | 78%        | 1     |
| ch08 | active | 0.28  | 70%        | 2     |
```

---

## Step 2: Final Report

```
Humanize-All Complete
=====================
Config:  {CONFIG}
Input:   {INPUT_FOLDER}
Output:  {OUTPUT_FOLDER}

| File | Status | Rounds | Final Score | Confidence |
|------|--------|--------|-------------|------------|
| ch06.md | passed | 3 | 0.22 | 80% |
| ch07.md | passed | 1 | 0.23 | 78% |
| ch08.md | failed | 5 | 0.31 | 62% |

Passed: 2/3 (copied to output)
Failed: 1/3
```

For failed files, read their final `feedback.md` and list the top 3-5 blocking issues.

---

## Step 3: Cleanup

Session directories in `{PUB_ROOT}/pipeline/` are left intact for debugging. The user can delete them manually if desired.

---

## Notes

- **humanize.md is the source of truth** for all prompt templates, session file layout, and display conventions. This skill only adds the batch/parallel orchestration layer.
- **ai-engineer modifies shared agent files** (writer.md, reviewer.md). When processing files in parallel, improvements from one file's feedback benefit all subsequent rounds of other files.
- **Files progress independently.** A file that passes in round 1 is immediately copied to output and removed from the batch, freeing a slot for the next batch.
