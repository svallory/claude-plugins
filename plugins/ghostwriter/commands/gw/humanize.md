---
name: humanize
description: Run iterative text revision sessions
disable-model-invocation: true
argument-hint: <input-file> [output-file] [publication|config] [--session DIR] [--quick] [max-rounds=N]
---

# Humanize Command

Orchestrates text revision sessions. Spawns subagents for detection, optimization, and revision.

This command uses `disable-model-invocation: true` to prevent auto-loading. The Detector subagent must remain a blind evaluator — it should not know that text may have been revised.

**IMPORTANT:** THIS COMMAND MUST BE EXECUTED DIRECTLY BY THE MAIN AGENT. DO NOT CREATE A TASK TO RUN IT.

## Prerequisites

Before running, ensure:
1. The ghostwriter plugin is loaded (`ghostwriter-env.sh` must be on PATH)
2. Run `/gw:setup` if `.ghostwriter/` directory doesn't exist

Set up the plugin root for tool invocations:
```bash
eval "$(ghostwriter-env.sh)"
```

### Quick Mode (--quick)

When `--quick` is passed, skip the iterative detection loop. Instead:
1. Spawn Writer agent (same as Step 1 of the full loop)
2. Writer applies Learned Patterns and config rules in a single pass
3. Write output and exit — no Reviewer, no Detector, no AI Engineer

This is equivalent to a single-pass rewrite. Use for quick touch-ups when you don't need full detection validation.

## Publication Name Resolution

Commands accept a **publication name** instead of a config path. When the last argument matches a directory in `.ghostwriter/publications/`, it's treated as a publication name:

```bash
# Resolve publication config
PUB_NAME="{last argument}"
PUB_DIR=".ghostwriter/publications/$PUB_NAME"
CONFIG="$PUB_DIR/config.yml"
```

If `$PUB_DIR` exists and contains `config.yml`, use it. Otherwise, treat the argument as a literal file path (backwards compatible).

When using a publication name:
- **Content root**: read from `config.content.root` (relative to config file, resolve to absolute)
- **File paths**: relative to the content root
- **Pipeline data**: stored at `$PUB_DIR/pipeline/`
- **Learned patterns**: resolved from `.ghostwriter/` hierarchy

## Usage

```bash
/gw:humanize input.md output.md path/to/config.yml
/gw:humanize guides/getting-started.md developer-docs
/gw:humanize-all developer-docs
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<input-file>` | yes | — | Path to the `.md` file to humanize (relative to content root when publication name is given) |
| `<output-file>` | no* | in-place or next stage | Path where the final humanized file will be written. When publication name is used, defaults to in-place overwrite (or next stage directory if stages are defined in config). |
| `[config]` | no* | — | Publication name (resolved to `.ghostwriter/publications/{name}/config.yml`) or a literal path to a YAML config file. Required unless publication name is given. |
| `--session DIR` | no | derived | Directory for session working files. Defaults to `{PUB_DIR}/pipeline/{BASENAME}/runs/run-{NNN}/` when publication name is given, or `{PUB_ROOT}/pipeline/{BASENAME}/runs/run-{NNN}/` otherwise |
| `--quick` | no | — | Single-pass rewrite without detection loop. Fast but less thorough. |
| `max-rounds=N` | no | `5` | Maximum humanize rounds |

## Variable Resolution

- `INPUT_FILE`: First argument — source `.md` file. If publication name resolved, interpret relative to content root.
- `OUTPUT_FILE`: Second argument if provided and not a publication name/config. When publication name is used and no output file given, output in-place (or next stage if stages are defined in config).
- `CONFIG`: Last non-flag argument — if it matches a directory under `.ghostwriter/publications/`, treat as a publication name and resolve to `$PUB_DIR/config.yml`. Otherwise treat as a literal YAML file path.
- `PUB_ROOT`: Parent directory of `CONFIG` (e.g., `publications/rcs-book/` if CONFIG is `publications/rcs-book/config.yml`). When publication name is given, `PUB_ROOT = PUB_DIR`.
- `SESSION_PATH`: Value of `--session` flag, or defaults to `{PUB_ROOT}/pipeline/{BASENAME}/runs/run-{NNN}/` where `NNN` is the next available run number (zero-padded to 3 digits, e.g., `run-001`)
- `MAX_ROUNDS`: `max-rounds=` value, default `5`
- `BASENAME`: Filename stem of `INPUT_FILE` (e.g., `chapter-01` from `chapter-01.md`)

