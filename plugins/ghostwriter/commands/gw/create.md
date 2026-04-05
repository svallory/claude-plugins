---
name: create
description: Generate new text from a topic using adversarial Writer vs Detector training
argument-hint: <topic> [--config PATH] [--medium MEDIUM] [--length N] [--max-rounds N]
---

# Create Command

Orchestrates adversarial training between Writer and Detector agents. The Writer produces text, the Detector analyzes it, and the Writer's instructions are refined based on feedback until detection is evaded.

## Usage

```
/gw:create "Write about the benefits of meditation"
```

With config (recommended — provides author voice, thresholds, and detection rules):
```
/gw:create --config .ghostwriter/publications/{slug}/config.yml "Write about remote work"
```

With ad-hoc overrides (no config file):
```
/gw:create --medium blog --tone casual --max-rounds 5 "Write about remote work"
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--topic` | (required) | The topic for Writer to write about |
| `--config` | — | Path to YAML config file (author, presets, rules). When provided, medium/tone/audience are derived from the config. |
| `--medium` | blog | Target medium (override or fallback if no config) |
| `--tone` | conversational | Tone (override or fallback if no config) |
| `--audience` | general | Audience (override or fallback if no config) |
| `--length` | 300 | Approximate word count |
| `--max-rounds` | 10 | Maximum rounds before stopping |
| `--threshold` | 0.30 | Confidence below which Writer wins |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADVERSARIAL LOOP                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Invoke Writer agent with topic + context                    │
│     → Writer produces text following current instructions       │
│                                                                 │
│  2. Invoke Detector agent with text                             │
│     → Detector returns { detected, confidence, evidence[] }     │
│                                                                 │
│  3. IF confidence < threshold:                                  │
│     → Writer wins, log successful patterns                      │
│     → Update Detector instructions with missed patterns         │
│     → STOP                                                      │
│                                                                 │
│  4. ELSE (detected):                                            │
│     → Analyze evidence to identify specific problems            │
│     → Update Writer instructions with targeted feedback         │
│     → Save round state                                          │
│     → GOTO step 1                                               │
│                                                                 │
│  5. After max rounds: Log learnings, declare draw               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Loop Logic (Detailed)

### Step 1: Invoke Writer

Pass context to Writer agent:
```
Topic: {topic}
{{#if CONFIG}}
Config: {CONFIG}
{{else}}
Medium: {medium}
Tone: {tone}
Audience: {audience}
{{/if}}
Length: {length} words
```

Writer produces text following its current instructions (including any feedback from previous rounds).

### Step 2: Run Detection

Run the detector ensemble on the Writer's output:
```bash
{{#if CONFIG}}
bun "$GHOSTWRITER_ROOT/agent/tools/detector/heuristics.ts" writer-output.txt --config {CONFIG}
{{else}}
bun "$GHOSTWRITER_ROOT/agent/tools/detector/heuristics.ts" writer-output.txt
{{/if}}
```

Detector returns structured evidence:
```json
{
  "detected": true,
  "confidence": 0.72,
  "evidence": [
    {"category": "vocabulary", "signal": "delve", "severity": "high", "context": "...let's delve into..."},
    {"category": "burstiness", "signal": "cv=28", "severity": "medium", "context": "uniform sentence lengths"},
    {"category": "structure", "signal": "tricolon", "severity": "low", "context": "speed, efficiency, and quality"}
  ]
}
```

### Step 3: Evaluate Result

**If confidence < threshold (Writer wins):**
1. Log successful patterns to `$GHOSTWRITER_ROOT/agent/state/learnings.md`
2. Update Detector instructions with missed patterns
3. Stop loop

**If confidence >= threshold (Writer detected):**
1. Analyze evidence
2. Generate targeted feedback for Writer
3. Update Writer instructions
4. Continue to next round

### Step 4: Update Writer Instructions

**Critical:** Don't just say "avoid X." Explain why and suggest alternatives.

Add to Writer's "Learned Patterns" section:

```markdown
### Round 3 Feedback

**Problem:** Used "delve into" in opening paragraph
**Why it triggered:** "delve" appears 25x more often in AI text than human text
**Alternative:** For this casual blog post, try "dig into," "look at," or just start with the content

**Problem:** Sentence lengths too uniform (CV=28, need >50)
**Why it triggered:** Human writing has more rhythm variation
**Suggestion:** Mix in some very short sentences (3-5 words) and one longer, more complex sentence per paragraph
```

---

## State Management

### Round State (`$GHOSTWRITER_ROOT/agent/state/round-N.json`)

```json
{
  "round": 3,
  "timestamp": "2026-02-03T14:30:00Z",
  "context": {
    "topic": "Benefits of meditation",
    "medium": "blog",
    "tone": "casual",
    "audience": "general",
    "length": 300
  },
  "writerOutput": "...",
  "detectorResult": {
    "detected": true,
    "confidence": 0.45,
    "evidence": [...]
  },
  "feedbackGiven": "...",
  "writerInstructionsUpdated": true
}
```

### Learnings (`$GHOSTWRITER_ROOT/agent/state/learnings.md`)

Accumulate insights across sessions:

