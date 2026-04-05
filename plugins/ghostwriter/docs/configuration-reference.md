# Configuration Reference

Complete reference for ghostwriter publication configs. Each publication has a `config.yml` in `.ghostwriter/publications/{slug}/`.

## Config Structure

```yaml
version: '1.0'

presets:
  - ../../authors/{slug}/author-persona.yml    # Author profile
  - technical-book                              # Built-in preset name

publication:
  name: "My Publication"
  media: book                # blog | book | article | newsletter | business | academic | docs | technical
  audience: expert           # general | expert | developer

content:
  root: ../../../path/to/content    # Path to content directory (relative to config file)
  glob: "**/*.md"                   # File pattern (default: **/*.md)
  ignore:                           # Optional exclusion patterns
    - "_partials/**"
  stages:                           # Optional: staged workflow
    - original
    - humanized
    - final

writing_style:
  tone: conversational       # conversational | formal | objective | playful | authoritative | persuasive | varied | neutral | professional
  formality: informal        # informal | moderate | formal
  voice: first-person        # first-person | second-person | third-person

  prose:                     # Density targets (optional — defaults from preset)
    em_dash_density: 2.0     # Em-dashes per 1000 words
    auxiliary_density: 3.0   # Auxiliary verb percentage
    pronoun_density: 7.0     # Pronoun percentage
    noun_density: 20.0       # Noun percentage
    max_dependency_depth: 5.0 # Max syntactic depth

rules:                       # Detection rule overrides (see below)
  # ...
```

## Presets

Presets are base configurations that set sensible defaults for a writing context. Your config merges on top of presets (your values win).

| Preset | Media | Key Characteristics |
|--------|-------|-------------------|
| `casual` | blog, newsletter | Relaxed punctuation, informal structure, high personality tolerance |
| `book` | book (general) | Professional editing standards, strict punctuation consistency |
| `technical-book` | book (technical) | Expert-casual, high semicolons, code example tolerance |
| `academic` | research papers | Formal hedging OK, passive OK, high syntactic complexity expected |
| `business` | corporate comms | Professional tone, moderate structure expectations |
| `technical-docs` | documentation | Bullet lists OK, relaxed cliche/hedging, formal consistency |
| `student` | student writing | Relaxed across the board |

### Using presets

```yaml
presets:
  - ../../authors/jane-doe/author-persona.yml   # Author profile (also a preset)
  - technical-book                               # Built-in preset name
```

Presets merge in order. Later presets override earlier ones. Your inline `rules:` section overrides everything.

## Detection Rules

Rules control what the detector flags. Each rule has:

| Field | Type | Description |
|-------|------|-------------|
| `ai_threshold` | number or null | Value above/below which triggers an AI signal. `null` = skip this metric. |
| `human_baseline` | number | Expected value for human-written text in this context |
| `disabled` | boolean | If `true`, completely skip this check |
| `weight` | number (0-1) | Weight multiplier. Lower values reduce this metric's influence on the overall score. |

### Punctuation Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `punctuation.period_quote` | Period-quote placement consistency (%) | 97 | 85 |
| `punctuation.oxford_comma` | Oxford comma consistency (%) | 95 | 75 |
| `punctuation.em_dash` | Em-dash frequency per 1000 words | 4.0 | 2.0 |
| `punctuation.semicolon_to_em_dash_ratio` | Semicolon:em-dash ratio | 0.3 | 1.0 |
| `punctuation.parenthesis_to_em_dash_ratio` | Parenthesis:em-dash ratio | 1.2 | 1.8 |

**Special fields:**
- `period_quote.expected`: `"american"` | `"british"` | `"logical"`
- `oxford_comma.expected`: `"always"` | `"never"` | `"flexible"`

### Structure Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `structure.paragraph_fano_factor` | Paragraph length uniformity (variance/mean) | 0.5 | 1.5 |
| `structure.bullet_density` | Bullet points per 100 words | 3 | 1 |
| `structure.transition_density` | Transition words per 1000 words | 15 | 6 |

### Vocabulary Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `vocabulary.ai_vocab_density` | AI-associated words per 1000 words | 15 | 3 |

### Burstiness Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `burstiness.coefficient_of_variation` | Sentence length variation (std/mean * 100) | 30 | 60 |
| `burstiness.fano_factor` | Sentence length Fano factor (variance/mean) | 0.8 | 1.5 |
| `burstiness.length_range` | Range between shortest/longest sentence (words) | 15 | 35 |

### N-gram Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `ngram.six_gram_repetition_rate` | 6-word phrase repetition rate | 0.2 | 0.05 |
| `ngram.six_gram_ttr` | 6-gram type-token ratio (diversity) | 0.4 | 0.85 |
| `ngram.ai_pattern_count` | Count of known AI phrase patterns | 3 | 0 |

