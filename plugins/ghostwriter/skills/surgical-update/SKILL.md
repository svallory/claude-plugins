---
name: surgical-update
description: Apply targeted fixes to specific sentences without regenerating entire text
user-invocable: false
tools: Read, Write, Bash
---

# Surgical Update Skill

Apply targeted, sentence-level fixes to text. This skill is loaded when the Optimizer determines that surgical fixes are more efficient than full regeneration.

## When to Use

- **Em-dash or punctuation density issues** — the most common case
- **Auxiliary verb density issues** — progressive, passive, modal, and perfect constructions
- **Pronoun density issues** — pronoun clusters and chains
- **Sentence structure issues** — syntactic monotony, shallow depth, missing compound-complex
- **Noun density issues** — reduced noun frequency, vague references
- **Vocabulary replacements** in specific sentences
- **Targeted style adjustments** that affect few sentences
- **Punctuation ratio fixes** (em-dash:semicolon imbalance)

## When NOT to Use

- More than 30% of sentences need fixing (use full regeneration instead)
- Issues are structural (paragraph flow, section organization)
- Voice or tone problems that pervade the entire text

## Workflow: Punctuation Fixes

### Step 1: Extract Sentences

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/extract-sentences.ts" {TEXT_FILE} --out {SESSION_PATH}/sentences.json
```

This produces a JSON file with every sentence assigned a sequential ID.

### Step 2: Analyze Punctuation

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-punctuation.ts" {TEXT_FILE} --target-density 4.0 --out {SESSION_PATH}/punctuation-analysis.json
```

This identifies:
- Which sentences have em-dashes (by ID)
- Em-dash stacking patterns (consecutive paragraphs)
- Semicolon deficiency
- Em-dash:semicolon ratio problems

### Step 3: Generate Replacements

Using the full text for context and the list of problematic sentence IDs, generate replacement sentences that:

1. **Preserve meaning** — the sentence must say the same thing
2. **Fix the flagged issue** — remove em-dash, add semicolon, etc.
3. **Sound natural** — the replacement must flow with surrounding sentences
4. **Use varied punctuation** — don't replace all em-dashes with the same alternative

**Replacement priority for em-dashes:**
1. Periods (40%) — for thoughts that can stand alone
2. Semicolons (30%) — for related independent clauses
3. Parentheses (15%) — for true asides and clarifications
4. Commas (10%) — for brief pauses
5. Keep em-dash (5%) — only for genuine interruptions

### Step 4: Apply Replacements

Write replacements to a JSON file:

```json
{
  "replacements": [
    {"id": 3, "original": "The system was compromised — attackers exploited trust.", "text": "The system was compromised; attackers exploited trust."},
    {"id": 7, "original": "Security came second to convenience — always.", "text": "Security came second to convenience."}
  ]
}
```

Then apply:

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/replace-sentences.ts" --source {TEXT_FILE} --replacements {SESSION_PATH}/replacements.json
```

### Step 5: Verify Fix

Run the analyzer again to confirm the issues are resolved:

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-punctuation.ts" {TEXT_FILE}
```

Check that:
- Em-dash density is under target
- No stacking patterns remain
- Semicolon density is acceptable

---

## Workflow: Auxiliary Verb Fixes

Auxiliary verb density (is, are, was, were, have, has, had, will, would, can, could, may, might, must) above 5.5% is a strong AI detection signal. LLMs cannot self-regulate this during generation, so surgical post-processing is required.

