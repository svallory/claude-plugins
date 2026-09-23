# OKF — Open Knowledge Format plugin

A skill for working with [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format) (OKF) bundles — Google Cloud's open spec for representing knowledge as a directory of markdown files with YAML frontmatter.

## What it does

The `okf-open-knowledge-format` skill teaches your agent to:

- **Create** OKF v0.2 bundles from scratch — concept documents, cross-links, `index.md`/`log.md`, provenance (`sources`), trust (`generated`/`verified`), and lifecycle (`status`/`stale_after`) fields
- **Create Attested Computations** — the v0.2 concept type for sanctioned, verifiable calculations (`runtime`, `parameters`, `executor`, `attester`)
- **Validate** bundles against the 3 conformance rules, preferring [okflint](https://github.com/mattdav/okflint) when installed and falling back to the bundled `scripts/validate.sh`
- **Enrich** existing concepts with schema sections, examples, provenance, and trust signals
- **Migrate** v0.1 bundles to v0.2 (`timestamp` → `generated.at`, `# Citations` → `sources`)
- **Convert** Notion exports, Obsidian vaults, and CSVs into conformant bundles

## Contents

```
skills/okf/
├── SKILL.md                    # The skill
├── references/
│   ├── spec-v02.md             # OKF v0.2 spec (verbatim copy of upstream)
│   ├── spec-v01.md             # OKF v0.1 spec (legacy, for migration)
│   ├── examples.md             # Complete conformant bundle examples
│   └── conversion.md           # Notion / Obsidian / CSV conversion guides
└── scripts/
    └── validate.sh             # Fallback validator (bash, no dependencies)
```

## Install

```
/plugin install okf@svallory-plugins
```

Or via the [skills CLI](https://skills.sh):

```
npx skills add svallory/claude-plugins --skill okf-open-knowledge-format
```

## Credits

Skill originally authored by [ft.ia.br](https://github.com/fabricioctelles/skills); spec by Google Cloud. This plugin packages both with a fallback validator.
