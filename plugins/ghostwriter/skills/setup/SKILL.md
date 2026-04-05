---
name: setup
description: Interactive setup wizard for the ghostwriter plugin. Creates author profiles, publications, and writing configs. Run this before using any other ghostwriter command.
user-invocable: true
---

# Ghostwriter Setup Wizard

Interactive setup for the ghostwriter plugin. Creates your author profile, publication config, and initializes learned patterns.

## Usage

```
/ghostwriter:setup
```

---

## Step 0: Detect Plugin Root and Check Dependencies

```bash
eval "$(ghostwriter-env.sh)"
```

If this fails, the plugin is not loaded. Tell the user: "Please load the ghostwriter plugin with `claude --plugin-dir /path/to/ghostwriter`"

**Check bun:**
```bash
which bun || echo "MISSING"
```
If missing: print "Please install bun first: https://bun.sh" and STOP.

**Check node_modules:**
```bash
ls "$GHOSTWRITER_ROOT/node_modules" 2>/dev/null || echo "MISSING"
```
If missing: run `cd "$GHOSTWRITER_ROOT" && bun install && cd -`

**Check Python:**
```bash
python3 --version 2>/dev/null || echo "MISSING"
```
If missing: warn "Python 3.8+ not found. Python-based detection tools (burstiness, n-gram, syntactic, content, perplexity) will be unavailable. TypeScript-only tools still work."

If Python available, check venv:
```bash
ls "$GHOSTWRITER_ROOT/.venv" 2>/dev/null || echo "MISSING"
```
If missing:
```bash
python3 -m venv "$GHOSTWRITER_ROOT/.venv"
"$GHOSTWRITER_ROOT/.venv/bin/pip" install -r "$GHOSTWRITER_ROOT/requirements.txt"
```

---

## Step 1: Check for Existing Setup

Check if `.ghostwriter/config.json` exists.

**If it exists:** Read it and ask:

> ".ghostwriter/ already exists. What would you like to do?"
> 1. Add a new publication
> 2. Add a new author
> 3. Reconfigure from scratch
> 4. Just reinstall dependencies

- Option 1: Skip to Step 3 (author selection), then Step 4
- Option 2: Skip to Step 3 (create new author only), then STOP
- Option 3: Delete `.ghostwriter/` and start fresh from Step 2
- Option 4: Re-run Step 0 dependency checks only, then STOP

**If it doesn't exist:** Continue to Step 2.

---

## Step 2: Create .ghostwriter Directory

```bash
mkdir -p .ghostwriter/learned-patterns
```

Write `.ghostwriter/config.json`:
```json
{
  "publications_dir": "./publications",
  "authors_dir": "./authors"
}
```

Copy seed patterns from plugin:
```bash
cp "$GHOSTWRITER_ROOT/seed-patterns/global.md" .ghostwriter/learned-patterns/global.md
cp "$GHOSTWRITER_ROOT/seed-patterns/blog.md" .ghostwriter/learned-patterns/blog.md 2>/dev/null || true
cp "$GHOSTWRITER_ROOT/seed-patterns/book.md" .ghostwriter/learned-patterns/book.md 2>/dev/null || true
```

---

## Step 3: Author Profile

Check if authors/ directory has existing profiles:
```bash
ls authors/*/profile.yml 2>/dev/null
```

**If profiles exist:** Ask:

> "I found these existing author profiles:"
> 1. {author-name} (authors/{slug}/profile.yml)
> 2. ...
> N. Create a new author
>
> "Which author is writing this publication?"

Read the chosen profile.yml to get the author name.

**If no profiles or user chose "Create new":**

Ask these questions ONE AT A TIME:

1. "What's your name (as it should appear in your writing)?"
2. "Describe your professional background in 1-2 sentences (profession, industry, years of experience)"
3. "What personality traits describe your writing voice? (e.g., direct, opinionated, pragmatic, dry-wit, empathetic, analytical)"
4. "What's your native language?"
5. "Any other languages you write in? (or 'none')"

Slugify the name: lowercase, replace spaces/special chars with hyphens.