```markdown
## Session: 2026-02-03 - Meditation Blog Post

### What Worked
- "dig into" successfully replaced "delve" without triggering
- Short punchy sentences mixed with longer ones achieved CV=65
- Personal anecdotes ("I tried this last month...") added authenticity

### What Didn't Work
- "comprehensive guide" still triggered despite casual context
- Em-dash usage (3 per paragraph) flagged

### Patterns to Add to Writer Base Instructions
- Consider adding "comprehensive" to always-avoid list
- Emphasize em-dash restraint more strongly
```

---

## Updating Agent Instructions

### When to Update Writer Base Instructions

Update the permanent instructions (not just round feedback) when:
- Same pattern appears across 3+ rounds
- Pattern is universal (not topic/medium-specific)
- Discovery reveals a fundamental gap in guidance

### How to Update

1. **Backup first:**
   ```bash
   "$GHOSTWRITER_ROOT/agent/tools/version-config.sh" --agent writer
   ```

2. **Add to appropriate section** of `$GHOSTWRITER_ROOT/.claude/agents/writer.md`

3. **Update version history**

### When Writer Evades Detection

Update Detector instructions with missed patterns:

```markdown
<!-- MISSED_PATTERNS_START -->
### Session 2026-02-03 - Missed Patterns

- Writer used "dig into" as "delve" replacement - undetected
- Personal anecdotes masked statistical uniformity
- Consider: Add common synonym substitutions to vocabulary check
<!-- MISSED_PATTERNS_END -->
```

---

## Example Session

```
User: /gw:create --medium blog --tone casual "Write about the benefits of meditation"

=== Round 1 ===
Invoking Writer agent...
Context: blog, casual tone, general audience, ~300 words

Writer output (287 words):
"Meditation has become a comprehensive practice that many people are delving into..."

Running detector...
Result: detected=true, confidence=0.78
Evidence:
- vocabulary: "comprehensive" (high severity)
- vocabulary: "delving into" (high severity)
- burstiness: CV=31 (medium severity)

Updating Writer instructions with feedback...

=== Round 2 ===
Invoking Writer agent with updated instructions...

Writer output (312 words):
"I started meditating six months ago. Honestly? I was skeptical. Like, really skeptical..."

Running detector...
Result: detected=true, confidence=0.52
Evidence:
- burstiness: CV=48 (low severity, improved)
- structure: paragraph uniformity (low severity)

Updating Writer instructions...

=== Round 3 ===
Invoking Writer agent with updated instructions...

Writer output (298 words):
"Six months ago, I downloaded a meditation app. Big mistake—or so I thought..."

Running detector...
Result: detected=false, confidence=0.24
No high-severity evidence.

=== Writer Wins! ===
Rounds: 3
Final confidence: 0.24
Logging successful patterns to agent/state/learnings.md
```

---

## Files Modified

| File | When | Purpose |
|------|------|---------|
| `$GHOSTWRITER_ROOT/.claude/agents/writer.md` | Each round (detected) | Add round feedback to Learned Patterns section |
| `$GHOSTWRITER_ROOT/.claude/agents/slop-detector.md` | Writer wins | Add missed patterns |
| `$GHOSTWRITER_ROOT/agent/state/round-N.json` | Each round | Round-by-round state |
| `$GHOSTWRITER_ROOT/agent/state/learnings.md` | Session end | Cumulative insights |

---

## Tools

### Detection Tools

Run the ensemble detector:
```bash
bun "$GHOSTWRITER_ROOT/agent/tools/detector/heuristics.ts" "text to analyze"
```

Or individual detectors:
```bash
bun "$GHOSTWRITER_ROOT/agent/tools/detector/vocabulary-scan.ts" "text"
bun "$GHOSTWRITER_ROOT/agent/tools/detector/structure-analyzer.ts" "text"
"$GHOSTWRITER_ROOT/agent/tools/run-python.sh" "$GHOSTWRITER_ROOT/agent/tools/detector/burstiness-calculator.py" "text"
```

### Versioning

Before modifying agent instructions:
```bash
"$GHOSTWRITER_ROOT/agent/tools/version-config.sh" --agent writer
"$GHOSTWRITER_ROOT/agent/tools/version-config.sh" --agent slop-detector
```

---

## Quality Feedback Guidelines

When updating Writer instructions, provide feedback that:

1. **Explains the why** — Not just "avoid X" but "avoid X because Y"
2. **Suggests alternatives** — What should they do instead?
3. **Is context-aware** — Different advice for blog vs scientific paper
4. **Is specific** — Reference the exact problematic phrase
5. **Is actionable** — Writer can immediately apply it

**Good feedback:**
> **Problem:** "comprehensive overview" in opening
> **Why:** "comprehensive" is 8x more common in AI text. Combined with "overview," it's a strong signal.
> **For this casual blog:** Try "full picture," "the whole story," or just dive straight into the content without announcing what you'll cover.

**Bad feedback:**
> Avoid the word "comprehensive."

---

## Notes

- The Writer doesn't run post-processing tools—it writes human-like from the start
- Detection tools analyze only; they don't transform text
- The loop teaches the Writer agent through iterative feedback
- Learnings persist across sessions via state files and instruction updates

---

## Version History

- **v2.0.0** (February 2026): Removed writer transformation tools. Loop now focuses on refining Writer's generative approach through targeted feedback. Added medium/tone/audience context passing.
- **v1.0.0** (February 2026): Initial orchestrator with loop logic and state management
