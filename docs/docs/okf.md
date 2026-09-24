# OKF

Create, validate, and enrich [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format) bundles — the open spec for representing organizational knowledge as a directory of markdown files with YAML frontmatter, readable by agents and humans alike.

The skill covers v0.2 in full: provenance, trust tiers, lifecycle, and Attested Computations.

## Install

```
/plugin marketplace add svallory/tutor
/plugin install okf@tutor
```

Or as a standalone skill via the [skills CLI](https://skills.sh):

```
npx skills add svallory/tutor --skill okf-open-knowledge-format
```

No dependencies are required — the bundled validator is pure bash.

## When it triggers

On "OKF", "Open Knowledge Format", "knowledge bundle", "create a knowledge base for agents", "validate OKF", "convert to OKF", "enrich knowledge docs", "agent-readable knowledge", "LLM wiki", "knowledge catalog", "kcmd" — and on plain requests like *"make this folder OKF conformant"*.

## Core concepts

| Term | Meaning |
|---|---|
| **Bundle** | A directory tree of `.md` files |
| **Concept** | Any `.md` file that isn't a reserved filename |
| **Concept ID** | The file path minus `.md` — `tables/users.md` → `tables/users` |
| **Actor** | Who did something: `human:<id>`, `process:<id>`, or `<producer>/<version>` |
| **Trust tier** | Derived from `verified`, never stored |

Two filenames are reserved at any level: `index.md` and `log.md`. Everything else is a concept.

The format is minimally opinionated — **only `type` is required.**

## Frontmatter

### Core fields

| Field | Required | Notes |
|---|---|---|
| `type` | **Yes** | Free-form, not centrally registered — `BigQuery Table`, `Metric`, `Playbook`, `API Endpoint` |
| `title` | Recommended | Consumers may derive it from the filename |
| `description` | Recommended | A single sentence |
| `resource` | Recommended | Canonical URI of the underlying asset; absent for abstract concepts |
| `tags` | Optional | List of short strings |

Producers may add any keys they like. Consumers **must not** reject unrecognized fields and should preserve them on round-trip.

### Trust

```yaml
generated:
  by: reference_agent/gemini-2.5-pro
  at: 2026-06-30T14:00:00Z
verified:
  - by: human:ahormati
    at: 2026-07-02T09:00:00Z
```

`generated.at` marks the last meaningful content change; `verified` is a list of independent confirmations, and "how recently" means the latest `at`. A bare mapping must be read as a one-element list. The two are independent — content can change without re-confirmation, and vice versa.

Trust tiers are **derived, never written**:

| Condition | Tier |
|---|---|
| No `verified` key | unverified |
| Verified only by non-`human:` actors | machine-confirmed |
| Verified by a `human:<id>` actor | human-reviewed |

This is why producers must use the `human:` prefix for hand-authored or human-confirmed content — trust classification keys off it. These are advisory signals, not access control.

### Lifecycle

- `status` — `draft`, `stable`, or `deprecated`. Absent means `stable`.
- `stale_after` — an **absolute** ISO 8601 instant, deliberately not a relative TTL. Content is stale once `now >= stale_after`.

### Provenance

```yaml
sources:
  - id: q3-revenue-model
    resource: https://internal.example.com/models/q3
    title: Q3 Revenue Model
    author: human:ahormati
    usage_count: 412
    last_modified: 2026-05-14T00:00:00Z
usage_window:
  from: 2026-04-01T00:00:00Z
  to: 2026-06-30T00:00:00Z
```

Only `resource` is required within an entry. It can be something followable (a URL or bundle-relative path) or a scope descriptor that can't be followed, like `all queries in BigQuery project X`.

OKF stores credibility *signals* — `author`, `usage_count`, `last_modified` — but never a credibility **score**, which would be subjective, unportable, and quick to go stale. Read `usage_count` as liveness or trend, not as a cross-kind ranking.

Per-claim attribution uses markdown footnotes whose label is a `sources[].id`. Keys, not positions: agents constantly rewrite documents, and `sources[0]` misattributes silently the moment the list is reordered.

Every timestamp is ISO 8601 with an explicit UTC offset.

## Cross-links

Absolute bundle-relative links (`/tables/customers.md`) are preferred; relative links work too. The *kind* of relationship belongs in the prose around the link, not in link syntax — and links get woven into the body, never collected into a standalone "links" section.

**Broken links are explicitly allowed.** A bundle is not unconformant because a link doesn't resolve.

## Index and log files

`index.md` may appear in any directory and carries **no frontmatter** — with one exception: the bundle-root `index.md` may declare `okf_version: "0.2"`. Its body is sections of bullets, each a markdown link to a concept followed by ` - ` and that concept's own `description`, grouped under `##` headings such as `## Tables`.

`log.md` is a flat, date-grouped list, newest first, with `## YYYY-MM-DD` headings that must be ISO 8601.

## Attested Computations

The v0.2 concept type for calculations where "did the sanctioned thing actually run" matters — financial metrics, audited KPIs, anything needing a verifiable trail.

```yaml
type: Attested Computation
runtime: bigquery
parameters:
  - name: fiscal_quarter
    type: string
    required: true
executor:
  resource: /references/bq-executor.md
  receipt: [job_id, executed_sql, result]
attester:
  resource: /references/bq-attester.md
```

| Field | Notes |
|---|---|
| `runtime` | **Required** for this type — `bigquery`, `postgres`, `dbt`, `python`, `Looker` |
| `parameters` | List of `{ name, type, required }`; binding semantics follow `runtime` |
| `computation` | Optional path; if absent, the body's `# Computation` fence *is* the computation |
| `executor` | Where it runs, plus the `receipt` fields a run must return |
| `attester` | Deterministic, no-LLM code that inspects a receipt and returns a verdict |

Four rules govern agent behavior here:

1. The agent supplies **parameter values only** — it must never author or edit the computation.
2. The computation lives inline or at an external path.
3. The executor produces a receipt.
4. The attester is deterministic — no LLM involved.

The attester independently re-derives the binding and compares it against the expanded, compiled artifact in the receipt. Consumers gate on the result: refuse to display a failing attestation, and warn or refuse once `stale_after` has passed.

`verified` and attestation answer different questions: `verified` confirms the *definition* still matches policy (document-level, slow, stored), while attestation confirms a single *run* (per-call, runtime, not stored). Both are needed.

## Conformance

A bundle is conformant when all three hold:

1. Every non-reserved `.md` file has a parseable YAML frontmatter block.
2. Every frontmatter block has a non-empty `type`.
3. Every reserved filename that exists follows the index/log rules.

Consumers **must not** reject a bundle for missing optional fields, unknown `type` values, unknown extra keys, broken cross-links, or missing `index.md` files.

## Validating

The skill prefers [okflint](https://github.com/mattdav/okflint) — an LLM-free linter with 18 rules across three tiers — and asks before installing it:

```bash
uv tool install okflint          # recommended
pip install okflint

okflint validate --manifest okf-base.yaml ./bundle/
okflint validate --manifest okf-base.yaml --json ./bundle/
okflint audit --bundle ./bundle --vault ./bundle    # always exits 0
```

`okflint validate` exits `0` on pass, `1` on a conformance failure, `2` on a bad or unreadable manifest.

If you'd rather not install anything, the bundled fallback runs with no dependencies:

```bash
scripts/validate.sh <bundle-path>
```

It reports errors `E1` (no frontmatter), `E2` (missing or empty `type`), `E3` (non-root `index.md` has frontmatter), and `E4` (Attested Computation missing `runtime`), plus warnings for missing `title`/`description`, legacy `timestamp` without `generated`, a `log.md` with no ISO dates, a `sources` entry without `resource`, a past `stale_after`, and unknown `status` values. It exits with the error count and prints a trust, provenance, and lifecycle summary.

The fallback does **not** resolve cross-links or check for per-directory index files — use okflint if you need those.

## Migrating v0.1 → v0.2

Two breaking changes:

- `timestamp` → `generated.at`
- The body's `# Citations` section → frontmatter `sources`

Consumers should keep falling back to both legacy forms. Everything else in v0.2 is additive: the `sources`/`usage_window` family, `generated`/`verified`, `status`/`stale_after`, the Attested Computation type, the `# Computation` heading, and the actor convention.

## Converting existing content

The skill handles Notion exports, Obsidian vaults, and CSV or spreadsheet sources, with column-to-field mapping tables and edge cases documented in its conversion reference.

## Guardrails

The skill holds these lines while working:

- **Never invent data** — no fabricated sources, counts, or timestamps.
- **Preserve unknown fields** on round-trip.
- **Don't impose taxonomy** — `type` is free-form for a reason.
- **Broken links are OK** — don't "fix" them by deleting.
- **Minimal by default** — only `type` is required.
- **Ask before assuming.**
- **Respect the trust hierarchy** — never claim `human:` verification on the agent's behalf.
- **Computation integrity** — fill parameter values, never edit the computation.

## Serving bundles

For the Google Cloud Knowledge Catalog path, the skill covers the `kcmd` CLI (`kcmd init`, `pull`, `push --dry-run`, `push`) and its MCP server mode, which exposes `pull`, `push`, `list-entries`, `lookup-entry`, and `modify-entry`.

## Credits

Skill originally authored by [ft.ia.br](https://github.com/fabricioctelles/skills); the specification is by Google Cloud. This plugin packages both, plus a dependency-free fallback validator. Apache-2.0.

## See also

- [Plugin overview](/docs/) — the rest of the marketplace.
