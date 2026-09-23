# Content-Level Patterns

## Overview

Beyond style and structure, AI exhibits distinctive content-level behaviors: over-explanation, forced neutrality, safety caveats, and citation problems. Some of these are among the most reliable detection markers.

---

## Over-Explanation

### Pattern
AI explains concepts that don't need explaining for the intended audience:
- Defining blockchain to crypto experts
- Adding "In today's fast-paced digital world..." before every topic
- Defining common terms mid-sentence to professionals
- Providing unnecessary background information

### Characteristic
AI "excels at summary and exposition" but fails at calibrating to reader expertise.

### Examples
```
❌ AI: "Machine learning, which is a subset of artificial intelligence 
       that enables computers to learn from data, has become..."
       
✓ Human (to tech audience): "ML models have become..."
```

### Detection
Difficult to detect algorithmically without knowing target audience. Heuristics:
- Definition phrases: "which is," "defined as," "meaning that"
- Parenthetical explanations
- Ratio of explanation to substance

### Reliability: **Moderate**
Context-dependent; requires audience awareness.

---

## Balanced Perspective Forcing

### Pattern
AI maintains artificial neutrality even when inappropriate:
- Presents "both sides" of issues that don't have two equal sides
- Uses excessive hedging
- Reaches conclusions that "split the difference"
- Refuses to take clear positions

### Characteristic
"The hedging habit" - AI "presents multiple perspectives even when unnecessary, creating text that feels perpetually balanced to the point of becoming wishy-washy."

### Highly Visible In
Opinion pieces, editorials, reviews, recommendations - contexts where the reader expects a stance.

### Examples
```
❌ AI: "While some argue that exercise is beneficial for health, 
       others point out that rest is also important. Both 
       perspectives have merit."

✓ Human: "Exercise is essential for health. Full stop."
```

### Detection
```typescript
const balancingPhrases = [
  /while some (argue|believe|think)/i,
  /on the other hand/i,
  /both (sides|perspectives|views) (have|present|offer)/i,
  /it (depends|varies)/i,
  /there are (pros and cons|advantages and disadvantages)/i,
  /it's (important|worth) (noting|mentioning) that/i,
];

function balancedPerspectiveScore(text: string): number {
  let count = 0;
  for (const pattern of balancingPhrases) {
    const matches = text.match(new RegExp(pattern, 'gi')) || [];
    count += matches.length;
  }
  return count;
}
```

### Reliability: **High** (for opinion content)

---

## Safety Caveat Insertion

### Pattern
AI adds unnecessary warnings and disclaimers:
- "Please consult a professional before making any decisions..."
- "While this approach works for many people, individual results may vary..."
- "This is not medical/legal/financial advice..."
- "Always do your own research..."
- "Results are not guaranteed..."

### Why
Safety training creates "over-refusal" patterns. AI trained to minimize liability.

### Detection
```typescript
const safetyCaveats = [
  /consult (a|your) (professional|doctor|lawyer|financial advisor)/i,
  /this is not (medical|legal|financial) advice/i,
  /individual results may vary/i,
  /always do your own research/i,
  /not (guaranteed|a substitute for)/i,
  /seek professional (help|advice|guidance)/i,
  /before making any (decisions|changes)/i,
];

function safetyCaveatScore(text: string): number {
  let count = 0;
  for (const pattern of safetyCaveats) {
    const matches = text.match(new RegExp(pattern, 'gi')) || [];
    count += matches.length;
  }
  return count;
}
```

### Reliability: **Moderate-High**

---

## Citation Hallucination

### Pattern
AI either fabricates citations entirely, provides broken citation formats, or uses placeholder markers.

### Key Incidents
- **Mata v. Avianca case**: Lawyer submitted AI-fabricated legal precedents with fictional court cases
- AI frequently generates plausible-sounding but non-existent references
- Wikipedia documents AI leaving markup like "citeturn0search0" when citations fail

*Note: Specific citation error rates vary by study and AI model. The phenomenon of citation hallucination is well-documented but exact percentages depend on methodology.*

### Types of Citation Problems
1. **Fabricated sources**: Real-sounding but non-existent journals, authors, papers
2. **Fabricated DOIs**: DOI format correct but leads nowhere
3. **Wrong dates**: Paper dates don't match publication records
4. **Mixed-up journals**: Real paper attributed to wrong publication
5. **Non-existent authors**: Plausible author names that don't exist
6. **Placeholder artifacts**: `[citation needed]`, `[1]` with no reference list

### Detection
```typescript
interface CitationCheck {
  hasCitations: boolean;
  placeholderMarkers: string[];
  verifiableDOIs: number;
  brokenDOIs: number;
  suspiciousPatterns: string[];
}

function analyzeCitations(text: string): CitationCheck {
  const doiPattern = /10\.\d{4,}\/[^\s]+/g;
  const placeholders = text.match(/\[citation needed\]|\[cite\]|\[\d+\]|citeturn\d+/gi) || [];
  const dois = text.match(doiPattern) || [];
  
  return {
    hasCitations: dois.length > 0 || placeholders.length > 0,
    placeholderMarkers: placeholders,
    verifiableDOIs: dois.length,  // Would need API check for actual verification
    brokenDOIs: 0,  // Requires external verification
    suspiciousPatterns: placeholders,
  };
}
```

