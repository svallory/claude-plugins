---
name: gw-rewrite-all
description: Rewrite all .md files in a folder to sound more authentically human
user-invocable: true
---

# Rewrite-All Skill

Rewrites all `.md` files in an input folder to sound more authentically human, writing results to an output folder. Spawns `writer` agents (via the `/rewrite` command template) for each file.

**This skill runs in the main agent context** so it can use the Task tool to spawn subagents.

## Usage

```bash
# Basic: rewrite all .md files from input/ to output/
/rewrite-all input/ output/ path/to/config.yml

# Without config
/rewrite-all input/ output/

# With custom model and parallelism
/rewrite-all input/ output/ path/to/config.yml --model opus --parallel 3
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<input-folder>` | yes | — | Directory containing `.md` files to rewrite |
| `<output-folder>` | yes | — | Directory where rewritten files are saved (created if missing) |
| `[config]` | no | — | Path to YAML config file (author, presets, rules) |
| `--model MODEL` | no | `opus` | Model for the writer agent |
| `--parallel N` | no | `3` | Max concurrent rewrites |

## Variable Resolution

- `INPUT_FOLDER`: First argument (required)
- `OUTPUT_FOLDER`: Second argument (required)
- `CONFIG`: Third argument if not starting with `--` (optional)
- `MODEL`: Value of `--model` flag, defaults to `opus`
- `PARALLEL`: Value of `--parallel` flag, defaults to `3`
- `FILENAME`: The basename of each `.md` file being processed

## Execution

### Step 1 — Validate & Discover

1. Verify the `.ghostwriter/` directory exists in the current directory. Abort if not.
2. Verify `INPUT_FOLDER` exists and contains at least one `.md` file. Abort with an error if not.
3. Create `OUTPUT_FOLDER` if it doesn't exist.
4. Collect the list of `.md` files in `INPUT_FOLDER` (non-recursive, top-level only).
5. Report the file list to the user:

```
Found N files to rewrite:
- file1.md
- file2.md
...
```

### Step 2 — Rewrite Files

For each `.md` file, spawn an `writer` Task agent.

- Run up to `PARALLEL` agents concurrently (batch them in a single message with multiple Task tool calls).
- Wait for each batch to complete before starting the next.

**Prompt construction:** Read `.claude/commands/rewrite.md` and follow its **Prompt Template** section. For each file, substitute:

- `{INPUT_FILE}` → `{INPUT_FOLDER}/{FILENAME}`
- `{OUTPUT_FILE}` → `{OUTPUT_FOLDER}/{FILENAME}`
- `{CONFIG}` → the config path (if provided)

Each Task call should use:

```
subagent_type: writer
model: {MODEL}
```

The prompt for each agent is:

```markdown
Revise text to sound more authentically human.

{{#if CONFIG}}
## Author Context
File: {CONFIG}

This contains the author's profile, personality, career background, and writing style preferences. Use this to maintain consistent voice and appropriate vocabulary.

## Config
File: {CONFIG}
Read this config to understand the writing rules, thresholds, and any disabled checks.
Your writing must respect these settings (e.g., punctuation preferences, density targets).
{{/if}}

## Input
- Text to revise: {INPUT_FOLDER}/{FILENAME}

## Output
- Write revised text to: {OUTPUT_FOLDER}/{FILENAME}

## Key Instructions
{{#if CONFIG}}
- Match the author's voice and personality from the config file
- Respect the rules and thresholds in the config file
{{/if}}
- Apply your Learned Patterns
- Preserve the core meaning and structure
- Make it sound authentically human

## Return Format
Return ONLY: "success" or "failure: {reason}"
```

### Step 3 — Report Results

After all files are processed, report a summary:

```
Rewrite-All Complete
====================
Input:   {INPUT_FOLDER}
Output:  {OUTPUT_FOLDER}
Total:   N files

Results:
  [ok]   file1.md
  [ok]   file2.md
  [FAIL]  file3.md — {reason}

Succeeded: X / N
```

If any files failed, list them with the failure reason.
