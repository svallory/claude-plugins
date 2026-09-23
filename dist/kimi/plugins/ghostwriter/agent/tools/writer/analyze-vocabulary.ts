#!/usr/bin/env bun
/**
 * analyze-vocabulary.ts
 *
 * Writer-specific vocabulary analysis that identifies AI vocabulary markers
 * and provides actionable data for surgical replacements.
 *
 * Uses the same word list as the detector's vocabulary-scan.ts to ensure
 * the Reviewer catches vocabulary issues before the Detector sees them.
 *
 * Usage:
 *   bun agent/tools/writer/analyze-vocabulary.ts input.md
 *   bun agent/tools/writer/analyze-vocabulary.ts input.md --out analysis.json
 *   echo "text" | bun agent/tools/writer/analyze-vocabulary.ts
 *
 * Output:
 *   JSON with flagged sentences, offending words, and replacement suggestions.
 */

import { extractSentences } from "./extract-sentences";

// ---- Types ------------------------------------------------------------------

type Severity = "critical" | "high" | "moderate";
type Priority = "critical" | "high" | "medium";

interface VocabMarker {
  multiplier: number;
  severity: Severity;
  replacements: string[];
}

interface FlaggedSentence {
  id: number;
  text: string;
  priority: Priority;
  word: string;
  severity: Severity;
  suggestion: string;
}

interface AnalysisResult {
  metrics: {
    totalWords: number;
    totalSentences: number;
    flaggedWords: number;
    flaggedSentences: number;
    aiVocabDensity: number;
  };
  flaggedSentences: FlaggedSentence[];
  summary: string;
}

// ---- AI vocabulary markers --------------------------------------------------
// Mirror of detector's vocabulary-scan.ts with added replacement suggestions.

const AI_VOCAB_MARKERS: Record<string, VocabMarker> = {
  // Critical markers (25x+ frequency in AI text)
  delve:       { multiplier: 25.2, severity: "critical", replacements: ["explore", "dig into", "examine", "look at"] },
  delves:      { multiplier: 25.2, severity: "critical", replacements: ["explores", "digs into", "examines", "looks at"] },
  delving:     { multiplier: 25.2, severity: "critical", replacements: ["exploring", "digging into", "examining"] },
  showcasing:  { multiplier: 9.2,  severity: "critical", replacements: ["showing", "demonstrating", "displaying", "revealing"] },
  underscores: { multiplier: 9.1,  severity: "critical", replacements: ["highlights", "emphasizes", "reinforces", "shows"] },
  tapestry:    { multiplier: 10,   severity: "critical", replacements: ["fabric", "web", "mix", "blend", "landscape"] },

  // High-risk markers (5x+ frequency)
  comprehensive: { multiplier: 5, severity: "high", replacements: ["full", "complete", "thorough", "solid"] },
  crucial:       { multiplier: 5, severity: "high", replacements: ["key", "important", "essential", "vital", "critical"] },
  meticulous:    { multiplier: 5, severity: "high", replacements: ["careful", "precise", "thorough", "detailed"] },
  meticulously:  { multiplier: 5, severity: "high", replacements: ["carefully", "precisely", "thoroughly"] },
  robust:        { multiplier: 5, severity: "high", replacements: ["strong", "solid", "reliable", "sturdy"] },
  pivotal:       { multiplier: 5, severity: "high", replacements: ["key", "central", "important", "major"] },
  multifaceted:  { multiplier: 5, severity: "high", replacements: ["complex", "many-sided", "varied"] },

  // Moderate markers (3x+ frequency)
  harness:      { multiplier: 3, severity: "moderate", replacements: ["use", "tap into", "put to work", "apply"] },
  leverage:     { multiplier: 3, severity: "moderate", replacements: ["use", "exploit", "take advantage of", "capitalize on"] },
  utilize:      { multiplier: 3, severity: "moderate", replacements: ["use"] },
  notably:      { multiplier: 3, severity: "moderate", replacements: ["especially", "particularly", "in particular"] },
  furthermore:  { multiplier: 3, severity: "moderate", replacements: ["also", "plus", "and", "what's more", "on top of that"] },
  bustling:     { multiplier: 6, severity: "moderate", replacements: ["busy", "active", "lively"] },
  vibrant:      { multiplier: 4, severity: "moderate", replacements: ["lively", "energetic", "colorful"] },
  underpins:    { multiplier: 4, severity: "moderate", replacements: ["supports", "backs", "drives", "forms the basis of"] },
  nuanced:      { multiplier: 4, severity: "moderate", replacements: ["subtle", "detailed", "fine-grained"] },
  intricate:    { multiplier: 3, severity: "moderate", replacements: ["complex", "detailed", "elaborate"] },
  realm:        { multiplier: 3, severity: "moderate", replacements: ["area", "field", "domain", "world", "space"] },
  increasingly: { multiplier: 3, severity: "moderate", replacements: ["more and more", "these days", "(delete)"] },
};