### Content Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `content.hedging` | Hedging phrases per 1000 words ("perhaps", "arguably", "may") | 10 | 4 |
| `content.cliche` | Cliche count ("tip of the iceberg", etc.) | 3 | 1 |
| `content.superlative` | Superlative usage per 1000 words ("best", "most", etc.) | 8 | 3 |
| `content.filler` | Filler words ("basically", "actually", "really") | 5 | 2 |

### Syntactic Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `syntactic.avg_dependency_depth` | Average sentence dependency tree depth | 3.5 | 6.0 |
| `syntactic.sentence_type_uniformity` | How uniform sentence types are (0-1) | 0.6 | 0.35 |

### ML-Based Rules

| Rule | What It Checks | Default AI Threshold | Default Human Baseline |
|------|---------------|---------------------|----------------------|
| `perplexity.perplexity` | GPT-2 perplexity score (lower = more predictable) | 20 | 50 |
| `detectgpt.d_score` | DetectGPT curvature score | 2.0 | 0.5 |
| `fast_detectgpt.probability` | Fast-DetectGPT AI probability (0-1) | 0.7 | 0.3 |
| `binoculars.score` | Binoculars cross-perplexity ratio (lower = more AI) | 0.8 | 1.2 |

## Common Configuration Scenarios

### Documentation-First Development

When docs are written before code exists, they naturally lack specificity and lived-experience markers that detectors look for. Relax the content analyzer:

```yaml
rules:
  content:
    hedging:
      ai_threshold: 25        # Forward-looking docs use more hedging ("will", "should")
      weight: 0.3              # Reduce hedging's influence on score
    superlative:
      ai_threshold: 12         # Feature descriptions use more superlatives
    filler:
      disabled: true           # Not meaningful for technical docs
  vocabulary:
    ai_vocab_density:
      ai_threshold: 25         # Technical docs may use words like "leverage", "robust"
  structure:
    bullet_density:
      disabled: true           # Docs are full of lists — that's fine
```

### API Reference Documentation

API docs have very uniform structure by design. Disable structure checks:

```yaml
rules:
  structure:
    paragraph_fano_factor:
      disabled: true           # Uniform paragraphs expected in API refs
    bullet_density:
      disabled: true
    transition_density:
      disabled: true
  burstiness:
    coefficient_of_variation:
      ai_threshold: 15         # API docs have less sentence variation
      human_baseline: 30
  content:
    hedging:
      disabled: true           # "May return null" is not hedging in API docs
```

### Marketing Copy

Marketing text uses superlatives and strong claims intentionally:

```yaml
rules:
  content:
    superlative:
      disabled: true           # "Best in class" is intentional
    cliche:
      ai_threshold: 5          # Some cliches are marketing conventions
  vocabulary:
    ai_vocab_density:
      ai_threshold: 25         # "Leverage", "robust", "comprehensive" may be appropriate
```

### Academic Writing

Hedging and passive voice are expected in academic prose:

```yaml
presets:
  - academic                   # Already sets most of these

rules:
  content:
    hedging:
      ai_threshold: 20         # Academic hedging is normal
  syntactic:
    avg_dependency_depth:
      human_baseline: 6.5      # Academic prose is more complex
```

### Children's Books

Simple vocabulary and short sentences are features, not bugs:

```yaml
rules:
  vocabulary:
    ai_vocab_density:
      disabled: true           # AI vocab markers don't apply
  burstiness:
    coefficient_of_variation:
      ai_threshold: 15         # Less variation is fine
  syntactic:
    avg_dependency_depth:
      ai_threshold: 2.0        # Simple sentences expected
      human_baseline: 3.0
```

## Disabling Checks

Three ways to reduce a check's impact:

```yaml
rules:
  content:
    hedging:
      disabled: true           # 1. Skip entirely — never checked, never scored

      weight: 0.2              # 2. Reduce influence — still checked but contributes
                               #    less to the overall score (default is 1.0)

      ai_threshold: 30         # 3. Raise threshold — flag only extreme cases
```

**When to use each:**
- `disabled: true` — the metric is meaningless for your content type (e.g., bullet density in API docs)
- `weight: 0.3` — the metric has some relevance but shouldn't dominate the score
- Higher `ai_threshold` — the metric matters but your content naturally scores higher than average

## Ensemble Weights

The overall AI signal score is a weighted average of all tool scores. Default weights:

| Tool | Weight | What It Measures |
|------|--------|-----------------|
| Binoculars | 0.20 | Cross-perplexity ratio (ML-based, most accurate) |
| Fast-DetectGPT | 0.15 | Probability curvature (ML-based) |
| Vocabulary | 0.15 | AI-associated word frequency |
| Burstiness | 0.12 | Sentence length variation |
| N-gram | 0.10 | Phrase diversity and repetition |
| Syntactic | 0.10 | Dependency tree complexity |
| Content | 0.08 | Hedging, specificity, superlatives |
| Punctuation | 0.05 | Em-dash density, consistency |
| Structure | 0.05 | Paragraph uniformity, bullets |

Note: Binoculars and Fast-DetectGPT require `--use-llm` flag and local model inference. Without them, the remaining tools are reweighted proportionally.
