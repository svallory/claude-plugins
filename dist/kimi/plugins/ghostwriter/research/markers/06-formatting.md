# Character and Formatting Markers

## Overview

AI text contains distinctive character-level patterns, from invisible Unicode characters to markdown artifacts. Some of these are highly reliable detection markers.

---

## Invisible Unicode Characters

### Discovery
Newer GPT models (o3, o4-mini) embed **Narrow No-Break Space (U+202F)** characters in generated text.

OpenAI stated this is "a quirk of large-scale reinforcement learning," not intentional watermarking. However, the pattern is systematic rather than random.

### Critical Unicode Markers

| Character | Unicode | Visibility | Detection Value |
|-----------|---------|------------|-----------------|
| Narrow No-Break Space | U+202F | Invisible | **High** |
| Zero-Width Space | U+200B | Invisible | **High** |
| Zero-Width Non-Joiner | U+200C | Invisible | **High** |
| Zero-Width Joiner | U+200D | Invisible | **High** |
| Word Joiner | U+2060 | Invisible | **High** |
| Soft Hyphen | U+00AD | Invisible | Moderate |

### Detection Implementation
```typescript
const invisibleChars: Record<string, string> = {
  '\u200B': 'Zero-Width Space',
  '\u200C': 'Zero-Width Non-Joiner',
  '\u200D': 'Zero-Width Joiner',
  '\u202F': 'Narrow No-Break Space',
  '\u2060': 'Word Joiner',
  '\u00AD': 'Soft Hyphen',
  '\uFEFF': 'Byte Order Mark',
};

function detectInvisibleChars(text: string): Array<{char: string, name: string, count: number, positions: number[]}> {
  const results = [];
  
  for (const [char, name] of Object.entries(invisibleChars)) {
    const positions: number[] = [];
    let pos = text.indexOf(char);
    while (pos !== -1) {
      positions.push(pos);
      pos = text.indexOf(char, pos + 1);
    }
    
    if (positions.length > 0) {
      results.push({
        char,
        name,
        count: positions.length,
        positions,
      });
    }
  }
  
  return results;
}
```

### Regex Patterns
```javascript
// Zero-Width Space
/\u200B/g

// Narrow No-Break Space (GPT o3/o4-mini marker)
/\u202F/g

// All invisible characters combined
/[\u200B\u200C\u200D\u202F\u2060\u00AD\uFEFF]/g
```

### Reliability: **High**
When present, very strong indicator. Not all AI text contains them.

---

## Smart Quotes vs Straight Quotes

### Pattern
AI models frequently output curly quotation marks instead of straight ASCII quotes:

| Type | Character | Unicode |
|------|-----------|---------|
| Left Double Quote | " | U+201C |
| Right Double Quote | " | U+201D |
| Left Single Quote | ' | U+2018 |
| Right Single Quote | ' | U+2019 |
| Straight Double | " | U+0022 |
| Straight Single | ' | U+0027 |

### Problems Created
- Breaks code snippets (syntax errors)
- Breaks CSV files (parsing failures)
- Breaks Markdown formatting
- Breaks shell commands

### Detection
```typescript
function detectQuoteTypes(text: string): {
  smartDoubleQuotes: number;
  smartSingleQuotes: number;
  straightDoubleQuotes: number;
  straightSingleQuotes: number;
  mixedQuotes: boolean;
} {
  return {
    smartDoubleQuotes: (text.match(/[\u201C\u201D]/g) || []).length,
    smartSingleQuotes: (text.match(/[\u2018\u2019]/g) || []).length,
    straightDoubleQuotes: (text.match(/"/g) || []).length,
    straightSingleQuotes: (text.match(/'/g) || []).length,
    mixedQuotes: /[\u201C\u201D]/.test(text) && /"/.test(text),
  };
}
```

### Reliability: **Low-Moderate**
Context-dependent; professional editing also introduces smart quotes.

---

## Em Dash vs En Dash vs Hyphen

### Character Comparison

| Character | Unicode | Keyboard | AI Pattern |
|-----------|---------|----------|------------|
| Em Dash — | U+2014 | No key | **Heavily overused** |
| En Dash – | U+2013 | No key | Used for ranges |
| Hyphen-Minus - | U+002D | Direct key | Human default |

### Why Humans Use Hyphens
Humans type hyphens by default because that's what's on the keyboard. Getting an em dash requires:
- Mac: Option+Shift+-
- Windows: Alt+0151
- Auto-correction in word processors

### Why AI Uses Em Dashes
AI has no keyboard constraint, so "special" characters require no extra effort. Training data from professionally typeset sources reinforces em dash usage.

### Detection
```typescript
function dashAnalysis(text: string): {
  emDashes: number;
  enDashes: number;
  hyphens: number;
  emDashRatio: number;
} {
  const emDashes = (text.match(/\u2014/g) || []).length;
  const enDashes = (text.match(/\u2013/g) || []).length;
  const hyphens = (text.match(/-/g) || []).length;
  
  const total = emDashes + enDashes + hyphens;
  
  return {
    emDashes,
    enDashes,
    hyphens,
    emDashRatio: total > 0 ? emDashes / total : 0,  // Higher = more AI-like
  };
}
```

### Reliability: **Moderate**
Model-specific; awareness spreading.

---

## Horizontal Ellipsis vs Three Periods

### Pattern
AI may output the Unicode ellipsis character instead of three periods:

| Type | Characters | Unicode |
|------|------------|---------|
| Unicode Ellipsis | … | U+2026 |
| Three Periods | ... | U+002E x3 |

### Detection
```typescript
function ellipsisAnalysis(text: string): {
  unicodeEllipsis: number;
  threePeriods: number;
} {
  return {
    unicodeEllipsis: (text.match(/\u2026/g) || []).length,
    threePeriods: (text.match(/\.{3}/g) || []).length,
  };
}
```