### Step 1: Analyze Auxiliary Verbs

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-auxiliary-verbs.ts" {TEXT_FILE} --target-density 5.0 --out {SESSION_PATH}/auxiliary-analysis.json
```

This identifies:
- Which sentences have the highest auxiliary verb density (by ID and priority)
- Pattern types: progressive, passive, perfect, modal, modal_perfect, do_emphasis
- Per-sentence auxiliary counts and specific verbs found
- Budget: how many sentences to fix to bring document density under target

### Step 2: Generate Replacements

For each flagged sentence (focus on `critical` and `high` priority first), generate a replacement that:

1. **Eliminates or reduces auxiliary verbs** — apply the pattern-specific transformations
2. **Preserves meaning** — the sentence must say the same thing
3. **Sounds natural** — the replacement must flow with surrounding sentences
4. **Maintains voice** — don't make conversational prose stiff

**Transformation strategies by pattern type:**

| Pattern | Example Before | Example After | Strategy |
|---------|---------------|---------------|----------|
| `progressive` | "The system **is running** slowly" | "The system **runs** slowly" | Simple tense over progressive |
| `passive` | "The breach **was caused** by attackers" | "Attackers **caused** the breach" | Active voice |
| `perfect` | "The attack **has occurred** before" | "The attack **occurred** before" | Simple past over perfect |
| `modal` | "This **would fail** under pressure" | "This **fails** under pressure" | Direct assertion over modal hedging |
| `modal_perfect` | "They **could have been** compromised" | "They **were** compromised" | Simplify to past tense |
| `do_emphasis` | "The system **does require** auth" | "The system **requires** auth" | Remove do-support |

**Additional strategies for high-`be` documents:**
- "There **is** a problem with..." -> "A problem exists with..." or just "The problem..."
- "It **was** clear that..." -> "Clearly,..." or restructure
- "The protocol **is** vulnerable" -> "The protocol **remains** vulnerable" (if `be` is the main offender, swap some to non-auxiliary verbs)

**IMPORTANT:** Don't eliminate ALL auxiliary verbs from a sentence. Aim to remove 1-2 per flagged sentence. The goal is reducing document-level density, not zeroing out individual sentences.

### Step 3: Apply Replacements

Write replacements JSON and apply exactly like punctuation fixes:

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/replace-sentences.ts" --source {TEXT_FILE} --replacements {SESSION_PATH}/aux-replacements.json
```

### Step 4: Verify Fix

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-auxiliary-verbs.ts" {TEXT_FILE} --target-density 5.0
```

Check that:
- Document auxiliary density is under 5.5% (hard ceiling)
- Ideally in the 4.5-5.0% range
- No new awkward phrasing was introduced

If density is still over 5.5%, run a second pass targeting the next batch of flagged sentences. Maximum 2 passes.

---

## Workflow: Pronoun Fixes

Pronoun density above 7% is an AI detection signal. The tool groups correlated sentences (pronoun + antecedent) for contextual replacement.

### Step 1: Analyze Pronouns

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-pronouns.ts" {TEXT_FILE} --target-density 7.0 --out {SESSION_PATH}/pronoun-analysis.json
```

### Step 2: Generate Replacements

For each flagged group (focus on `critical` and `high` priority), generate replacements using the suggested strategies:

| Strategy | Example |
|----------|---------|
| Replace sentence-initial pronoun | "**They** exploited the flaw" -> "**The attackers** exploited the flaw" |
| Replace possessive pronouns | "**its** infrastructure" -> "**the network's** infrastructure" |
| Break pronoun chains | Restructure to use direct nouns instead of it/they chains |
| Replace demonstrative pronouns | "**This** caused failures" -> "**This design flaw** caused failures" |

### Step 3: Apply and Verify

Same pattern: write JSON, apply via `replace-sentences.ts`, re-run analyzer. Target: <7% for book chapters, <6% for blogs.

---

## Workflow: Sentence Structure Fixes

The detector flags four interconnected syntactic monotony signals: missing compound-complex sentences (ratio < 5%), low depth variance (< 1.0), shallow dependency structure (avg depth < 4.0), and high sentence uniformity (> 0.8). These are structural patterns LLMs struggle to self-regulate.

