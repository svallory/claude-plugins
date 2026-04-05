# Ghostwriter — Claude Code Plugin

An adversarial AI text detection and humanization system. Detects AI-generated text and iteratively revises it to read as authentically human.

## How It Works

The ghostwriter uses an adversarial loop: a **Writer** agent produces text, a **Detector** evaluates it for AI signals, and an **AI Engineer** refines the Writer's approach based on feedback. Each round, the text gets harder to distinguish from human writing.

```
Writer → Reviewer → Detector → Pass? → Done
                                  ↓
                            AI Engineer → next round
```

## Requirements

- **bun** (required) — [Install bun](https://bun.sh)
- **Python 3.8+** (optional) — enables additional detection tools (burstiness, n-gram, syntactic complexity, content analysis, perplexity). Without Python, only TypeScript-based tools run.

## Installation

### Local development

```bash
claude --plugin-dir /path/to/ghostwriter
```

## Quick Start

### 1. Setup

```
/ghostwriter:setup
```

The setup wizard guides you through creating your author profile, naming your publication, and choosing your writing medium and style.

### 2. Analyze text

Check if text reads as AI-generated:

```
/ghostwriter:analyze guides/getting-started.md developer-docs
/ghostwriter:analyze path/to/text.md
```

### 3. Rewrite text (single pass)

Quick humanization without the iterative loop:

```
/ghostwriter:rewrite guides/getting-started.md developer-docs
/ghostwriter:rewrite input.md output.md
```

### 4. Humanize text (iterative loop)

Full adversarial loop with detection, review, and improvement:

```
/ghostwriter:humanize guides/getting-started.md developer-docs
/ghostwriter:humanize input.md output.md <publication-name>
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/ghostwriter:setup` | Interactive setup wizard |
| `/ghostwriter:analyze <file> [publication]` | Detect if text is AI-generated |
| `/ghostwriter:rewrite <in> <out> [publication]` | Single-pass humanization |
| `/ghostwriter:humanize <in> <out> <publication>` | Iterative humanization loop |
| `/ghostwriter:humanize-all <dir> <out> <publication>` | Batch humanization |
| `/ghostwriter:rewrite-all <dir> <out> [publication]` | Batch single-pass rewrite |
| `/ghostwriter:adversarial-loop "topic"` | Generate new text via adversarial training |
| `/ghostwriter:authors [list\|add\|remove\|show]` | Manage author profiles |
| `/ghostwriter:publications [list\|add\|remove\|show]` | Manage publications |

## Project Structure

After setup, your project will look like:

```
my-project/
├── .ghostwriter/
│   ├── learned-patterns/        # Accumulated training patterns
│   │   ├── global.md
│   │   ├── blog.md
│   │   └── book.md
│   ├── authors/
│   │   └── your-name/
│   │       ├── author-persona.yml   # Your author profile
│   │       └── learned-patterns.md  # Author-specific patterns
│   └── publications/
│       └── my-publication/
│           ├── config.yml           # Publication config
│           ├── learned-patterns.md  # Publication-specific patterns
│           └── pipeline/            # Humanization run data
├── apps/docs/src/content/    # Your content (untouched)
└── content/blog/             # Your content (untouched)
```

> An "author" represents a writing persona — it can be a real person, a team ("Acme Engineering"), or a brand voice.

## Configuration

Publication configs use YAML with a preset system:

```yaml
version: '1.0'

presets:
  - ../../authors/your-name/author-persona.yml
  - technical-book

publication:
  name: "My Technical Book"
  media: book
  audience: expert

content:
  root: ../../../manuscript
  glob: "**/*.md"

writing_style:
  tone: conversational
  formality: informal
  voice: first-person
```

### Available Presets

`blog`, `book`, `technical-book`, `academic`, `business`, `casual`, `technical-docs`, `student`

### Templates

The plugin ships templates for common writing scenarios. Run `/ghostwriter:setup` to use them interactively, or copy from the plugin's `templates/` directory.

## Learned Patterns

The system learns from each humanization round. Patterns are stored in a layered hierarchy:

1. **Global** — `.ghostwriter/learned-patterns/global.md` — applies to all writing
2. **Medium** — `.ghostwriter/learned-patterns/{media}.md` — applies to a specific medium
3. **Medium+Style** — `.ghostwriter/learned-patterns/{media}-{style}.md` — applies to a specific style
4. **Author** — `.ghostwriter/authors/{slug}/learned-patterns.md` — applies to all writing by this author
5. **Publication** — `.ghostwriter/publications/{slug}/learned-patterns.md` — applies to this publication only

Later layers override earlier ones on conflict.

## License

MIT
