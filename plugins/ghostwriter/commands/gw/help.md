---
name: help
description: Show available ghostwriter commands and quick start guide
---

# Ghostwriter Help

## Commands

| Command | Description |
|---------|-------------|
| `/gw:setup` | Interactive setup wizard — create authors and publications |
| `/gw:audit <publication>` | Scan all files in a publication for AI signals |
| `/gw:analyze <file> [publication]` | Analyze a single file for AI signals |
| `/gw:humanize <file> <publication>` | Iterative humanization loop (Writer → Reviewer → Detector → AI Engineer) |
| `/gw:humanize <file> <publication> --quick` | Single-pass rewrite without detection loop |
| `/gw:humanize-all <publication>` | Batch humanize all files in a publication |
| `/gw:create <topic> [--config PATH]` | Generate new text from a topic via adversarial training |
| `/gw:authors [list\|add\|remove\|show]` | Manage author profiles |
| `/gw:publications [list\|add\|remove\|show]` | Manage publications |
| `/gw:migrate` | Migrate from v1 layout to v2 |
| `/gw:help` | This help page |

## Quick Start

```
/gw:setup                                          # Create author + publication
/gw:audit my-docs                                  # See which files need work
/gw:humanize guides/getting-started.md my-docs     # Fix the worst file
/gw:humanize-all my-docs                           # Fix all files
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
