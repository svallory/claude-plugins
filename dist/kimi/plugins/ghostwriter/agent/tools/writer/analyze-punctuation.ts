#!/usr/bin/env bun
/**
 * analyze-punctuation.ts
 *
 * Writer-specific punctuation analysis that identifies problematic sentences
 * and returns actionable data for surgical updates.
 *
 * Unlike detector tools (which classify text), this tool is optimized for
 * the Writer's needs: it identifies WHICH sentences need fixing and WHY.
 *
 * Usage:
 *   bun agent/tools/writer/analyze-punctuation.ts input.md
 *   bun agent/tools/writer/analyze-punctuation.ts input.md --target-density 4.0
 *   bun agent/tools/writer/analyze-punctuation.ts input.md --out analysis.json
 *   echo "text" | bun agent/tools/writer/analyze-punctuation.ts
 *
 * Output:
 *   JSON with issues grouped by type, affected sentence IDs, and fix suggestions.
 */

import { extractSentences } from "./extract-sentences";
import { parseArgs, outputResult } from "../lib/cli-utils";
import { DEFAULT_PROSE_TARGETS } from "../config/presets/defaults";

interface SentenceIssue {
  type: string;
  sentences: number[];
  details: string;
  suggestion: string;
}

interface PunctuationMetrics {
  wordCount: number;
  emDashCount: number;
  emDashDensity: number;
  targetDensity: number;
  semicolonCount: number;
  semicolonDensity: number;
  sentencesToFix: number;
  emDashSentences: number[];
  stackedParagraphs: number[][];
}

interface AnalysisResult {
  issues: SentenceIssue[];
  metrics: PunctuationMetrics;
  sentenceDetails: Array<{
    id: number;
    text: string;
    emDashCount: number;
    hasSemicolon: boolean;
    paragraphIndex: number;
  }>;
}

const EM_DASH = "\u2014";
const EM_DASH_PATTERN = /\u2014/g;
const SEMICOLON_PATTERN = /;/g;

/**
 * Minimum em-dash density below which text is flagged as overcorrected.
 * Zero em-dashes in 500+ word text is a known AI overcorrection signal.
 */
const MIN_EM_DASH_DENSITY = 1.0; // per 1000 words

/**
 * Count words in text.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Score a sentence as a candidate for em-dash insertion.
 * Higher score = better candidate. Returns 0 if not a good candidate.
 *
 * Good candidates:
 * - Long sentences with parenthetical asides (commas around a clause)
 * - Sentences with mid-sentence clarifications or pivots
 * - Sentences with comma-separated appositives
 * - Sentences with "which", "especially", "particularly" clauses
 */
function scoreEmDashCandidate(text: string): number {
  let score = 0;
  const wordCount = text.split(/\s+/).length;

  // Skip very short sentences
  if (wordCount < 8) return 0;

  // Prefer longer sentences (more room for em-dash insertion)
  if (wordCount >= 15) score += 1;
  if (wordCount >= 25) score += 1;

  // Parenthetical patterns: "X, which Y, Z" or "X, especially Y, Z"
  if (/,\s*(which|especially|particularly|specifically|notably)\s/i.test(text)) {
    score += 3;
  }

  // Appositives: "X, a/an/the Y, Z" patterns
  if (/,\s*(a|an|the)\s+\w+(\s+\w+)?,/i.test(text)) {
    score += 3;
  }

  // Mid-sentence clarifications with parentheses (could be converted to em-dashes)
  if (/\([^)]{5,}\)/.test(text)) {
    score += 2;
  }

  // Sentences with conjunctions introducing a pivot: ", but ", ", yet "
  if (/,\s*(but|yet)\s/i.test(text) && wordCount >= 12) {
    score += 2;
  }

  // Sentences with "not X but Y" or "not just X" patterns
  if (/not\s+(just\s+)?\w+/i.test(text) && wordCount >= 10) {
    score += 1;
  }

  // Sentences containing colons (potential for em-dash alternative)
  if (text.includes(":") && wordCount >= 12) {
    score += 1;
  }

  return score;
}

/**
 * Analyze punctuation issues in text at the sentence level.
 */
