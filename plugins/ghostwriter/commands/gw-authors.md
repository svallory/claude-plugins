---
name: gw-authors
description: List, add, remove, or show author profiles
argument-hint: [list|add|remove|show] [author-slug]
---

# Authors Management

Manage author profiles in `.ghostwriter/authors/`.

An "author" is a persona — it can represent a real person, a team, or a brand voice. Each author has a profile (`author-persona.yml`) and accumulated learned patterns (`learned-patterns.md`).

## Usage

```bash
/ghostwriter:gw-authors                    # List all authors
/ghostwriter:gw-authors list               # Same as above
/ghostwriter:gw-authors add                # Add a new author (interactive)
/ghostwriter:gw-authors remove <slug>      # Remove an author
/ghostwriter:gw-authors show <slug>        # Show author details
```

## Prerequisites

Ensure `.ghostwriter/` exists. If not, run `/ghostwriter:gw-setup` first.

## Commands

### list (default)

List all authors in `.ghostwriter/authors/`.

```bash
ls .ghostwriter/authors/*/author-persona.yml 2>/dev/null
```

For each author directory found, read the `author-persona.yml` and extract the `author.name` field.

Also check which publications reference each author by scanning `.ghostwriter/publications/*/config.yml` for preset paths containing the author slug.

Display:

```
Authors:

  jane-doe
    Name: Jane Doe
    Publications: my-novel, company-blog

  acme-team
    Name: Acme Engineering
    Publications: developer-docs
```

If no authors exist, display: "No authors found. Run `/ghostwriter:gw-authors add` or `/ghostwriter:gw-setup` to create one."

### add

Interactive author creation. Ask these questions ONE AT A TIME:

1. "What name should this author go by? (This can be a person, team, or brand — e.g., 'Jane Doe', 'Acme Engineering', 'The Expert')"
2. "Describe the professional background in 1-2 sentences (profession, industry, years of experience)"
3. "What personality traits describe this writing voice? (e.g., direct, opinionated, pragmatic, dry-wit, empathetic, analytical)"
4. "What's the primary language for this author?"
5. "Any other languages? (or 'none')"

Slugify the name: lowercase, replace spaces/special chars with hyphens.

Check if `.ghostwriter/authors/{slug}/` already exists. If so, ask: "Author '{slug}' already exists. Overwrite? (y/n)"

Create the author:

```bash
mkdir -p ".ghostwriter/authors/{slug}"
```

Write `.ghostwriter/authors/{slug}/author-persona.yml` using the template from `$GHOSTWRITER_ROOT/templates/author-persona.yml` as the base, filling in values from the answers.

Write `.ghostwriter/authors/{slug}/learned-patterns.md`:
```markdown
# Learned Patterns: {Name}

Patterns specific to this author's voice and writing preferences.
Updated automatically by the ai-engineer during humanization rounds.
```

Display: "Author '{name}' created at .ghostwriter/authors/{slug}/"

### remove

```bash
/ghostwriter:gw-authors remove <slug>
```

First, check if any publications reference this author:

```bash
grep -rl "{slug}/author-persona.yml" .ghostwriter/publications/*/config.yml 2>/dev/null
```

If publications reference this author, display:

```
Cannot remove author '{slug}' — referenced by these publications:
  - developer-docs (.ghostwriter/publications/developer-docs/config.yml)
  - company-blog (.ghostwriter/publications/company-blog/config.yml)

Reassign these publications to a different author first.
```

If no publications reference the author, confirm:

"Remove author '{slug}' and their learned patterns? This cannot be undone. (y/n)"

If confirmed:
```bash
rm -r ".ghostwriter/authors/{slug}"
```

Display: "Author '{slug}' removed."

### show

```bash
/ghostwriter:gw-authors show <slug>
```

Read and display `.ghostwriter/authors/{slug}/author-persona.yml`.

List publications using this author.

Check if `learned-patterns.md` has content (beyond the header).

Display:

```
Author: {name} ({slug})

Profile: .ghostwriter/authors/{slug}/author-persona.yml
  Personality: direct, opinionated, pragmatic
  Background: Engineering team, Developer tools, 10 years
  Language: English

Publications using this author:
  - developer-docs (Developer Documentation)
  - company-blog (Company Blog)

Learned patterns: {N} patterns accumulated
  File: .ghostwriter/authors/{slug}/learned-patterns.md
```

If the slug doesn't exist, display: "Author '{slug}' not found. Run `/ghostwriter:gw-authors list` to see available authors."