---

## Session Setup

1. Verify `INPUT_FILE` exists. Abort if not.
2. Verify `CONFIG` exists. Abort if not.
3. Resolve `PUB_ROOT` from CONFIG path: `PUB_ROOT = dirname(CONFIG)`
4. Compute `NNN`: scan `{PUB_ROOT}/pipeline/{BASENAME}/runs/` for existing `run-*` dirs, take the highest number, add 1. If none exist, start at `001`.
5. Create `SESSION_PATH` if it doesn't exist.
6. Copy input and config into the session:

```bash
mkdir -p "{SESSION_PATH}/current"
mkdir -p "{SESSION_PATH}/rounds"
mkdir -p "{SESSION_PATH}/debug"
cp "{INPUT_FILE}" "{SESSION_PATH}/input.md"
cp "{CONFIG}" "{SESSION_PATH}/config.yml"
```

7. **Generate author context file** (config without rules):

```bash
yq 'del(.rules)' "{SESSION_PATH}/config.yml" > "{SESSION_PATH}/author-context.yml"
```

8. **Initialize learnings ledger:**

```bash
echo "# Learnings Log

Tracks what worked and what didn't across rounds.

---
" > "{SESSION_PATH}/learnings-log.md"
```

### Step 0.5: Resolve Learned Patterns

Read `{SESSION_PATH}/config.yml` to get `publication.media` and `author.name`.

**Note:** Presets in the config carry prose targets (density targets, structure thresholds). Tools resolve presets automatically when you pass `--config`. Do NOT manually read preset files.

