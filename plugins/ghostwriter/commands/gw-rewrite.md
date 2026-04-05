---
name: gw-rewrite
description: Rewrite text to sound more authentically human
disable-model-invocation: false
argument-hint: <input-file> [output-file] [publication|config] [--model MODEL]
---

# Rewrite Command

Rewrites text to sound more authentically human using the writer agent.

## Prerequisites

Before running, ensure:
1. The ghostwriter plugin is loaded (`ghostwriter-env.sh` must be on PATH)
2. Run `/ghostwriter:gw-setup` if `.ghostwriter/` directory doesn't exist

Set up the plugin root for tool invocations:
```bash
eval "$(ghostwriter-env.sh)"
```

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
/ghostwriter:gw-rewrite input.md output.md
/ghostwriter:gw-rewrite guides/getting-started.md developer-docs
/ghostwriter:gw-rewrite input.md output.md path/to/config.yml
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<input-file>` | yes | — | Path to the text file to rewrite (relative to content root when publication name is given) |
| `<output-file>` | no* | in-place or next stage | Path where the rewritten file will be written. When publication name is used, defaults to in-place overwrite (or next stage directory if stages are defined in config). |
| `[config]` | no | — | Publication name (resolved to `.ghostwriter/publications/{name}/config.yml`) or a literal path to a YAML config file |
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

- `INPUT_FILE`: First argument (required). If publication name resolved, interpret relative to content root.
- `OUTPUT_FILE`: Second argument if not a publication name and not starting with `--`. When publication name is used and no output file is given, output in-place (or next stage if stages are defined in config).
- `CONFIG`: Last non-flag argument — if it matches a directory under `.ghostwriter/publications/`, treat as a publication name and resolve to `$PUB_DIR/config.yml`. Otherwise treat as a literal YAML file path.
- `MODEL`: Value of `--model` flag, defaults to `opus`
- `PATTERNS_FILE_LIST`: Resolved by the orchestrator. From the CONFIG file, extract `publication.media` and `author.name`. Resolve files in this order (skip if not found):
  1. `.ghostwriter/learned-patterns/global.md`
  2. `.ghostwriter/learned-patterns/{media}.md`
  3. `.ghostwriter/learned-patterns/{media}-*.md` (glob for style-specific)
  4. `.ghostwriter/authors/{author-slug}/learned-patterns.md`
  5. `.ghostwriter/publications/{pub-slug}/learned-patterns.md`
  Where `{pub-slug}` is the directory name containing the CONFIG file.

## Output

Report to user:
```
Rewritten: {OUTPUT_FILE}
```
