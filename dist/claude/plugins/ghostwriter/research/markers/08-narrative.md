# Narrative and Discourse Markers

## Overview

AI-generated narrative content exhibits characteristic structural patterns that distinguish it from human storytelling. These markers are particularly useful for detecting AI in creative writing, essays, and long-form content.

---

## Narrative Arc Flattening

### Pattern

AI narratives show reduced structural complexity compared to human storytelling.

### Characteristics

| Dimension | Human Pattern | AI Pattern |
|-----------|---------------|------------|
| Complication density | Multiple obstacles, subplots | Fewer complications, rapid resolution |
| Satellite events | Rich elaborative detail | Reduced, more direct progression |
| False starts/red herrings | Present for tension | Absent |
| Resolution type | Varied (positive, negative, ambiguous, open) | Strongly favors closed/positive endings |

*Source: Qualitative patterns observed in AI detection research. No quantified frequency data available from verified sources.*

### Why It Happens

- RLHF optimization rewards "coherent" and "satisfying" outputs
- Complex narratives with unresolved elements may be penalized as "confusing"
- Training data skews toward popular narrative forms with conventional resolution

### Detection Approach

- **Resolution type entropy**: AI shows reduced entropy (concentrated in positive/closed categories)
- **Complication count per narrative unit**: AI has fewer obstacles introduced
- **Subplot development**: AI rarely develops parallel narrative threads

### Reliability: **Moderate**

- Most useful for creative writing and essays
- Less applicable to technical or informational content

---

## Personal Voice Absence

### Pattern

AI text lacks genuine personal perspective, substituting generic observations for specific experience.

### Anecdote Characteristics

| Marker | Human Pattern | AI Pattern |
|--------|---------------|------------|
| Specific dates | Common ("On March 15th...") | Rare/generic ("recently," "a few years ago") |
| Named individuals | Common ("My colleague Sarah...") | Generic ("a friend," "a colleague") |
| Sensory specifics | Rich, idiosyncratic | Generic or absent |
| Emotional specificity | Varied, personal | Predictable, category-level |
| Evaluative stance | Clear, committed | Balanced, hedged |