export function analyzePunctuation(
  text: string,
  targetDensity: number = 1.5,
  minEmDashDensity: number = MIN_EM_DASH_DENSITY,
): AnalysisResult {
  const { sentences, paragraphs } = extractSentences(text);
  const wordCount = countWords(text);
  const issues: SentenceIssue[] = [];

  // Analyze each sentence
  const sentenceDetails = sentences.map((s) => {
    const emDashMatches = s.text.match(EM_DASH_PATTERN);
    const semicolonMatches = s.text.match(SEMICOLON_PATTERN);
    return {
      id: s.id,
      text: s.text,
      emDashCount: emDashMatches?.length ?? 0,
      hasSemicolon: (semicolonMatches?.length ?? 0) > 0,
      paragraphIndex: s.paragraphIndex,
    };
  });

  // Total counts
  const totalEmDashes = sentenceDetails.reduce((sum, s) => sum + s.emDashCount, 0);
  const totalSemicolons = sentenceDetails.filter((s) => s.hasSemicolon).length;
  const emDashDensity = wordCount > 0 ? (totalEmDashes / wordCount) * 1000 : 0;
  const semicolonDensity = wordCount > 0 ? (totalSemicolons / wordCount) * 1000 : 0;

  // Find sentences with em-dashes
  const emDashSentences = sentenceDetails
    .filter((s) => s.emDashCount > 0)
    .map((s) => s.id);

  // Detect em-dash density TOO HIGH
  if (emDashDensity > targetDensity) {
    // Calculate how many em-dashes need to be removed
    const targetCount = Math.floor((targetDensity * wordCount) / 1000);
    const excessCount = totalEmDashes - targetCount;

    // Prioritize sentences with multiple em-dashes, then single
    const multiEmDash = sentenceDetails
      .filter((s) => s.emDashCount >= 2)
      .map((s) => s.id);
    const singleEmDash = sentenceDetails
      .filter((s) => s.emDashCount === 1)
      .map((s) => s.id);

    const fixSentences = [...multiEmDash, ...singleEmDash].slice(
      0,
      Math.max(excessCount, multiEmDash.length),
    );

    issues.push({
      type: "em_dash_density",
      sentences: fixSentences,
      details: `Em-dash density ${emDashDensity.toFixed(1)}/1000 words exceeds target ${targetDensity}/1000. Found ${totalEmDashes} em-dashes; need to remove ~${excessCount}. FLOOR: Keep at least ${Math.max(1, Math.floor((minEmDashDensity * wordCount) / 1000))} em-dashes (${minEmDashDensity}/1000 minimum).`,
      suggestion:
        `Replace with: semicolons for related clauses, periods for hard stops, parentheses for asides, commas for brief pauses. Prioritize sentences with multiple em-dashes. IMPORTANT: Remove ONLY ~${excessCount} em-dashes — do not go below ${minEmDashDensity}/1000 density.`,
    });
  }

  // Detect em-dash density TOO LOW (overcorrection signal)
  if (emDashDensity < minEmDashDensity && wordCount > 500) {
    // Calculate how many em-dashes should be added
    const minTarget = Math.ceil((minEmDashDensity * wordCount) / 1000);
    const idealTarget = Math.ceil(((targetDensity * 0.5) * wordCount) / 1000); // aim for half of target
    const neededCount = Math.max(minTarget, idealTarget) - totalEmDashes;

    // Find best candidate sentences for em-dash insertion
    // Score each sentence and pick the top candidates
    const candidatesWithScores = sentenceDetails
      .filter((s) => s.emDashCount === 0 && !s.hasSemicolon) // don't add to sentences that already have punctuation variety
      .map((s) => ({
        ...s,
        score: scoreEmDashCandidate(s.text),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // Distribute across paragraphs to avoid stacking
    const selectedByParagraph = new Set<number>();
    const selectedCandidates: number[] = [];

    for (const candidate of candidatesWithScores) {
      if (selectedCandidates.length >= neededCount) break;
      // Skip if we already selected from this paragraph (avoid stacking)
      if (selectedByParagraph.has(candidate.paragraphIndex)) continue;
      selectedCandidates.push(candidate.id);
      selectedByParagraph.add(candidate.paragraphIndex);
    }

    // If we still need more, allow same-paragraph selections
    if (selectedCandidates.length < neededCount) {
      for (const candidate of candidatesWithScores) {
        if (selectedCandidates.length >= neededCount) break;
        if (selectedCandidates.includes(candidate.id)) continue;
        selectedCandidates.push(candidate.id);
      }
    }

    if (selectedCandidates.length > 0) {
      const densityStr = totalEmDashes === 0 ? "zero" : emDashDensity.toFixed(1) + "/1000";
      issues.push({
        type: "low_em_dash_density",
        sentences: selectedCandidates,
        details: `Em-dash density is ${densityStr} (minimum: ${minEmDashDensity}/1000, target: ${targetDensity}/1000). Zero or near-zero em-dashes is a known AI overcorrection signal. Need to add ~${neededCount} em-dashes. CEILING: Do NOT exceed ${targetDensity}/1000 words (~${Math.ceil((targetDensity * wordCount) / 1000)} total).`,
        suggestion:
          `Insert em-dashes at natural interruption points: mid-sentence clarifications, parenthetical asides, abrupt pivots, or emphasis. Convert existing commas around appositives/parentheticals to em-dashes. Distribute across different paragraphs to avoid stacking. IMPORTANT: Add ONLY ~${neededCount} em-dashes total — do not exceed ${targetDensity}/1000 density. One em-dash per flagged sentence maximum.`,
      });
    }
  }

  // Detect em-dash stacking (consecutive paragraphs with em-dashes)
  const paragraphEmDashMap = new Map<number, number[]>();
  for (const s of sentenceDetails) {
    if (s.emDashCount > 0) {
      if (!paragraphEmDashMap.has(s.paragraphIndex)) {
        paragraphEmDashMap.set(s.paragraphIndex, []);
      }
      paragraphEmDashMap.get(s.paragraphIndex)!.push(s.id);
    }
  }

  const stackedParagraphs: number[][] = [];
  const sortedParaIndices = [...paragraphEmDashMap.keys()].sort((a, b) => a - b);
  for (let i = 0; i < sortedParaIndices.length - 1; i++) {
    if (sortedParaIndices[i + 1] === sortedParaIndices[i] + 1) {
      const para1Sents = paragraphEmDashMap.get(sortedParaIndices[i])!;
      const para2Sents = paragraphEmDashMap.get(sortedParaIndices[i + 1])!;
      stackedParagraphs.push([...para1Sents, ...para2Sents]);

      // Add as issue - suggest fixing in the paragraph with fewer em-dashes
      const fixPara =
        para1Sents.length <= para2Sents.length ? para1Sents : para2Sents;
      issues.push({
        type: "em_dash_stacking",
        sentences: fixPara,
        details: `Em-dashes found in consecutive paragraphs ${sortedParaIndices[i]} and ${sortedParaIndices[i + 1]}. This is a known Claude signature.`,
        suggestion:
          "Remove em-dashes from one of the two consecutive paragraphs. Convert to semicolons or periods.",
      });
    }
  }

  // Detect low semicolon usage in formal writing
  if (semicolonDensity < 2.0 && wordCount > 500) {
    // Find sentences that could take semicolons (compound sentences with conjunctions)
    const candidates = sentenceDetails
      .filter((s) => {
        // Sentences with "and", "but", "so", "yet" connecting clauses
        return (
          !s.hasSemicolon &&
          s.text.length > 50 &&
          /,\s*(and|but|so|yet|however|therefore)\s/i.test(s.text)
        );
      })
      .map((s) => s.id);

    if (candidates.length > 0) {
      issues.push({
        type: "low_semicolon_density",
        sentences: candidates,
        details: `Semicolon density ${semicolonDensity.toFixed(1)}/1000 is below recommended 2.0/1000 for formal writing.`,
        suggestion:
          "Add semicolons at compound sentence junctions. Replace comma+conjunction with semicolons for related independent clauses.",
      });
    }
  }

  // Detect em-dash:semicolon ratio imbalance
  if (totalEmDashes > 0 && totalSemicolons === 0) {
    issues.push({
      type: "em_dash_semicolon_ratio",
      sentences: emDashSentences.slice(0, 3),
      details: `Em-dash to semicolon ratio is ${totalEmDashes}:0. Zero semicolons with em-dashes present is a strong AI signal.`,
      suggestion:
        "Convert some em-dashes to semicolons, especially where two related independent clauses are joined.",
    });
  }

  const sentencesToFix = new Set(issues.flatMap((i) => i.sentences)).size;

  return {
    issues,
    metrics: {
      wordCount,
      emDashCount: totalEmDashes,
      emDashDensity: Number(emDashDensity.toFixed(1)),
      targetDensity,
      semicolonCount: totalSemicolons,
      semicolonDensity: Number(semicolonDensity.toFixed(1)),
      sentencesToFix,
      emDashSentences,
      stackedParagraphs,
    },
    sentenceDetails: (() => {
      const issueSentenceIds = new Set(issues.flatMap((i) => i.sentences || []));
      return sentenceDetails.filter(
        (s) => s.emDashCount > 0 || s.hasSemicolon || issueSentenceIds.has(s.id),
      );
    })(),
  };
}

// CLI entry point — only runs when this file is executed directly
if (import.meta.main) {
  (async () => {
    const { text, outFile, config, extraArgs } = await parseArgs(
      process.argv,
      ["--target-density"],
    );

    const prose = config.writing_style?.prose;

    // Priority: CLI flag > config > default
    let targetDensity = prose?.em_dash_density ?? DEFAULT_PROSE_TARGETS.em_dash_density;
    if (extraArgs["--target-density"]) {
      targetDensity = parseFloat(extraArgs["--target-density"]);
    }

    const minDensity = prose?.em_dash_min_density ?? DEFAULT_PROSE_TARGETS.em_dash_min_density;

    const result = analyzePunctuation(text, targetDensity, minDensity);
    await outputResult(result, outFile);
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
