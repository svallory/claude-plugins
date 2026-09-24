# Ghostwriter

Adversarial AI text detection and humanization. A Writer produces text, a Detector evaluates it for AI signals, and an AI Engineer improves the Writer's instructions based on what the Detector caught — each round, the text gets harder to distinguish from human writing.

```
Writer → Reviewer → Detector → pass? → done
                                 ↓ no
                          AI Engineer → next round
```

## Install

```
/plugin marketplace add svallory/tutor
/plugin install ghostwriter@tutor
```

Ghostwriter is a full plugin rather than a standalone skill — its helper skills are internal to its own agent pipeline and aren't published to the skills CLI.

## Requirements

| Need | Notes |
|---|---|
| **bun** | Required. `/setup` stops if it's missing. [Install bun](https://bun.sh) |
| **Python 3.8+** | Optional but strongly recommended. `/setup` creates a `.venv` and installs `nltk`, `numpy`, and `spacy`. |
| **`yq`** | Used by `/humanize` and `/humanize-all` to build the author context. |

Without Python, only the TypeScript detectors run — vocabulary, punctuation, and structure. You lose burstiness, n-gram, syntactic complexity, and content analysis, which together carry most of the ensemble's weight.

## Getting started

### 1. Set up your workspace

```
/setup
```

The wizard asks one question at a time: your author identity (name, background, personality traits, native and other languages), a publication name, the medium, style, and where your content lives. It creates `.ghostwriter/` in your project and validates the generated config.

### 2. Check what you have

```
/analyze guides/getting-started.md developer-docs
/audit developer-docs
```

`/analyze` scores a single file. `/audit` scans an entire publication and writes a worst-first report.

### 3. Humanize

```
/humanize guides/getting-started.md developer-docs --quick   # single pass
/humanize guides/getting-started.md developer-docs           # full loop
```

## Commands

| Command | What it does |
|---------|--------------|
| `/setup [--reconfigure]` | Interactive wizard — creates authors, publications, and configs |
| `/analyze <file> [publication] [--model M]` | Score one file. Returns classification, AI signal score, and confidence |
| `/humanize <file> [output] [publication] [--quick] [max-rounds=N]` | The iterative loop. Default 5 rounds |
| `/humanize-all <input-dir> <output-dir> <config> [--parallel N]` | Batch the loop across files. Default parallelism 1 |
| `/audit <publication> [--threshold N] [--format table\|detailed] [--force]` | Scan a publication. Default threshold 30 |
| `/create <topic> [--medium M] [--length N] [--max-rounds N]` | Generate new text adversarially. Defaults: blog, 300 words, 10 rounds |
| `/authors [list\|add\|remove\|show] [slug]` | Manage author personas |
| `/publications [list\|add\|remove\|show] [slug]` | Manage publications |
| `/migrate [--dry-run]` | Move a v1 layout into `.ghostwriter/` |
| `/help` | Command list and quick start |

`/analyze` and `/humanize` are marked `disable-model-invocation` — they must run as direct commands so the Detector stays a blind evaluator.

## How the loop works

The success condition, evaluated after every round:

```
classification == "likely_human"
AND (confidence > 80% OR AI Signal Score < 0.26)
```

Each round:

1. **Writer** (opus) rewrites. The input is **always the original `input.md`**, never the previous round's output — there's no revision-of-a-revision drift. What improves between rounds is the accumulated learned patterns, plus the previous round's feedback.
2. **Reviewer** (sonnet) runs mechanical cleanup in place, then six analyzers, then builds a sentence-level fix plan. A Writer fix pass and re-review follow, capped at 2 iterations.
3. **Detector** (sonnet) evaluates blind — it never sees the config, the patterns, or the feedback that produced the text.
4. If the success condition isn't met, the round is versioned into `rounds/r{N}/` and the **AI Engineer** (opus) updates instructions: density problems go to the Reviewer, voice/vocabulary/structure problems go to the Writer.

The loop stops at success or after `max-rounds` (default 5). `--quick` skips everything but the Writer.

The AI Engineer works in tiers and knows when prompting has stopped paying: if the same issue survives 2+ rounds of instruction updates, it escalates to building a tool or changing the pipeline instead of adding more instructions. It's explicitly forbidden from touching the Detector — that's the adversary, and modifying it would be cheating.

## Detection ensemble

The AI signal score is a weighted ensemble:

