---
name: gw-migrate
description: Migrate from v1 project layout to v2 (.ghostwriter/ workspace)
argument-hint: [--dry-run]
---

# Migrate to v2 Layout

Migrates a v1 ghostwriter project layout to v2. In v1, `authors/` and `publications/` lived at the project root. In v2, everything lives inside `.ghostwriter/`.

## Usage

```bash
/ghostwriter:gw-migrate              # Migrate and move files
/ghostwriter:gw-migrate --dry-run    # Show what would change without moving anything
```

## What it does

Detects v1 layout (authors/publications at project root) and moves them inside `.ghostwriter/`.

### v1 layout (before)

```
my-project/
├── .ghostwriter/
│   ├── config.json              # v1 had this
│   └── learned-patterns/
├── authors/
│   └── jane-doe/
│       ├── profile.yml          # v1 name
│       └── learned-patterns.md
└── publications/
    └── my-blog/
        ├── config.yml
        ├── learned-patterns.md
        ├── content/             # v1 created content dirs here
        └── pipeline/
```

### v2 layout (after)

```
my-project/
├── .ghostwriter/
│   ├── learned-patterns/
│   ├── authors/
│   │   └── jane-doe/
│   │       ├── author-persona.yml
│   │       └── learned-patterns.md
│   └── publications/
│       └── my-blog/
│           ├── config.yml
│           ├── learned-patterns.md
│           └── pipeline/
```

## Prerequisites

```bash
eval "$(ghostwriter-env.sh)"
```

## Migration Steps

### Step 1: Detect layout version

Check which layout the project uses:

```bash
# v1 signals:
V1_AUTHORS=false
V1_PUBS=false
V1_CONFIG_JSON=false

[ -d "authors" ] && [ ! -d ".ghostwriter/authors" ] && V1_AUTHORS=true
[ -d "publications" ] && [ ! -d ".ghostwriter/publications" ] && V1_PUBS=true
[ -f ".ghostwriter/config.json" ] && V1_CONFIG_JSON=true
```

If none of these are true, report: "No v1 layout detected. Already on v2 or no setup found." and STOP.

If `.ghostwriter/` doesn't exist at all, report: "No ghostwriter setup found. Run `/ghostwriter:gw-setup` instead." and STOP.

### Step 2: Report what will change

Display a migration plan:

```
Ghostwriter v1 → v2 Migration

Detected v1 layout:
  {✓ if V1_AUTHORS}  authors/ at project root
  {✓ if V1_PUBS}     publications/ at project root
  {✓ if V1_CONFIG_JSON}  .ghostwriter/config.json (no longer needed)

Changes:
  {if V1_AUTHORS}
  - Move authors/ → .ghostwriter/authors/
  - Rename profile.yml → author-persona.yml (in each author dir)
  {/if}
  {if V1_PUBS}
  - Move publications/ → .ghostwriter/publications/
  - Update preset paths in config.yml files (../../authors/ → ../../authors/)
  - Remove content/ subdirs if empty (v2 points to external content)
  {/if}
  {if V1_CONFIG_JSON}
  - Remove .ghostwriter/config.json (no longer needed)
  {/if}
```

If `--dry-run`, display the plan and STOP.

Otherwise, ask: "Proceed with migration? (y/n)"

### Step 3: Move authors

If `V1_AUTHORS`:

```bash
# Ensure target exists
mkdir -p .ghostwriter/authors

# Move each author dir
for author_dir in authors/*/; do
  slug=$(basename "$author_dir")
  mv "authors/$slug" ".ghostwriter/authors/$slug"
done

# Remove empty authors/ dir
rmdir authors 2>/dev/null || true
```

### Step 4: Rename profile.yml → author-persona.yml

For each author in `.ghostwriter/authors/`:

```bash
for author_dir in .ghostwriter/authors/*/; do
  if [ -f "$author_dir/profile.yml" ]; then
    mv "$author_dir/profile.yml" "$author_dir/author-persona.yml"
  fi
done
```

### Step 5: Move publications

If `V1_PUBS`:

```bash
mkdir -p .ghostwriter/publications

for pub_dir in publications/*/; do
  slug=$(basename "$pub_dir")
  mv "publications/$slug" ".ghostwriter/publications/$slug"
done

rmdir publications 2>/dev/null || true
```

### Step 6: Update preset paths in publication configs

For each publication config, the preset path to the author profile needs updating if the relative path changed.

In v1: `presets: [../../authors/{slug}/profile.yml, ...]`
In v2: `presets: [../../authors/{slug}/author-persona.yml, ...]`

The relative path `../../authors/` still works because both the publication config and authors dir moved into `.ghostwriter/` together. Only the filename changed.

For each config:

```bash
for config in .ghostwriter/publications/*/config.yml; do
  # Replace profile.yml with author-persona.yml in preset references
  sed -i '' 's/profile\.yml/author-persona.yml/g' "$config"
done
```

### Step 7: Clean up v1 content directories

In v1, publications had `content/` subdirectories (original/, revised/, humanized/, final/). In v2, content lives externally and is referenced via `content.root`.

For each publication, check if `content/` exists and whether it has files:

```bash
for pub_dir in .ghostwriter/publications/*/; do
  content_dir="$pub_dir/content"
  if [ -d "$content_dir" ]; then
    file_count=$(find "$content_dir" -type f | wc -l)
    if [ "$file_count" -eq 0 ]; then
      # Empty content dirs — safe to remove
      rm -r "$content_dir"
    else
      echo "WARNING: $content_dir has $file_count files. Not removing."
      echo "  Move these files to your content directory and add content.root to the config."
    fi
  fi
done
```

### Step 8: Add content section to configs (if missing)

For each publication config that doesn't have a `content:` section, add a placeholder:

Read each config. If it doesn't contain `content:`, append:

```yaml

# TODO: Add content location (required for v2)
# content:
#   root: ../../../path/to/your/content
#   glob: "**/*.md"
```

Report which configs need the content section filled in.

### Step 9: Remove config.json

If `V1_CONFIG_JSON`:

```bash
rm .ghostwriter/config.json
```

### Step 10: Report

```
Migration complete!

Moved:
  {if V1_AUTHORS}  ✓ authors/ → .ghostwriter/authors/
  ✓ Renamed profile.yml → author-persona.yml{/if}
  {if V1_PUBS}  ✓ publications/ → .ghostwriter/publications/{/if}
  {if V1_CONFIG_JSON}  ✓ Removed .ghostwriter/config.json{/if}

{if any configs missing content section}
ACTION REQUIRED:
  These publication configs need a content.root path:
  - .ghostwriter/publications/{slug}/config.yml
  
  Edit each config and add:
    content:
      root: ../../../path/to/your/content
      glob: "**/*.md"
{/if}

{if any content dirs had files}
ACTION REQUIRED:
  These publication content directories had files that were NOT moved:
  - .ghostwriter/publications/{slug}/content/ ({N} files)
  
  Move the files to your preferred content location, then update the
  publication config's content.root to point there.
{/if}
```
