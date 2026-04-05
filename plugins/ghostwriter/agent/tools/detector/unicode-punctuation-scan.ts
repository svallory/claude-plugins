#!/usr/bin/env bun
/**
 * unicode-punctuation-scan.ts
 *
 * Scans text for AI punctuation markers including em dashes, smart quotes,
 * unicode ellipsis, and punctuation ratios that indicate AI generation.
 * Supports context-aware thresholds for different media types.
 *
 * Usage:
 *   bun agent/tools/detector/unicode-punctuation-scan.ts "<text to analyze>"
 *   bun agent/tools/detector/unicode-punctuation-scan.ts input.md --config config.yml
 *   bun agent/tools/detector/unicode-punctuation-scan.ts input.md --config config.yml --out results.json
 *   echo "text to analyze" | bun agent/tools/detector/unicode-punctuation-scan.ts
 *
 * Output:
 *   JSON with punctuation metrics, detected signals, and classification.
 */

import { runCLI } from "../lib/cli-utils";
import type { ResolvedWritingConfig } from "../config/schemas";
import { checkThreshold } from "./lib/threshold";

interface PunctuationMetrics {
  wordCount: number;
  emDash: {
    count: number;
    per1000: number;
    stackedPatterns: number;
  };
  smartQuotes: {
    count: number;
    mixedWithStraight: boolean;
  };
  unicodeEllipsis: {
    count: number;
    asciiEllipsisCount: number;
  };
  semicolon: {
    count: number;
    per1000: number;
  };
  parenthesis: {
    count: number;
    per1000: number;
  };
  ratios: {
    semicolonToEmDash: number;
    parenthesisToEmDash: number;
  };
  oxfordComma: {
    used: number;
    notUsed: number;
    consistency: number;
  };
  periodQuotePlacement: {
    inside: number;
    outside: number;
    consistency: number;
  };
}

interface PunctuationScanResult {
  metrics: PunctuationMetrics;
  signals: string[];
  classification: "likely_ai" | "likely_human" | "uncertain";
  confidence: number;
  context: ResolvedWritingConfig;
  summary: string;
}

function countWordLike(text: string): number {
  // Count word-like tokens (excluding pure punctuation)
  const words = text.match(/\b[\w]+\b/g) || [];
  return words.length;
}

function calculatePer1000Words(count: number, wordCount: number): number {
  if (wordCount === 0) return 0;
  return (count / wordCount) * 1000;
}

function detectStackedEmDashes(text: string): number {
  // Pattern: "word—...—word" with em dashes separated by words/content
  const stackedPattern = /\w+—[\s\w]+—/g;
  const matches = text.match(stackedPattern) || [];
  return matches.length;
}