| Signal | Weight | Needs |
|---|---|---|
| binoculars | 0.20 | `--use-llm` |
| fast_detectgpt | 0.15 | `--use-llm` |
| vocabulary | 0.15 | TypeScript |
| burstiness | 0.12 | Python |
| ngram | 0.10 | Python |
| syntactic | 0.10 | Python |
| content | 0.08 | Python |
| punctuation | 0.05 | TypeScript |
| structure | 0.05 | TypeScript |

Scores band as `0.0–0.30` likely human, `0.30–0.70` uncertain, `0.70–1.0` likely AI. Binoculars and Fast-DetectGPT need `--use-llm` and local model inference; without them the remaining weights are rescaled proportionally.

## Configuration

`/setup` creates this layout in your project:

```
.ghostwriter/
├── learned-patterns/            # global.md, blog.md, book.md
├── authors/<slug>/
│   ├── author-persona.yml
│   └── learned-patterns.md
└── publications/<slug>/
    ├── config.yml
    ├── learned-patterns.md
    └── pipeline/                # run data, session history
```

A publication config uses an ordered preset system — later presets override earlier ones, and inline `rules:` override everything:

```yaml
version: '1.0'

presets:
  - ../../authors/your-name/author-persona.yml
  - technical-book

publication:
  name: "My Technical Book"
  media: book              # blog | book | article | newsletter | business | academic | docs | technical
  audience: expert         # general | expert | developer

content:
  root: ../../../manuscript
  glob: "**/*.md"

writing_style:
  tone: conversational
  formality: informal      # informal | moderate | formal
  voice: first-person      # first-person | second-person | third-person
```

Available presets: `blog`, `book`, `technical-book`, `academic`, `business`, `casual`, `technical-docs`, `student`.

### Tuning individual checks

Every rule accepts `ai_threshold`, `human_baseline`, `weight` (0–1), and `disabled`. Three ways to relax a check that fights your house style:

```yaml
rules:
  punctuation:
    em_dash:
      disabled: true        # skip it entirely
  content:
    hedging:
      weight: 0.3           # keep it, count it less
  structure:
    bullet_density:
      ai_threshold: 8       # raise the bar
```

Setting `ai_threshold: null` skips a rule the same way `disabled: true` does.

### Prose targets

`writing_style.prose` sets density targets per 1000 words. The shipped defaults:

| Target | Default |
|---|---|
| `em_dash_density` | 1.5 |
| `em_dash_min_density` | 1.0 |
| `auxiliary_density` | 3.0 |
| `pronoun_density` | 5.0 |
| `noun_density` | 20.0 |
| `max_dependency_depth` | 5.0 |
| `max_uniformity` | 0.8 |
| `min_compound_complex_ratio` | 0.05 |
| `min_depth_variance` | 1.0 |

Presets override these — `technical-book` raises `em_dash_density` to 2.0, and the children's-book template drops it to 0.5 while raising pronouns to 10.0.

## Learned patterns

Patterns accumulate across five layers, each overriding the previous on conflict:

1. **Global** — `learned-patterns/global.md`, all writing
2. **Medium** — `learned-patterns/{media}.md`
3. **Medium + style** — `learned-patterns/{media}-{style}.md`
4. **Author** — `authors/{slug}/learned-patterns.md`
5. **Publication** — `publications/{slug}/learned-patterns.md`

This is what makes round 2 better than round 1 despite the Writer always starting from the original draft. When a pattern file passes roughly 50 entries, the AI Engineer treats it as instruction bloat and consolidates rather than appending.

## Templates

Ready-made publication stubs ship for common scenarios: `academic/paper`, `blog/personal`, `book/{children,fiction,nonfiction,technical}`, `docs/technical`, `email/{business,newsletter}`, and `press/{news,opinion}`. `/setup` offers them interactively.

## Environment

One variable, `GHOSTWRITER_ROOT`, exported by `bin/ghostwriter-env.sh`. Every command starts with `eval "$(ghostwriter-env.sh)"`. Claude Code puts plugin `bin/` directories on PATH automatically — if that script isn't found, the plugin isn't loaded.

## Research

The plugin carries the research its detectors are built on: marker catalogs (punctuation, structure, style, narrative, lexical, formatting, content, compounds), algorithm write-ups (perplexity, burstiness, DetectGPT, n-gram, vocabulary metrics, syntactic complexity), detection tool specifications, and the source papers — Binoculars, Fast-DetectGPT, Ghostbuster, RAID benchmark. `research/INDEX.md` is the entry point.

## See also

- [Plugin overview](/docs/) — the rest of the marketplace.