*Source: [Pangram Labs Educational Guide - Is this AI?](https://www.pangram.com/blog/is-this-ai-a-field-guide-for-detecting-ai-writing-in-the-wild). Note: These are qualitative patterns; specific frequency data not provided.*

### AI Experience Claim Patterns

When AI attempts first-person experiential claims:

- "I don't have personal experiences, but..."
- "Many people find that..." (framed as personal)
- "If I were in that situation..."
- Capability claims: "I can help with..." (functional, not experiential)
- Limitation statements: "I don't have access to..."

### Detection Approach

- Named entity density in personal sections
- Temporal reference specificity
- First-person narrative density vs. generic framing

### Reliability: **Moderate-High**

- Strong signal in personal essays and memoir-style content
- Less applicable to technical or formal writing

---

## Specificity Deficits

### Pattern

AI substitutes general observation for particular illustration across all content types.

### Generic Example Preference

| Example Type | Human Preference | AI Preference |
|--------------|------------------|---------------|
| Specific instance | High | Low |
| Generic prototype | Moderate | **High** |
| Hypothetical scenario | Moderate | **High** |
| Personal anecdote | Context-dependent | **Very low** |

*Source: Qualitative patterns observed in AI detection research.*

### Concrete Detail Avoidance

AI text routinely lacks:
- Proper names
- Specific dates
- Precise locations
- Exact quantities
- Unexpected or idiosyncratic details

This creates "surface-level" quality—text that appears comprehensive but lacks grounding particulars.

### Detection Approach

- Concrete detail density metrics
- Frequency of specific numbers, dates, proper names
- Sensory descriptor count

### Reliability: **Moderate**

---

## Coherence Patterns

### Local vs Global Coherence Imbalance

| Level | AI Pattern | Human Pattern |
|-------|------------|---------------|
| Local (sentence-to-sentence) | Strong, explicit connectives | Variable, often implicit |
| Global (document-level) | Weaker, may drift | Stronger, thematic |
| Referential maintenance | Shorter coreference chains | Extended, varied |

*Source: Qualitative patterns. The MDPI journal publishes AI detection research but specific study citation unavailable.*

AI shows "overt conjunctive framing but weaker referential maintenance"—strong local coherence but potential drift at document level.

### Topic Shift Over-Signaling

AI deploys explicit topic markers with elevated frequency:
- "Turning to..."
- "Regarding..."
- "On the subject of..."
- "Another important consideration is..."

Human writers manage topic shifts implicitly through thematic continuity or paragraph breaks.

### Detection Approach

- Connective density measurement
- Coreference chain length analysis
- Topic transition marker frequency

### Reliability: **Moderate**

---

## Emotional Flatness

### Pattern

AI maintains consistent, moderate affective tone regardless of content demands.

### Emotional Dimension Comparison

| Dimension | Human Pattern | AI Pattern |
|-----------|---------------|------------|
| Negative emotion | Variable, context-appropriate | Reduced, especially strong negative |
| Positive emotion | Variable, genuine-seeming | Moderate, consistent |
| Emotional range | Wide, situation-responsive | Narrow, compressed |
| Idiosyncratic expression | Common | Absent |

*Source: [NIH/PMC Study PMC11422446](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/) found AI "manifested less propensity than humans for displaying aggressive negative emotions."*

### Why It Happens

- Safety training penalizes strong emotional expression
- RLHF optimizes for inoffensive, broadly acceptable output

### The "Seesaw" Structure

AI uses balanced structures to avoid stance commitment:

> "While X has many benefits, it is important to note that Y encompasses several challenges."

This enables stance avoidance through structural balance—both sides presented, no evaluative commitment made.

*Source: [The Algorithmic Bridge - 10 Signs Of AI Writing](https://thealgorithmicbridge.substack.com/p/10-signs-of-ai-writing-that-will) (qualitative analysis).*

### Detection Approach

- Affective lexicon valence analysis
- Emotional intensity variation measurement
- Stance strength metrics

### Reliability: **Moderate**

---

## Humor and Irony Absence

### Pattern

AI exhibits reduced deployment of non-literal language and avoids sarcasm.

### Figurative Language Use

| Form | AI Deployment |
|------|---------------|
| Conventional metaphors | Overused (journey, tapestry, landscape) |
| Novel metaphors | Rare, often unsuccessful |
| Simile | Reduced frequency |
| Hyperbole | Reduced |
| Understatement | Reduced |
| Sarcasm/irony | Absent unless explicitly prompted |

### Detection Approach

- Figurative language novelty scoring
- Sarcasm marker presence
- Humor attempt success rate

### Reliability: **Low-Moderate**

- Useful for informal content
- Not applicable to formal/technical writing

---

## Summary Table

| Marker | AI Signal | Detection Approach | Reliability |
|--------|-----------|-------------------|-------------|
| Narrative flattening | Fewer complications, positive endings | Resolution entropy | Moderate |
| Personal voice absence | Generic examples, no specifics | Named entity density | Moderate-High |
| Specificity deficit | Lacks dates, names, quantities | Concrete detail count | Moderate |
| Coherence imbalance | Strong local, weak global | Coreference chain length | Moderate |
| Emotional flatness | Narrow range, balanced stance | Affective lexicon analysis | Moderate |
| Humor absence | No sarcasm, conventional metaphors | Figurative novelty score | Low-Moderate |

---

## Writer Agent Guidance

To avoid narrative/discourse tells:

1. **Add specific details**: Use actual names, dates, places, quantities
2. **Include personal anecdotes**: With sensory specifics and emotional granularity
3. **Vary emotional intensity**: Don't maintain constant moderate tone
4. **Take clear stances**: Avoid "on one hand... on the other hand" balance
5. **Add complications**: Include obstacles, setbacks, unresolved tensions
6. **Use implicit transitions**: Don't over-signal every topic shift
7. **Allow ambiguity**: Not everything needs neat resolution
8. **Attempt humor/irony**: Even if subtle