### Step 1: Analyze Sentence Structure

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-sentence-structure.ts" {TEXT_FILE} --out {SESSION_PATH}/structure-analysis.json
```

This identifies:
- Which of the 4 signals are triggered (check `signals` array)
- Which sentences are simplest and shallowest (by ID and priority)
- Merge candidates — adjacent simple sentences that can be combined
- Compound sentences that can be upgraded to compound-complex

### Step 2: Generate Replacements

For each flagged sentence (focus on `critical` and `high` priority), generate a replacement that increases structural complexity:

**Transformation strategies:**

| Issue | Transformation | Example |
|-------|---------------|---------|
| Simple + merge candidate | Combine into compound-complex | "The protocol assumed trust." + "Attackers exploited that assumption." -> "Although the protocol assumed trust, attackers exploited that assumption and the breach went undetected." |
| Shallow depth | Add subordinate clause | "The system failed." -> "The system, which had been running without oversight for years, failed." |
| Compound -> compound-complex | Add subordination | "The carriers objected and the regulators agreed." -> "The carriers objected because the costs were prohibitive, and the regulators agreed." |
| Very short / uniform | Expand with detail | "It worked." -> "Against all expectations, the crude workaround held together long enough for the team to ship." |

**Key principles:**
- Check `mergeCandidate` field — when merging two sentences, include both IDs in replacements (one with merged text, one with empty string)
- Don't make every sentence complex — the goal is VARIETY (mix of deep and shallow)
- Target: compound-complex ratio >= 5%, avg depth >= 4.0, variance >= 1.0, uniformity <= 0.8

### Step 3: Apply and Verify

Same pattern: write JSON, apply via `replace-sentences.ts`, re-run analyzer.

If signals persist after first pass, run a second pass targeting the next batch. Maximum 2 passes.

---

## Workflow: Noun Density Fixes

The detector flags "Reduced noun frequency" when NOUN% < 18% (human baseline ~20%). AI text overuses pronouns, auxiliaries, and abstract verbs at the expense of concrete nouns.

### Step 1: Analyze Noun Density

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/writer/analyze-noun-density.ts" {TEXT_FILE} --target-density 20.0 --out {SESSION_PATH}/noun-analysis.json
```

This identifies:
- Document-level noun density vs target
- Sentences with lowest noun density (by ID and priority)
- Issue types: pronoun displacement, auxiliary inflation, vague references, general low density
- Vague references found (this, that, it, things, stuff)

### Step 2: Generate Replacements

For each flagged sentence (focus on `critical` and `high` priority), generate a replacement that increases noun content:

**Transformation strategies by issue type:**

| Issue Type | Example Before | Example After | Strategy |
|-----------|---------------|---------------|----------|
| `low_noun_high_pronoun` | "**They** implemented **it** quickly" | "**The engineering team** implemented **the caching layer** quickly" | Replace pronouns with specific nouns |
| `low_noun_high_aux` | "**It was being** considered" | "**The committee** considered **the proposal**" | Reduce auxiliaries, add concrete nouns |
| `vague_references` | "**This** caused **things** to break" | "**This configuration error** caused **three production servers** to break" | Replace vague words with specific nouns |
| `low_noun_general` | "Improvements were made across the board" | "**The security team** made improvements to **authentication, logging, and access controls**" | Add actors, objects, concepts |

**Key principles:**
- Fixing aux verbs and pronouns often raises noun density as a side effect — run this AFTER those fixes
- Check `vagueRefs` array — these are the easiest wins (replace "this" with "this [noun]")
- Don't just add random nouns — each noun should be the specific thing being discussed

### Step 3: Apply and Verify

Same pattern: write JSON, apply via `replace-sentences.ts`, re-run analyzer. Target: noun density >= 18%, ideally 19-21%.

---

## Tips

- **Batch similar issues** — fix all em-dash density problems in one pass, then aux verbs in another
- **Read surrounding sentences** — replacements must flow with context
- **Vary alternatives** — don't apply the same transformation to every sentence
- **Preserve voice** — the replacement should match the author's style
- **Run analyzers in sequence** — punctuation first, then aux verbs, then pronouns, then structure, then nouns (each pass changes sentence offsets)
- **Check stacking after density fix** — removing em-dashes from density may also fix stacking
- **For auxiliary verbs: prioritize the top offending lemma** — if `be` has 101 occurrences, focus on `be`-based patterns first
- **Noun density is often a downstream fix** — fixing aux verbs and pronouns naturally increases noun %, so check it last
- **Structure fixes may change sentence count** — merging sentences reduces total count, which affects all density metrics; re-run other analyzers if needed