### Verification Method
1. Extract DOIs and URLs
2. Query CrossRef, PubMed, or DOI.org APIs
3. Verify author names against publication records
4. Check publication dates against journal archives

### Reliability: **High**
Citations can be verified through database searches.

---

## Temporal Confusion

### Pattern
AI exhibits confusion about dates and currency of information:
- Confidently providing outdated information as current
- Confusion about own knowledge cutoff dates
- Mixing historical and current information
- "As of my last update in [date]..." followed by post-cutoff claims

### Examples
```
❌ "As of 2023, the current CEO of Twitter is..."
   (knowledge cutoff confusion)

❌ "Recently, in 2019..." 
   (temporal framing error)

❌ "The current president [outdated name]..."
   (stale information presented as current)
```

### Detection Heuristics
- Explicit knowledge cutoff mentions
- Temporal markers ("currently," "as of," "recently") with outdated info
- Hedging about recency: "information may have changed"

### Reliability: **Moderate**
Requires external fact-checking.

---

## Self-Referential Patterns (Very High Reliability)

### Pattern
When present, unmistakable markers:
- "As an AI language model, I cannot..."
- "I'm Claude, an AI assistant..."
- "As a large language model..."
- "I don't have personal experiences..."
- "I was created by..."

### Extended Patterns
- Responses beginning with "Certainly!" (especially on LinkedIn)
- Ending with "What do you think?" 
- "I hope this helps!"
- "Let me know if you have any questions!"

### Detection
```typescript
const selfReferential = [
  /as an? (AI|artificial intelligence|language model)/i,
  /I('m| am) (an? )?(AI|Claude|GPT|assistant)/i,
  /I (don't|do not) have (personal|real|actual) (experiences|feelings|opinions)/i,
  /I was (created|trained|developed) by/i,
  /my (training|knowledge) (cutoff|data)/i,
  /^Certainly!/m,
  /I hope this helps!?$/m,
  /Let me know if you have any (other )?questions!?$/m,
  /What do you think\?$/m,
];

function detectSelfReferential(text: string): {
  found: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  
  for (const pattern of selfReferential) {
    const match = text.match(pattern);
    if (match) matches.push(match[0]);
  }
  
  return {
    found: matches.length > 0,
    matches,
  };
}
```

### Reliability: **Very High**
When present, definitive. But often absent in edited AI text.

---

## Refusal Language Patterns

### Pattern
Distinctive refusal formulations:
- "I cannot provide information on..."
- "I'm not able to assist with..."
- "That's outside my capabilities..."
- "I don't feel comfortable..."
- "I must respectfully decline..."

### Why
Safety training creates consistent refusal patterns.

### Detection
```typescript
const refusalPatterns = [
  /I (cannot|can't|am unable to|won't) (provide|assist|help)/i,
  /outside (my|of my) (capabilities|scope|programming)/i,
  /I (don't|do not) feel comfortable/i,
  /I must (respectfully )?decline/i,
  /I('m| am) not (able|permitted|allowed) to/i,
  /against my (guidelines|programming|principles)/i,
];
```

### Reliability: **Very High** (when present)

---

## Generic Content (Lack of Lived Experience)

### Pattern
Content that is technically correct but lacks concrete specifics:
- Descriptions "could be slotted in almost anywhere"
- Statistics avoided or fabricated rather than accurately sourced
- Vague examples rather than specific cases

### What's Missing
- Sensory details
- Personal anecdotes
- Real-world examples with specifics
- Cultural references
- Humor
- Unexpected tangents
- Opinionated asides

### Key Quote
"AI can mimic style. But it can't fake lived experience."

### Detection
Requires qualitative assessment. Heuristics:
- Ratio of concrete nouns to abstract nouns
- Presence of specific numbers, dates, names, places
- First-person experiential language
- Cultural/temporal references

### Reliability: **Moderate-High**

---

## Summary Table

| Pattern | Context | Reliability |
|---------|---------|-------------|
| Self-referential artifacts | All | **Very High** |
| Refusal language | All | **Very High** |
| Citation hallucination | Academic | **High** |
| Balanced perspective forcing | Opinion | **High** |
| Safety caveats | Advice | Moderate-High |
| Over-explanation | Technical | Moderate |
| Temporal confusion | Current events | Moderate |
| Generic content | All | Moderate-High |

---

## Writer Agent Guidance

To avoid content tells:
1. Never include AI self-references (obvious)
2. Take clear positions on topics - avoid "both sides" framing
3. Remove unnecessary safety caveats
4. Calibrate explanation depth to audience
5. Include specific details: names, dates, numbers, places
6. Add personal voice: opinions, asides, humor
7. Verify all citations before including
8. Include current, dated information when relevant
9. Use sensory and experiential language
10. Reference specific cultural touchpoints
