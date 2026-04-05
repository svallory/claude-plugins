---
name: gw-setup
description: Interactive setup wizard for the ghostwriter plugin. Creates author personas, publications, and writing configs. Run this before using any other ghostwriter command.
user-invocable: true
---

# Ghostwriter Setup Wizard

Interactive setup for the ghostwriter plugin. Creates your author persona, publication config, and initializes learned patterns.

## Usage

```
/ghostwriter:gw-setup
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

Check if `.ghostwriter/` directory exists:
```bash
ls .ghostwriter 2>/dev/null || echo "MISSING"
```

**If it exists:** Ask:

> ".ghostwriter/ already exists. What would you like to do?"
> 1. Add a new publication
> 2. Add a new author persona
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
mkdir -p .ghostwriter/authors
mkdir -p .ghostwriter/publications
```

Copy seed patterns from plugin:
```bash
cp "$GHOSTWRITER_ROOT/seed-patterns/global.md" .ghostwriter/learned-patterns/global.md
cp "$GHOSTWRITER_ROOT/seed-patterns/blog.md" .ghostwriter/learned-patterns/blog.md 2>/dev/null || true
cp "$GHOSTWRITER_ROOT/seed-patterns/book.md" .ghostwriter/learned-patterns/book.md 2>/dev/null || true
```

Do NOT create config.json. The existence of `.ghostwriter/` signals that setup has been run.

---

## Step 3: Author Persona

Check if any author personas exist:
```bash
ls .ghostwriter/authors/*/author-persona.yml 2>/dev/null
```

**If personas exist:** Ask:

> "I found these existing author personas:"
> 1. {author-name} (.ghostwriter/authors/{slug}/author-persona.yml)
> 2. ...
> N. Create a new author persona
>
> "Which author/persona is writing this publication?"

Read the chosen author-persona.yml to get the author name.

**If no personas exist or user chose "Create new":**

Explain first:
> "An 'author' in ghostwriter is a writing persona — it can be a real person, a team, or a brand voice. 'Acme Engineering Team' is as valid as 'Jane Doe'."

Ask these questions ONE AT A TIME:

1. "What's the name of this writing persona? (e.g., your name, your team name, or your brand)"
2. "Describe the professional background in 1-2 sentences (profession, industry, years of experience)"
3. "What personality traits describe this writing voice? (e.g., direct, opinionated, pragmatic, dry-wit, empathetic, analytical)"
4. "What's the native language for this persona?"
5. "Any other languages this persona writes in? (or 'none')"

Slugify the name: lowercase, replace spaces/special chars with hyphens.

Generate `.ghostwriter/authors/{slug}/author-persona.yml`:
```yaml
# Author Persona: {Name}
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
mkdir -p ".ghostwriter/authors/{slug}"
```

Write `.ghostwriter/authors/{slug}/learned-patterns.md`:
```markdown
# Learned Patterns: {Name}

Patterns specific to this persona's voice and writing preferences.
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

## Step 7: Content Location

Ask these questions ONE AT A TIME:

1. "Where does your content live? (path to directory containing your .md files, relative to this project root)"
2. "What file pattern should be used? (default: `**/*.md`)"
3. "How should files be processed — edit in-place, or use a staged workflow? (staged: original → revised → humanized → final)"

For the staged workflow question, explain:
> "A staged workflow keeps immutable copies at each phase so you can always roll back. In-place editing is simpler but replaces files directly."

If user chooses **staged**: ask "Use the default stages (original/revised/humanized/final) or customize? (default/customize)"
- If customize: collect comma-separated stage names, use them in order

Store:
- `content_root` = user's path (e.g., `docs/`, `chapters/`, `content/`)
- `content_glob` = file pattern (e.g., `**/*.md`)
- `workflow` = `inplace` or `staged`
- `stages` = list of stage names (only if staged)

---

## Step 8: Create Publication Directory

```bash
PUB_SLUG="{slugified-name}"
mkdir -p ".ghostwriter/publications/$PUB_SLUG/pipeline"
```

Do NOT create content/ subdirectories here. Content lives at the user's specified path.

---

## Step 9: Generate Config

Determine the preset name from the medium/style combination (see table in Step 6).

Compute `content_root_relative`: path from `.ghostwriter/publications/{pub-slug}/` to the user's content root. (e.g., if content is at `docs/` and config is at `.ghostwriter/publications/my-docs/config.yml`, the relative path is `../../../docs`)

Write `.ghostwriter/publications/{pub-slug}/config.yml`:

```yaml
# =============================================================================
# {Publication Name} — Writing Config
# =============================================================================
# Generated by /ghostwriter:gw-setup
# Modify this file to customize detection thresholds and writing rules.
# =============================================================================

version: '1.0'

presets:
  - ../../authors/{author-slug}/author-persona.yml
  - {preset-name}

publication:
  name: "{Publication Name}"
  media: {media}
  audience: {from template}

content:
  root: "{content_root_relative}"   # path from this config file to content directory
  glob: "{content_glob}"            # e.g., **/*.md
  # stages:                         # only present if staged workflow chosen
  #   - original
  #   - revised
  #   - humanized
  #   - final

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

If user chose staged workflow, uncomment and populate the `stages:` block with their chosen stages.

---

## Step 10: Create Publication Learned Patterns

Write `.ghostwriter/publications/{pub-slug}/learned-patterns.md`:

```markdown
# Learned Patterns: {Publication Name}

Patterns specific to this publication.
Updated automatically by the ai-engineer during humanization rounds.
```

---

## Step 11: Validate Config

```bash
eval "$(ghostwriter-env.sh)"
bun "$GHOSTWRITER_ROOT/agent/tools/lib/config-loader.ts" ".ghostwriter/publications/$PUB_SLUG/config.yml" --validate 2>&1
```

If validation fails, report the error and suggest fixes.
If the config-loader doesn't support --validate, just try loading the config and check for errors.

---

## Step 12: Print Summary

```
Setup complete!

Publication: {Publication Name}
Config:      .ghostwriter/publications/{pub-slug}/config.yml
Author:      .ghostwriter/authors/{author-slug}/author-persona.yml
Patterns:    .ghostwriter/learned-patterns/
Content:     {content_root} ({content_glob})

Quick start:
  /ghostwriter:gw-analyze {content_root}/example-file.md {pub-slug}
  /ghostwriter:gw-rewrite {content_root}/example-file.md {pub-slug}
  /ghostwriter:gw-humanize {content_root}/example-file.md {pub-slug}
  /ghostwriter:gw-humanize-all {pub-slug}

To add another publication, run /ghostwriter:gw-setup again.
```
