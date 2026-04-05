---
name: rewrite
description: Rewrite text to sound more authentically human
disable-model-invocation: false
argument-hint: <input-file> <output-file> [config] [--model MODEL]
---

# Rewrite Command

Rewrites text to sound more authentically human using the writer agent.

## Prerequisites

Before running, ensure:
1. The ghostwriter plugin is loaded (`ghostwriter-env.sh` must be on PATH)
2. Run `/ghostwriter:setup` if `.ghostwriter/config.json` doesn't exist

Set up the plugin root for tool invocations:
```bash
eval "$(ghostwriter-env.sh)"
```

## Usage

```bash
# Basic: input and output
/rewrite path/to/text.md path/to/output.md

# With config (author profile, writing rules, presets)
/rewrite path/to/text.md path/to/output.md path/to/config.yml

# With custom model
/rewrite path/to/text.md path/to/output.md path/to/config.yml --model sonnet
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<input-file>` | yes | — | Path to the text file to rewrite |
| `<output-file>` | yes | — | Path where the rewritten file will be written |
| `[config]` | no | — | Path to YAML config file (author, presets, rules) |
| `--model MODEL` | no | `opus` | Model to use (`haiku`, `sonnet`, `opus`, or any model ID) |

## Execution

Run the `writer` subagent with the following prompt.

Spawn with: `model: {MODEL}`, `subagent_type: writer`

### Prompt Template

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
- Text to revise: {INPUT_FILE}

## Output
- Write revised text to: {OUTPUT_FILE}

## Key Instructions
{{#if CONFIG}}
- Match the author's voice and personality from the config file
- Respect the rules and thresholds in the config file
{{/if}}
- Apply your Learned Patterns
- Preserve the core meaning and structure
- Make it sound authentically human

## Learned Patterns
Read the following files (if they exist) for writing patterns to apply:
{PATTERNS_FILE_LIST}

## Return Format
Return ONLY: "success" or "failure: {reason}"
```

### Variable Resolution

- `INPUT_FILE`: First argument (required)
- `OUTPUT_FILE`: Second argument (required)
- `CONFIG`: Third argument if not starting with `--` (optional)
- `MODEL`: Value of `--model` flag, defaults to `opus`
- `PATTERNS_FILE_LIST`: Resolved by the orchestrator. Read `.ghostwriter/config.json` to get `publications_dir` and `authors_dir`. From the CONFIG file, extract `publication.media` and `author.name`. Resolve files in this order (skip if not found):
  1. `.ghostwriter/learned-patterns/global.md`
  2. `.ghostwriter/learned-patterns/{media}.md`
  3. `.ghostwriter/learned-patterns/{media}-*.md` (glob for style-specific)
  4. `{authors_dir}/{author-slug}/learned-patterns.md`
  5. `{publications_dir}/{pub-slug}/learned-patterns.md`
  Where `{pub-slug}` is the directory name containing the CONFIG file.

## Output

Report to user:
```
Rewritten: {OUTPUT_FILE}
```
