---
name: help
description: Show available ghostwriter commands and quick start guide
---

# Ghostwriter Help

## Commands

| Command | Description |
|---------|-------------|
| `/setup` | Interactive setup wizard — create authors and publications |
| `/audit <publication>` | Scan all files in a publication for AI signals |
| `/analyze <file> [publication]` | Analyze a single file for AI signals |
| `/humanize <file> <publication>` | Iterative humanization loop (Writer → Reviewer → Detector → AI Engineer) |
| `/humanize <file> <publication> --quick` | Single-pass rewrite without detection loop |
| `/humanize-all <publication>` | Batch humanize all files in a publication |
| `/create <topic> [--config PATH]` | Generate new text from a topic via adversarial training |
| `/authors [list\|add\|remove\|show]` | Manage author profiles |
| `/publications [list\|add\|remove\|show]` | Manage publications |
| `/migrate` | Migrate from v1 layout to v2 |
| `/help` | This help page |

## Quick Start

```
/setup                                          # Create author + publication
/audit my-docs                                  # See which files need work
/humanize guides/getting-started.md my-docs     # Fix the worst file
/humanize-all my-docs                           # Fix all files
```

## Configuration

Each publication has a `config.yml` in `.ghostwriter/publications/{name}/`. You can:
- **Disable rules** that don't apply to your content (e.g., bullet density for API docs)
- **Raise thresholds** for intentional patterns (e.g., hedging in forward-looking docs)
- **Reduce weights** for metrics that matter less in your context

See the full configuration reference at: `docs/configuration-reference.md` in the plugin directory.

## Project Structure

```
.ghostwriter/
├── learned-patterns/        # Global + medium patterns (auto-updated)
├── authors/                 # Author profiles (personas)
│   └── {name}/
│       ├── author-persona.yml
│       └── learned-patterns.md
└── publications/            # Publication configs + pipeline data
    └── {name}/
        ├── config.yml
        ├── learned-patterns.md
        ├── audit-report.md
        └── pipeline/
```

Your content stays wherever it is — the plugin only creates `.ghostwriter/`.
