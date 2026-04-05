# Writer Tools

> **Note:** These tools are primarily invoked by the **Reviewer agent** (`.claude/agents/reviewer.md`), which runs all analyzers and composes prescriptive fix reports for the Writer.


Sentence-level utilities for surgical text updates. These tools enable the ai-engineer to make targeted fixes to specific sentences without regenerating entire text.

## Tools

### extract-sentences.ts

Extracts sentences from text with sequential IDs and paragraph boundaries using the `sentence-splitter` library.

```bash
bun agent/tools/writer/extract-sentences.ts input.md
bun agent/tools/writer/extract-sentences.ts input.md --out sentences.json
echo "text" | bun agent/tools/writer/extract-sentences.ts
```

**Output:** JSON with sentence array (id, text, start, end, paragraphIndex) and paragraph boundaries.

### replace-sentences.ts

Applies surgical sentence-level replacements by ID. Works backwards from end-of-file to preserve character offsets.

```bash
bun agent/tools/writer/replace-sentences.ts --source input.md --replacements replacements.json
bun agent/tools/writer/replace-sentences.ts --source input.md --replacements replacements.json --out output.md
echo '{"replacements":[{"id":3,"text":"New sentence."}]}' | bun agent/tools/writer/replace-sentences.ts --source input.md
```

**Replacements JSON format:**
```json
{
  "replacements": [
    {"id": 3, "text": "The system was compromised; attackers exploited trust."},
    {"id": 7, "text": "Security came second to convenience."}
  ]
}
```

Without `--out`, updates the source file in place.

### analyze-punctuation.ts

Writer-specific punctuation analysis that identifies which sentences need fixing and why. Unlike detector tools (which classify text), this returns actionable data for surgical updates.

```bash
bun agent/tools/writer/analyze-punctuation.ts input.md
bun agent/tools/writer/analyze-punctuation.ts input.md --target-density 4.0
bun agent/tools/writer/analyze-punctuation.ts input.md --out analysis.json
```

**Issues detected:**
- `em_dash_density` -- too many em-dashes per 1000 words
- `em_dash_stacking` -- em-dashes in consecutive paragraphs (Claude signature)
- `low_semicolon_density` -- too few semicolons for formal writing
- `em_dash_semicolon_ratio` -- em-dashes present but zero semicolons

### analyze-auxiliary-verbs.ts

Analyzes auxiliary verb density and identifies sentences with patterns that contribute to AI detection signals. Auxiliary verbs (is, are, was, were, have, has, had, will, would, can, could, may, might, must, etc.) when used excessively signal AI-generated text.

```bash
bun agent/tools/writer/analyze-auxiliary-verbs.ts input.md
bun agent/tools/writer/analyze-auxiliary-verbs.ts input.md --target-density 4.5
bun agent/tools/writer/analyze-auxiliary-verbs.ts input.md --out analysis.json
```

**Patterns detected:**
- `progressive` -- is/was/are/were + -ing (e.g., "is running" -> "runs")
- `passive` -- is/was/are/were + past participle (e.g., "was broken" -> restructure to active)
- `perfect` -- has/have/had + past participle (e.g., "has occurred" -> "occurred")
- `modal` -- will/would/can/could/may/might/must/shall/should + verb
- `modal_perfect` -- modal + have + past participle (e.g., "could have been")
- `do_emphasis` -- do/does/did for emphasis or questions

**Output:** JSON with flagged sentences by priority (critical/high/medium/low), specific auxiliary verbs found, pattern analysis, and suggested rewrites.

### analyze-pronouns.ts

Analyzes pronoun density and identifies sentence groups that need reduction. Groups correlated sentences (pronoun + antecedent) so replacements can be made with context.

```bash
bun agent/tools/writer/analyze-pronouns.ts input.md
bun agent/tools/writer/analyze-pronouns.ts input.md --target-density 7.0
bun agent/tools/writer/analyze-pronouns.ts input.md --out analysis.json
```

**Output:** JSON with sentence groups containing high pronoun density, replacement strategies, and estimated impact.

### analyze-sentence-structure.ts

Analyzes sentence structure for syntactic monotony signals that the detector flags as AI indicators. Detects four interconnected issues that LLMs consistently produce.

```bash
bun agent/tools/writer/analyze-sentence-structure.ts input.md
bun agent/tools/writer/analyze-sentence-structure.ts input.md --out analysis.json
```

**Signals detected:**
- `compound_complex_ratio` -- too few compound-complex sentences (ratio < 5%)
- `depth_variance` -- monotonous dependency depth (variance < 1.0)
- `avg_depth` -- shallow dependency structure (average depth < 5.0)
- `uniformity` -- sentence type/length too uniform (score > 0.8)

**Output:** JSON with flagged signals, flagged sentences by priority (critical/high/medium/low), merge candidates for adjacent simple sentences, and suggested structural transformations.

### analyze-noun-density.ts

Analyzes noun frequency and identifies sentences where nouns can be increased to raise the document above the 18% detection threshold (human baseline ~20%).

```bash
bun agent/tools/writer/analyze-noun-density.ts input.md
bun agent/tools/writer/analyze-noun-density.ts input.md --target-density 19.0
bun agent/tools/writer/analyze-noun-density.ts input.md --out analysis.json
```

**Issue types detected:**
- `low_noun_high_pronoun` -- pronouns displacing nouns in the sentence
- `low_noun_high_aux` -- auxiliary verbs inflating word count while nouns are scarce
- `vague_references` -- "this", "that", "it", "things" instead of specific nouns
- `low_noun_general` -- generally low noun density without a specific displacement cause

**Output:** JSON with flagged sentences by priority (critical/high/medium/low), issue types, vague references found, noun chunks for context, and suggested transformations.

## Workflow: Surgical Sentence Update

1. **Extract:** `extract-sentences.ts` -> get sentence IDs
2. **Analyze:** Run one or more analyzers:
   - `analyze-punctuation.ts` -> punctuation issues
   - `analyze-auxiliary-verbs.ts` -> auxiliary verb issues
   - `analyze-pronouns.ts` -> pronoun density issues
   - `analyze-sentence-structure.ts` -> syntactic monotony issues
   - `analyze-noun-density.ts` -> noun frequency issues
3. **Fix:** Model generates replacement text for flagged sentence IDs
4. **Apply:** `replace-sentences.ts` -> mechanical replacement by ID
5. **Verify:** Re-run analyzer to confirm fix

This approach lets the model make contextual decisions about replacements while the script handles mechanical application -- no ambiguity, no unintended changes.

## Detection Thresholds

| Metric | AI Threshold | Human Baseline | Target |
|--------|-------------|----------------|--------|
| Auxiliary verb density | >5.5% | 4.5% | 4.0-5.0% |
| Pronoun density | >7% | 5% | 5-6% (blog), 6-7% (book) |
| Noun frequency | <18% | 20% | 19-21% |
| Compound-complex ratio | <5% | 8-12% | >=6% |
| Avg dependency depth | <5.0 | 5.0-6.0 | >=5.0 |
| Depth variance | <1.0 | 2.0-4.0 | >=1.0 |
| Sentence uniformity | >0.8 | 0.3-0.6 | <=0.8 |
| Em-dash density | >2.5/1000 | 1.5/1000 | <4.0/1000 |
| Semicolon density | <0.5/1000 | 1.5/1000 | >3.0/1000 (book) |