// ---- Analysis ---------------------------------------------------------------

function analyzeVocabulary(text: string): AnalysisResult {
  const { sentences } = extractSentences(text);

  // Count total words (rough estimate from text)
  const totalWords = text.split(/\s+/).filter(Boolean).length;

  const flaggedSentences: FlaggedSentence[] = [];
  let totalFlaggedWords = 0;

  for (const sentence of sentences) {
    const sentLower = sentence.text.toLowerCase();

    for (const [marker, info] of Object.entries(AI_VOCAB_MARKERS)) {
      const regex = new RegExp(`\\b${marker}\\b`, "gi");
      if (regex.test(sentence.text)) {
        totalFlaggedWords++;

        const priority: Priority =
          info.severity === "critical" ? "critical" :
          info.severity === "high" ? "high" : "medium";

        const alts = info.replacements.slice(0, 3).join('", "');
        const suggestion = `Replace "${marker}" with "${alts}" or rephrase the sentence to avoid it entirely.`;

        flaggedSentences.push({
          id: sentence.id,
          text: sentence.text,
          priority,
          word: marker,
          severity: info.severity,
          suggestion,
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2 };
  flaggedSentences.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const aiVocabDensity = totalWords > 0 ? (totalFlaggedWords / totalWords) * 1000 : 0;

  let summary: string;
  if (totalFlaggedWords === 0) {
    summary = "No AI vocabulary markers detected. PASS.";
  } else {
    const words = flaggedSentences.map(f => f.word);
    const unique = [...new Set(words)];
    summary = `Found ${totalFlaggedWords} AI vocabulary marker(s): ${unique.map(w => `"${w}"`).join(", ")}. Replace to avoid detection.`;
  }

  return {
    metrics: {
      totalWords,
      totalSentences: sentences.length,
      flaggedWords: totalFlaggedWords,
      flaggedSentences: flaggedSentences.length,
      aiVocabDensity: Number(aiVocabDensity.toFixed(2)),
    },
    flaggedSentences,
    summary,
  };
}

// ---- CLI --------------------------------------------------------------------

if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    let text: string | null = null;
    let outFile: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--out" && args[i + 1]) {
        outFile = args[i + 1];
        i++;
      } else if (arg === "--help" || arg === "-h") {
        console.log(`Usage: bun analyze-vocabulary.ts <text|file.md> [options]

Options:
  --out FILE    Write output to file instead of stdout
  --help, -h    Show this help message

Detects AI vocabulary markers (delve, comprehensive, crucial, leverage, etc.)
and provides replacement suggestions per sentence.

Examples:
  bun analyze-vocabulary.ts input.md
  bun analyze-vocabulary.ts input.md --out vocab-analysis.json
  echo "text" | bun analyze-vocabulary.ts`);
        process.exit(0);
      } else if (arg && !arg.startsWith("--") && text === null) {
        const file = Bun.file(arg);
        if (await file.exists()) {
          text = await file.text();
        } else {
          text = arg;
        }
      }
    }

    if (text === null && !process.stdin.isTTY) {
      text = await Bun.stdin.text();
    }

    if (!text?.trim()) {
      console.error("Usage: bun analyze-vocabulary.ts <text|file.md> [--out output.json]");
      process.exit(1);
    }

    const result = analyzeVocabulary(text);
    const output = JSON.stringify(result, null, 2);

    if (outFile) {
      await Bun.write(outFile, output);
      console.error(`Output written to: ${outFile}`);
    } else {
      console.log(output);
    }
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

export { analyzeVocabulary };