Resolve the patterns file list (skip files that don't exist):
1. `.ghostwriter/learned-patterns/global.md`
2. `.ghostwriter/learned-patterns/{media}.md`
3. `.ghostwriter/learned-patterns/{media}-*.md` (glob for style-specific)
4. `.ghostwriter/authors/{author-slug}/learned-patterns.md` (slugify author.name)
5. `.ghostwriter/publications/{pub-slug}/learned-patterns.md` (pub-slug = basename of PUB_ROOT)

Store this as `PATTERNS_FILE_LIST` — a newline-separated list of paths.
Use it wherever `{PATTERNS_FILE_LIST}` appears in Writer prompts below.

## Architecture

```
Main Thread (Orchestrator)
    │
    ├─► Writer (Opus) ──► {BASENAME}.md
    │
    ├─► Review Loop (max 2 iterations):
    │   ├─► Reviewer (Sonnet):
    │   │   ├─ Phase 1: mechanical-cleanup.ts ──► cleanup-report.json (in-place fixes)
    │   │   └─ Phase 2: analysis tools ──► review-report.md
    │   └─► Writer Fix (Sonnet) ──► fixes {BASENAME}.md in-place
    │
    ├─► Detector (Sonnet) ──► heuristics-scores.json + feedback.md
    │
    ├─► [Check success + update learnings-log.md]
    │
    ├─► version-round.sh ──► rounds/r{N}/
    │
    └─► ai-engineer (Opus) ──► updates writer.md, reviewer.md (for next round)
```

## Progress Display

After each subagent completes, display a terse summary. Read the session JSON files — do not rely on subagent return values alone.

**Convention:**
- One header line per step (bold, with key metric)
- Tables where useful (pipe-delimited markdown)
- 5-15 lines max per step — no raw JSON dumps

### Round Separator

At the start of each round:
```
━━━ Round {N}/{MAX_ROUNDS} ━━━
```

### Per-Step Summaries

Display after each subagent returns, as specified inline in Steps 1-5. These are mandatory.

### Round Summary

After detection (before version-round.sh), display:
```
Round {N}: {classification} — score: {heuristicsScore}, confidence: {confidence}%
{if N > 1: "Delta: score {prev} → {new} ({+/-X}), confidence {prev}% → {new}% ({+/-Y}pp)"}
{if SUCCESS: "SUCCESS — copying to OUTPUT_FILE"}
{if N == MAX_ROUNDS and not met: "MAX ROUNDS reached"}
```

---

## Session Files

```
{SESSION_PATH}/
├── input.md                # Snapshot of INPUT_FILE (immutable)
├── config.yml              # Snapshot of CONFIG (immutable)
├── author-context.yml      # Generated: config minus rules (for Writer)
├── learnings-log.md        # Append-only across rounds
│
├── current/                # Latest working state (overwritten each round)
│   ├── {BASENAME}.md
│   ├── feedback.md
│   ├── heuristics-scores.json
│   ├── review-report.md
│   ├── cleanup-report.json
│   ├── fix-plan.json
│   ├── punctuation-analysis.json
│   ├── auxiliary-analysis.json
│   ├── pronoun-analysis.json
│   ├── structure-analysis.json
│   ├── noun-analysis.json
│   └── vocabulary-analysis.json
│
├── rounds/                 # Immutable snapshots per round
│   ├── r1/
│   │   ├── {BASENAME}.md
│   │   ├── feedback.md
│   │   └── heuristics-scores.json
│   └── r2/ ...
│
└── debug/                  # Debug traces per round
    ├── r1/
    │   ├── prompt-writer.md
    │   ├── prompt-detector.md
    │   └── prompt-optimizer.md
    └── r2/ ...
```

**Note:** Prompt files are automatically saved by the PreToolUse hook (`.claude/hooks/save-subagent-prompt.sh`). Each round gets its own folder in `debug/r{N}/`.

---

## Orchestration Instructions

Execute these steps directly in the main thread.

SUCCESS_CONDITION: (
  classification == "likely_human"
  AND (
    confidence > 80%
    OR
    AI Signal Score < 0.26
  )
)

### Step 1: Writer (Opus)

Call the `writer` Subagent.

Spawn with: `model: opus`, `subagent_type: writer`

**IMPORTANT:** INPUT is always `input.md` — the Writer revises the ORIGINAL draft in ONE PASS. No iterative revision of revisions.

**Round 1:** No feedback exists yet. The Writer applies its Learned Patterns and config rules to produce an initial revision.

**Round N > 1:** The Writer also receives the previous round's `feedback.md`.

```markdown
Revise text to sound more authentically human.

## Author Context
File: {SESSION_PATH}/author-context.yml

This contains the author's profile, personality, career background, and writing style preferences. Use this to maintain consistent voice and appropriate vocabulary.

## Config
File: {SESSION_PATH}/config.yml
Read this config to understand the writing rules, thresholds, and any disabled checks.
Your writing must respect these settings (e.g., punctuation preferences, density targets).

## Learned Patterns
Read the following files (if they exist) for writing patterns to apply:
{PATTERNS_FILE_LIST}

## Input
- Text to revise: {SESSION_PATH}/input.md
{{#if ROUND > 1}}
- Feedback: {SESSION_PATH}/current/feedback.md
{{/if}}

## Output
- Write revised text to: {SESSION_PATH}/current/{BASENAME}.md

## Key Instructions
- Match the author's voice and personality from the context file
- Respect the rules and thresholds in the config file
{{#if ROUND > 1}}
- Address the specific issues raised in feedback
{{/if}}
- Apply your Learned Patterns
- Preserve the core meaning and structure

## Return Format
CRITICAL: Return ONLY a single line: "success" or "failure: {reason}".
Do NOT include a changelog, explanation, or list of changes.
```

**Display:** `Writer: {result} (round {N})`

### Step 1.5: Review Loop

After the Writer produces output, run a review loop (max 2 iterations) to catch mechanical issues the Writer can't self-regulate during generation.

#### 1.5a: Reviewer

Spawn with `model: sonnet`, `subagent_type: reviewer`.

**Note:** The `reviewer` agent type is NOT registered in the Task tool. Use `general-purpose` and embed the reviewer instructions in the prompt.

```markdown
You are a Reviewer agent. You apply mechanical cleanup (deterministic in-place fixes), then run analysis tools on text and produce a prescriptive report. You NEVER generate replacement text yourself.

## CRITICAL: Data Freshness
- Run ALL analysis commands FIRST (Steps 1-2 below)
- Read JSON output files ONLY AFTER all commands have completed (Step 3)
- NEVER reference data from previous rounds or previous review reports
- Your report MUST match the JSON data exactly — if a JSON file says 19 em-dashes, report 19
- Do NOT paraphrase or interpret from memory. Copy numbers directly from the JSON files.

## Input
- Text file: {SESSION_PATH}/current/{BASENAME}.md
- Config: {SESSION_PATH}/config.yml

## Output
- Write review report to: {SESSION_PATH}/current/review-report.md
- Write analysis JSON files to: {SESSION_PATH}/current/ (punctuation-analysis.json, auxiliary-analysis.json, etc.)
- Write cleanup report to: {SESSION_PATH}/current/cleanup-report.json

## Process

### Step 0: Read Config
Read the config YAML file. Note any rules with `disabled: true` — skip those checks.

**You do NOT need to manually read preset files.** All tools resolve presets automatically when you pass `--config`. Just pass `--config` to every tool invocation and they will load the correct prose targets and thresholds (including preset overrides). Do NOT pass `--target-density` flags — let the tools resolve targets from config.

### Step 1: Run Mechanical Cleanup
```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/mechanical-cleanup.ts" "{SESSION_PATH}/current/{BASENAME}.md" --config "{SESSION_PATH}/config.yml" --out "{SESSION_PATH}/current/cleanup-report.json"
```

### Step 2: Run All Analyzers
```bash
TEXT="{SESSION_PATH}/current/{BASENAME}.md"
OUT_DIR="{SESSION_PATH}/current"
CONFIG="{SESSION_PATH}/config.yml"

bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-punctuation.ts" "$TEXT" --config "$CONFIG" --out "$OUT_DIR/punctuation-analysis.json" &
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-auxiliary-verbs.ts" "$TEXT" --config "$CONFIG" --out "$OUT_DIR/auxiliary-analysis.json" &
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-pronouns.ts" "$TEXT" --config "$CONFIG" --out "$OUT_DIR/pronoun-analysis.json" &
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-sentence-structure.ts" "$TEXT" --config "$CONFIG" --out "$OUT_DIR/structure-analysis.json" &
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-noun-density.ts" "$TEXT" --config "$CONFIG" --out "$OUT_DIR/noun-analysis.json" &
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-vocabulary.ts" "$TEXT" --out "$OUT_DIR/vocabulary-analysis.json" &
wait
```

### Step 3: Build Fix Plan
After analyzers complete, cross-reference all issues by sentence. **Always pass `--config` so the fix plan can resolve prose targets correctly:**
```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/build-fix-plan.ts" \
  --aux "$OUT_DIR/auxiliary-analysis.json" \
  --pronoun "$OUT_DIR/pronoun-analysis.json" \
  --punctuation "$OUT_DIR/punctuation-analysis.json" \
  --structure "$OUT_DIR/structure-analysis.json" \
  --noun "$OUT_DIR/noun-analysis.json" \
  --vocabulary "$OUT_DIR/vocabulary-analysis.json" \
  --config "{SESSION_PATH}/config.yml" \
  --out "$OUT_DIR/fix-plan.json"
```

### Step 4: Read all outputs FRESH
Read all 8 files NOW (after all commands finished):
1. `{SESSION_PATH}/current/cleanup-report.json`
2. `{SESSION_PATH}/current/punctuation-analysis.json`
3. `{SESSION_PATH}/current/auxiliary-analysis.json`
4. `{SESSION_PATH}/current/pronoun-analysis.json`
5. `{SESSION_PATH}/current/structure-analysis.json`
6. `{SESSION_PATH}/current/noun-analysis.json`
7. `{SESSION_PATH}/current/vocabulary-analysis.json`
8. `{SESSION_PATH}/current/fix-plan.json`

**You MUST read these files at this point — do NOT rely on any data you may have seen earlier.**

### Step 5: Compose report (strictly from Step 4 data)
Use the fix plan's `summary.budgets` for the document-level metrics table.
Use the fix plan's `sentences` array for the per-sentence fix instructions.
Do NOT invent thresholds or recalculate counts. Report format:
```
## Review Report
Status: {approved | needs-revision}

### Mechanical Cleanup: {N} auto-fixes applied
{Only if totalChanges > 0. Informational — does NOT affect verdict.}

### Document-Level Metrics
| Metric | Current | Target | Status | Excess |
|--------|---------|--------|--------|--------|
| ... from fix-plan.json summary.budgets ... |

### Fix Plan: {N} sentences
{For each sentence in fix-plan.json:}
#### Sentence {id} ({issueCount} issues)
> "{text}"
Constraints:
1. [{tool}] {instruction}
```

### Step 6: Write report to {SESSION_PATH}/current/review-report.md

### Step 7: Return verdict
- Fix plan has 0 sentences → "approved"
- Fix plan has > 0 sentences → "needs-revision"

## Return Format
Return ONLY: "approved" or "needs-revision"
```

**Display after Reviewer returns:**

Read `{SESSION_PATH}/current/fix-plan.json` and the individual analysis JSONs, then display:

```
Review: {verdict} (iteration {I}/2) — {N} sentences in fix plan
```

| Metric       | Current | Target | Status | Excess |
|--------------|---------|--------|--------|--------|
| Cleanup      | {N} fixes | —    | INFO   | —      |
| Em-dashes    | {d}/1k  | {t}/1k | PASS/FIX | ~{N} |
| Aux verbs    | {d}%    | {t}%   | PASS/FIX | ~{N} |
| Pronouns     | {d}%    | {t}%   | PASS/FIX | ~{N} |
| Structure    | {N} flags | 0    | PASS/FIX | {N}  |
| Nouns        | {d}%    | {t}%   | PASS/FIX | ~{N} |
| Vocabulary   | {d}/1k  | 0/1k   | PASS/FIX | {N}  |

Sources:
- Fix plan: `fix-plan.json` → `summary.budgets[]` provides tool, current, target, excess, needsFix for each metric
- Cleanup: `cleanup-report.json` → `totalChanges`
- For metrics not in budgets (passing): pull current from analysis JSONs, show PASS with excess=0
- Structure signals: `structure-analysis.json` → `signals[]` entries. If any flagged, expand below table

If "approved", skip to Step 2.

#### 1.5b: Writer Fix Pass

If needs-revision, spawn `writer` subagent with `model: sonnet`, `subagent_type: writer`:

```markdown
Fix the issues identified by the Reviewer using the sentence-centric fix plan.

## Author Context
File: {SESSION_PATH}/author-context.yml

## Config
File: {SESSION_PATH}/config.yml
Read this config to understand the writing rules, thresholds, and any disabled checks.
Your fixes must respect these settings.

## Learned Patterns
Read the following files (if they exist) for writing patterns to apply:
{PATTERNS_FILE_LIST}

## Input
- Full source text: {SESSION_PATH}/current/{BASENAME}.md (READ THIS FIRST for context)
- Fix plan: {SESSION_PATH}/current/fix-plan.json
- Review report: {SESSION_PATH}/current/review-report.md (for document-level context only)

## Task Type
This is a **Fix Task** (Step 2C in your instructions). The fix-plan.json lists sentences
with ALL constraints combined. For each sentence, generate ONE replacement that satisfies
ALL constraints simultaneously. Do NOT fix issues one at a time — address them all in a
single rewrite per sentence.

## Output
- Apply fixes in-place to: {SESSION_PATH}/current/{BASENAME}.md

## Return Format
CRITICAL: Return ONLY a single line: "success" or "failure: {reason}".
Do NOT include a changelog, explanation, or list of changes.
```

**Display:** `Writer Fix: {result}`

#### 1.5c: Re-verify

Spawn Reviewer again (same prompt as 1.5a) to confirm fixes resolved the issues.

If still failing after 2 iterations, proceed to Step 2. Log what remains unresolved.

### Step 2: Detector (Sonnet)

Run the `slop-detector` Subagent with the following prompt.

Spawn with: `model: sonnet`, `subagent_type: slop-detector`

The Detector agent is a **blind evaluator**. It does NOT know:
- That this text may have been revised
- That it's part of an iterative process
- What confidence level you're hoping for

DO NOT leak any of this context to the Detector.

**INPUT for Detector:** Always `{SESSION_PATH}/current/{BASENAME}.md` — the Writer's output from Step 1 (after review fixes).

```markdown
Analyze this text to determine if it was written by a human or AI.

## Input
File: {SESSION_PATH}/current/{BASENAME}.md
Config: {SESSION_PATH}/config.yml

## Output
- Write metrics to: {SESSION_PATH}/current/heuristics-scores.json
- Write analysis to: {SESSION_PATH}/current/feedback.md

## Return Format
Return ONLY these three lines:
Classification: {likely_ai|likely_human|uncertain}
AI Signal Score (0.0-1.0): {heuristicsScore}
Confidence: {N}%
```

**Display after Detector returns:**

Parse the 3-line return value. Then read `{SESSION_PATH}/current/heuristics-scores.json` and display:

```
Detection: {classification} ({confidence}% confidence, score: {heuristicsScore})
```

| Tool        | Score | Result    | Wt   | Signals |
|-------------|-------|-----------|------|---------|
| vocabulary  | 0.XX  | human/ai/unc | 0.15 | N       |
| punctuation | 0.XX  | human/ai/unc | 0.05 | N       |
| structure   | 0.XX  | human/ai/unc | 0.05 | N       |
| burstiness  | 0.XX  | human/ai/unc | 0.12 | N       |
| ngram       | 0.XX  | human/ai/unc | 0.10 | N       |
| content     | 0.XX  | human/ai/unc | 0.08 | N       |
| syntactic   | 0.XX  | human/ai/unc | 0.10 | N       |

Sources: `toolResults[name].score`, `.classification` (abbreviate: human/ai/unc), `.weight`, `.signals.length`

Below the table: `Top signals: {first 3 from topSignals, truncated to ~60 chars}`

### Step 3: Check Success & Update Ledger

**Update the learnings ledger** with the delta from the previous round:

```markdown
## Round {N}: {prev_confidence}% → {new_confidence}%

Changes made before round {N}:
- {list changes made by ai-engineer in previous round, or "Initial revision" for round 1}

Result: {+X% | -X% | no change}
```

If the SUCCESS_CONDITION is met:

- Copy the final output to `OUTPUT_FILE`: `cp "{SESSION_PATH}/current/{BASENAME}.md" "{OUTPUT_FILE}"`
- Report success and EXIT

### Step 4: Version Round

```bash
"$GHOSTWRITER_ROOT/agent/tools/version-round.sh" "{SESSION_PATH}"
```

This copies {BASENAME}.md, feedback.md, and heuristics-scores.json from `current/` to `rounds/r{N}/`

### Step 5: ai-engineer (Opus)

Call the `ai-engineer` Subagent to analyze the Detector's feedback and improve the Writer/Reviewer for the **next round**.

Spawn with: `model: opus`, `subagent_type: ai-engineer`

```markdown
Analyze detection feedback and improve the humanization system.

## Input
- Config file: {SESSION_PATH}/config.yml
- Feedback file: {SESSION_PATH}/rounds/r{N}/feedback.md
- Learnings ledger: {SESSION_PATH}/learnings-log.md
- Writer agent: .claude/agents/writer.md
- Reviewer agent: .claude/agents/reviewer.md
- Writer output: {SESSION_PATH}/rounds/r{N}/{BASENAME}.md (for reference)
- Learned patterns dir: .ghostwriter/learned-patterns/
- Author patterns: .ghostwriter/authors/{author-slug}/learned-patterns.md
- Publication patterns: .ghostwriter/publications/{pub-slug}/learned-patterns.md

## Your Authority
You are a Senior AI Engineer. Your full scope is documented in your agent file. In summary:
- Modify ANY part of the Writer agent (.claude/agents/writer.md)
- Modify ANY part of the Reviewer agent (.claude/agents/reviewer.md)
- Create or modify writer tools ($GHOSTWRITER_ROOT/agent/tools/writer/)
- Create or modify skills (.claude/skills/)
- Install dependencies (bun add)
- Propose pipeline changes to .claude/commands/humanize.md
- Read research files (research/) for insights

DO NOT modify Detector tools/agent — that's the adversary.

## Writer vs. Reviewer Updates
- **Writer**: Content quality, voice, vocabulary, fix strategies (how to generate replacements)
- **Reviewer**: Tool usage, report format, which metrics to check, ordering
- If Detector flags a density metric → update Reviewer (or its tools)
- If Detector flags voice/vocabulary/structure → update Writer

## Key Principle
If the same issue has persisted for 2+ rounds despite instruction updates, STOP adding more instructions. Escalate to building a tool or modifying the pipeline. Prompting has limits.

## Return Format
## Changes Made

### Instruction Updates
- Added: {summary}
- Modified: {summary}
- Removed: {summary}

### Tools (if any)
- Created: {tool path and purpose}
- Modified: {tool path and what changed}
- Ran: {tool command and result}

### Pipeline Changes (if any)
- Proposed: {description}

### Rationale
{Why this intervention over alternatives}
```

**After ai-engineer returns**, note what changes it made for the next ledger update.

**Display:** Summarize the ai-engineer's return in one line:
`Engineer: {N} changes ({brief comma-separated list of what changed})`

### Step 6: Continue Loop

Loop back to Step 1.

The Writer's Learned Patterns accumulate through the ai-engineer, so each revision improves even though it starts from the original draft.

Stop when:
- SUCCESS_CONDITION is met
- Max rounds reached

### Step 7: Report

```
Session: {SESSION_PATH}
Status: {completed | max_rounds_reached}
Rounds: {N}
Final confidence: {X}%
Final AI Signal Score (0.0-1.0): {Y}
Confidence progression: {list: round → confidence}
Output: {OUTPUT_FILE}
```

---

## Progress Reporting

See the **Progress Display** section near the top of this file for all display conventions, round separators, per-step summaries, and round summary format. All display instructions are specified inline at each step.

---

## Learnings Ledger Format

The `learnings-log.md` file tracks outcomes:

```markdown
# Learnings Log

Tracks what worked and what didn't across rounds.

---

## Round 0 → 1: N/A → 45%

Initial detection of input.md

---

## Round 1 → 2: 45% → 62%

Changes made in round 1:
- Added: "Avoid em-dash stacking"
- Added: "Use specific examples over generic statements"

Result: +17% (both learnings appear effective)

---

## Round 2 → 3: 62% → 58%

Changes made in round 2:
- Added: "Increase contraction usage"
- Modified: "Em-dash rule to be stricter"

Result: -4% (contraction rule may have hurt)

---
```

This gives the Optimizer context to:
- Reinforce what's working
- Remove what's hurting
- Avoid repeating failed strategies