Generate `authors/{slug}/profile.yml`:
```yaml
# Author Profile: {Name}
# Referenced by publication configs via presets.

author:
  name: "{Name}"
  personality:
    - {trait1}
    - {trait2}
    # ... from question 3

  background:
    profession: "{from question 2}"
    industry: "{from question 2}"
    years_experience: {from question 2, or 0}

  writing_background:
    native_language: "{from question 4}"
    # other_languages: [{from question 5}]
```

Create empty learned patterns:
```bash
mkdir -p "authors/{slug}"
```

Write `authors/{slug}/learned-patterns.md`:
```markdown
# Learned Patterns: {Name}

Patterns specific to this author's voice and writing preferences.
Updated automatically by the ai-engineer during humanization rounds.
```

---

## Step 4: Publication Name

Ask: "What's the name of this publication?" (e.g., "My Tech Blog", "The Art of Debugging")

Slugify: lowercase, replace spaces with hyphens, strip non-alphanumeric except hyphens.

---

## Step 5: Choose Medium

Ask:

> "What type of writing is this?"
> 1. **Blog** — personal essays, opinion pieces, informal content
> 2. **Book** — fiction, nonfiction, technical, or children's
> 3. **Press** — news reporting, opinion columns, editorials
> 4. **Email** — newsletters, business communications
> 5. **Academic** — research papers, scholarly writing
> 6. **Docs** — technical documentation, reference material

---

## Step 6: Choose Style

Based on the medium, present style options:

| Medium | Styles | Preset |
|--------|--------|--------|
| Blog | personal | casual |
| Book | fiction, nonfiction, technical, children | book, book, technical-book, casual |
| Press | news, opinion | business, book |
| Email | newsletter, business | casual, business |
| Academic | paper | academic |
| Docs | technical | technical-docs |

If only one style exists for the medium, use it automatically and skip the question.

---

## Step 7: Create Publication Directory

```bash
PUB_SLUG="{slugified-name}"
mkdir -p "publications/$PUB_SLUG/content/original"
mkdir -p "publications/$PUB_SLUG/content/revised"
mkdir -p "publications/$PUB_SLUG/content/humanized"
mkdir -p "publications/$PUB_SLUG/content/final"
mkdir -p "publications/$PUB_SLUG/pipeline"
```

---

## Step 8: Generate Config

Determine the preset name from the medium/style combination (see table in Step 6).

Write `publications/{pub-slug}/config.yml`:

```yaml
# =============================================================================
# {Publication Name} — Writing Config
# =============================================================================
# Generated by /ghostwriter:setup
# Modify this file to customize detection thresholds and writing rules.
# =============================================================================

version: '1.0'

presets:
  - ../../authors/{author-slug}/profile.yml
  - {preset-name}

publication:
  name: "{Publication Name}"
  media: {media}
  audience: {from template}

writing_style:
  tone: {from template}
  formality: {from template}
  voice: {from template}

# Detection Rules
# Uncomment and modify to override preset defaults.
# See the preset files for available thresholds.
#
# rules:
#   punctuation:
#     em_dash:
#       ai_threshold: 4.0
#   vocabulary:
#     ai_vocab_density:
#       ai_threshold: 10
```

---

## Step 9: Create Publication Learned Patterns

Write `publications/{pub-slug}/learned-patterns.md`:

```markdown
# Learned Patterns: {Publication Name}

Patterns specific to this publication.
Updated automatically by the ai-engineer during humanization rounds.
```

---

## Step 10: Validate Config

```bash
eval "$(ghostwriter-env.sh)"
bun "$GHOSTWRITER_ROOT/agent/tools/lib/config-loader.ts" "publications/$PUB_SLUG/config.yml" --validate 2>&1
```

If validation fails, report the error and suggest fixes.
If the config-loader doesn't support --validate, just try loading the config and check for errors.

---

## Step 11: Print Summary

```
Setup complete!

Publication: {Publication Name}
Config:      publications/{pub-slug}/config.yml
Author:      authors/{author-slug}/profile.yml
Patterns:    .ghostwriter/learned-patterns/

Quick start:
  /ghostwriter:analyze <file.md>
  /ghostwriter:rewrite <input.md> <output.md> publications/{pub-slug}/config.yml
  /ghostwriter:humanize <input.md> <output.md> publications/{pub-slug}/config.yml

To add another publication, run /ghostwriter:setup again.
```