### Reliability: **Low**
Some word processors auto-convert; style-dependent.

---

## Markdown Artifacts

### Pattern
Copy-pasted AI content often includes unrendered markdown:
- `**bold text**` appearing literally
- `##headers` not rendered
- `- bullet` or `* bullet` as text
- `[link text](url)` visible
- ``` code blocks ``` visible
- Numbered lists `1. 2. 3.` in prose contexts

### Detection
```typescript
const markdownArtifacts = [
  /\*\*[^*]+\*\*/g,           // **bold**
  /\*[^*]+\*/g,               // *italic*
  /^#{1,6}\s/gm,              // ## headers
  /^\s*[-*]\s/gm,             // - bullet points
  /^\s*\d+\.\s/gm,            // 1. numbered lists
  /\[.+\]\(.+\)/g,            // [link](url)
  /```[\s\S]*?```/g,          // code blocks
  /`[^`]+`/g,                 // inline code
];

function detectMarkdownArtifacts(text: string): {
  hasArtifacts: boolean;
  types: string[];
  count: number;
} {
  const found: string[] = [];
  
  if (/\*\*[^*]+\*\*/.test(text)) found.push('bold');
  if (/^#{1,6}\s/m.test(text)) found.push('headers');
  if (/^\s*[-*]\s/m.test(text)) found.push('bullets');
  if (/\[.+\]\(.+\)/.test(text)) found.push('links');
  if (/```/.test(text)) found.push('code_blocks');
  
  return {
    hasArtifacts: found.length > 0,
    types: found,
    count: found.length,
  };
}
```

### Reliability: **High**
When present, very strong indicator (indicates copy-paste from AI interface).

---

## Title Case Overuse

### Pattern
AI often defaults to Title Case for:
- Headings and subheadings
- List items
- Section names

AI-generated subtitles frequently capitalize every sentence like a headline.

### Why
Training data bias toward formally typeset content where Title Case is standard for headings.

### Detection
```typescript
function titleCaseAnalysis(text: string): number {
  const lines = text.split('\n');
  let titleCaseLines = 0;
  
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    
    // Check if line looks like Title Case
    // Most words start with capital letter
    const words = line.trim().split(/\s+/);
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
    
    if (capitalizedWords.length / words.length > 0.7) {
      titleCaseLines++;
    }
  }
  
  return titleCaseLines / lines.filter(l => l.trim()).length;
}
```

### Reliability: **Low-Moderate**
Context-dependent; formal documents naturally use Title Case.

---

## Whitespace Patterns

### Common AI Whitespace Issues
- Double spaces after periods (trained on typewriter-era text)
- Inconsistent spacing around punctuation
- Extra blank lines between sections
- Trailing whitespace

### Detection
```typescript
function whitespaceAnalysis(text: string): {
  doubleSpaces: number;
  trailingWhitespace: number;
  excessiveBlankLines: number;
} {
  return {
    doubleSpaces: (text.match(/  +/g) || []).length,
    trailingWhitespace: (text.match(/[ \t]+$/gm) || []).length,
    excessiveBlankLines: (text.match(/\n{3,}/g) || []).length,
  };
}
```

### Reliability: **Low**
Human text also has whitespace issues.

---

## Summary Table

| Marker | Unicode/Pattern | Reliability |
|--------|-----------------|-------------|
| Invisible chars (NNBSP, ZWS) | U+202F, U+200B | **High** |
| Smart quotes | U+201C/D/8/9 | Low-Moderate |
| Em dash overuse | U+2014 | Moderate |
| Unicode ellipsis | U+2026 | Low |
| Markdown artifacts | **text**, ##, etc. | **High** |
| Title Case overuse | - | Low-Moderate |
| Whitespace patterns | - | Low |

---

## Complete Unicode Scanner Tool

```typescript
interface UnicodeAnalysis {
  invisibleChars: Array<{char: string; name: string; count: number}>;
  smartQuotes: number;
  emDashes: number;
  enDashes: number;
  unicodeEllipsis: number;
  markdownArtifacts: string[];
  suspicionScore: number;  // 0-100
}

function fullUnicodeAnalysis(text: string): UnicodeAnalysis {
  const invisible = detectInvisibleChars(text);
  const quotes = detectQuoteTypes(text);
  const dashes = dashAnalysis(text);
  const markdown = detectMarkdownArtifacts(text);
  
  // Calculate suspicion score
  let score = 0;
  
  // High weight: invisible characters
  if (invisible.length > 0) score += 40;
  
  // High weight: markdown artifacts
  if (markdown.hasArtifacts) score += 30;
  
  // Medium weight: em dash ratio
  if (dashes.emDashRatio > 0.5) score += 15;
  
  // Low weight: smart quotes
  if (quotes.smartDoubleQuotes > 0) score += 10;
  
  // Low weight: unicode ellipsis
  if (ellipsisAnalysis(text).unicodeEllipsis > 0) score += 5;
  
  return {
    invisibleChars: invisible,
    smartQuotes: quotes.smartDoubleQuotes + quotes.smartSingleQuotes,
    emDashes: dashes.emDashes,
    enDashes: dashes.enDashes,
    unicodeEllipsis: ellipsisAnalysis(text).unicodeEllipsis,
    markdownArtifacts: markdown.types,
    suspicionScore: Math.min(score, 100),
  };
}
```

---

## Writer Agent Guidance

To avoid formatting tells:
1. Strip all invisible Unicode characters
2. Use straight quotes consistently
3. Use hyphens more than em dashes
4. Use three periods (...) not ellipsis character
5. Remove all markdown formatting before output
6. Use sentence case for headings where appropriate
7. Clean up whitespace (single spaces, no trailing)