function detectSmartQuotes(text: string): { count: number; mixedWithStraight: boolean } {
  const leftDouble = (text.match(/\u201C/g) || []).length;
  const rightDouble = (text.match(/\u201D/g) || []).length;
  const leftSingle = (text.match(/\u2018/g) || []).length;
  const rightSingle = (text.match(/\u2019/g) || []).length;
  const smartCount = leftDouble + rightDouble + leftSingle + rightSingle;

  const straightDoubleQuote = (text.match(/"/g) || []).length;
  const straightSingleQuote = (text.match(/'/g) || []).length;
  const straightCount = straightDoubleQuote + straightSingleQuote;

  const mixed = smartCount > 0 && straightCount > 0;

  return {
    count: smartCount,
    mixedWithStraight: mixed,
  };
}

function detectOxfordComma(text: string): {
  used: number;
  notUsed: number;
  consistency: number;
} {
  // Oxford comma: "X, Y, and Z"
  const oxfordPattern = /\w+,\s+\w+,\s+and\s+\w+/g;
  const oxfordMatches = text.match(oxfordPattern) || [];

  // Non-Oxford: "X, Y and Z"
  const nonOxfordPattern = /\w+,\s+\w+\s+and\s+\w+/g;
  const nonOxfordMatches = text.match(nonOxfordPattern) || [];

  const used = oxfordMatches.length;
  const notUsed = nonOxfordMatches.length;
  const total = used + notUsed;

  const consistency = total > 0 ? (Math.max(used, notUsed) / total) * 100 : 0;

  return {
    used,
    notUsed,
    consistency,
  };
}

function detectPeriodQuotePlacement(text: string): {
  inside: number;
  outside: number;
  consistency: number;
} {
  // American style: "word." (period inside closing quote)
  const insidePattern = /"\w[\w\s]*\."/g;
  const insideMatches = text.match(insidePattern) || [];

  // Also match single quotes
  const insideSinglePattern = /'\w[\w\s]*\.'/g;
  const insideSingleMatches = text.match(insideSinglePattern) || [];

  // British style: "word". (period outside)
  const outsidePattern = /"\w[\w\s]*"\./g;
  const outsideMatches = text.match(outsidePattern) || [];

  const outsideSinglePattern = /'\w[\w\s]*'\./g;
  const outsideSingleMatches = text.match(outsideSinglePattern) || [];

  const inside = insideMatches.length + insideSingleMatches.length;
  const outside = outsideMatches.length + outsideSingleMatches.length;
  const total = inside + outside;

  const consistency = total > 0 ? (Math.max(inside, outside) / total) * 100 : 0;

  return {
    inside,
    outside,
    consistency,
  };
}

function scanText(
  text: string,
  _extraArgs: Record<string, string>,
  config: ResolvedWritingConfig
): PunctuationScanResult {
  const wordCount = countWordLike(text);

  // Count em dashes (U+2014)
  const emDashCount = (text.match(/—/g) || []).length;
  const emDashPer1000 = calculatePer1000Words(emDashCount, wordCount);
  const stackedPatterns = detectStackedEmDashes(text);

  // Count smart quotes
  const smartQuotes = detectSmartQuotes(text);

  // Count Unicode ellipsis (U+2026) vs ASCII ellipsis (...)
  const unicodeEllipsisCount = (text.match(/…/g) || []).length;
  const asciiEllipsisCount = (text.match(/\.\.\./g) || []).length;

  // Count semicolons
  const semicolonCount = (text.match(/;/g) || []).length;
  const semicolonPer1000 = calculatePer1000Words(semicolonCount, wordCount);

  // Count parentheses
  const parenthesisCount = (text.match(/[()]/g) || []).length;
  const parenthesisPer1000 = calculatePer1000Words(parenthesisCount, wordCount);

  // Calculate ratios (avoid division by zero)
  const semicolonToEmDash = emDashCount > 0 ? semicolonCount / emDashCount : 0;
  const parenthesisToEmDash = emDashCount > 0 ? parenthesisCount / emDashCount : 0;

  // Detect Oxford comma usage
  const oxfordComma = detectOxfordComma(text);

  // Detect period-quote placement
  const periodQuotePlacement = detectPeriodQuotePlacement(text);

  // Build signals array using context-aware thresholds
  const signals: string[] = [];

  // Em dash frequency check
  const emDashCheck = checkThreshold("punctuation", "em_dash", emDashPer1000, config, "above");
  if (emDashCheck?.shouldFlag) {
    signals.push(`Em dash frequency high: ${emDashPer1000.toFixed(2)} per 1000 words (${emDashCheck.reason})`);
  }

  if (stackedPatterns > 0) {
    signals.push(`Stacked em dash patterns found: ${stackedPatterns} instance(s)`);
  }

  // Semicolon:em-dash ratio check
  const semicolonRatioCheck = checkThreshold("punctuation", "semicolon_to_em_dash_ratio", semicolonToEmDash, config, "below");
  if (semicolonRatioCheck?.shouldFlag && emDashCount > 0) {
    signals.push(`Semicolon:em-dash ratio too low: ${semicolonToEmDash.toFixed(2)} (${semicolonRatioCheck.reason})`);
  }

  // Parenthesis:em-dash ratio check
  const parenthesisRatioCheck = checkThreshold("punctuation", "parenthesis_to_em_dash_ratio", parenthesisToEmDash, config, "below");
  if (parenthesisRatioCheck?.shouldFlag && emDashCount > 0) {
    signals.push(`Parenthesis:em-dash ratio too low: ${parenthesisToEmDash.toFixed(2)} (${parenthesisRatioCheck.reason})`);
  }

  // Oxford comma consistency check
  const oxfordCommaCheck = checkThreshold("punctuation", "oxford_comma", oxfordComma.consistency, config, "above");
  if (oxfordCommaCheck?.shouldFlag && oxfordComma.used + oxfordComma.notUsed > 2) {
    signals.push(`Oxford comma consistency very high: ${oxfordComma.consistency.toFixed(1)}% (${oxfordCommaCheck.reason})`);
  }

  // Period-quote placement consistency check
  const periodQuoteCheck = checkThreshold("punctuation", "period_quote", periodQuotePlacement.consistency, config, "above");
  if (periodQuoteCheck?.shouldFlag && periodQuotePlacement.inside + periodQuotePlacement.outside > 2) {
    signals.push(
      `Period-quote placement consistency very high: ${periodQuotePlacement.consistency.toFixed(1)}% (${periodQuoteCheck.reason})`
    );
  }

  if (smartQuotes.count > 0 && smartQuotes.mixedWithStraight) {
    signals.push(`Mixed smart and straight quotes (indicates editing/copying)`);
  }

  // Classification logic
  // If no AI signals were flagged, the text passes all threshold checks → likely_human.
  // The signal checks above already use ai_threshold as the bar; requiring human_baseline
  // too creates a dead zone where text is "not AI" but "not human" → incorrect "uncertain".
  let classification: "likely_ai" | "likely_human" | "uncertain";
  let confidence: number;

  if (signals.length >= 3) {
    classification = "likely_ai";
    confidence = Math.min(0.95, 0.5 + signals.length * 0.15);
  } else if (signals.length === 0) {
    classification = "likely_human";
    confidence = 0.65;
  } else {
    // 1-2 signals: uncertain
    classification = "uncertain";
    confidence = Math.max(0.3, Math.min(0.7, signals.length * 0.2 + 0.3));
  }

  // Summary
  let summary = "";
  if (signals.length === 0) {
    summary = `No AI punctuation signals detected for ${config.publication.media} context. Text shows human-like patterns.`;
  } else if (signals.length === 1) {
    summary = `1 AI punctuation signal detected (${config.publication.media} context): ${signals[0]}.`;
  } else {
    summary = `${signals.length} AI punctuation signals detected (${config.publication.media} context).`;
  }

  return {
    metrics: {
      wordCount,
      emDash: {
        count: emDashCount,
        per1000: Number(emDashPer1000.toFixed(2)),
        stackedPatterns,
      },
      smartQuotes: {
        count: smartQuotes.count,
        mixedWithStraight: smartQuotes.mixedWithStraight,
      },
      unicodeEllipsis: {
        count: unicodeEllipsisCount,
        asciiEllipsisCount,
      },
      semicolon: {
        count: semicolonCount,
        per1000: Number(semicolonPer1000.toFixed(2)),
      },
      parenthesis: {
        count: parenthesisCount,
        per1000: Number(parenthesisPer1000.toFixed(2)),
      },
      ratios: {
        semicolonToEmDash: Number(semicolonToEmDash.toFixed(3)),
        parenthesisToEmDash: Number(parenthesisToEmDash.toFixed(3)),
      },
      oxfordComma,
      periodQuotePlacement,
    },
    signals,
    classification,
    confidence: Number(confidence.toFixed(2)),
    context: config,
    summary,
  };
}

// Main execution
runCLI("agent/tools/detector/unicode-punctuation-scan.ts", scanText);
