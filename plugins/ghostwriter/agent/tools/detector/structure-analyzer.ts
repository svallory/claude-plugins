#!/usr/bin/env bun
/**
 * structure-analyzer.ts
 *
 * Analyzes text structure for AI detection markers and outputs JSON to stdout.
 * Supports context-aware thresholds for different media types.
 *
 * Usage:
 *   bun agent/tools/detector/structure-analyzer.ts "<text to analyze>"
 *   bun agent/tools/detector/structure-analyzer.ts input.md --config config.yml
 *   bun agent/tools/detector/structure-analyzer.ts input.md --config config.yml --out results.json
 *   echo "text to analyze" | bun agent/tools/detector/structure-analyzer.ts
 *
 * Output:
 *   JSON with structural analysis, AI signal detection, and classification.
 */

import { runCLI } from "../lib/cli-utils";
import type { ResolvedWritingConfig } from "../config/schemas";
import { getThreshold, checkThreshold } from "./lib/threshold";

interface ParagraphAnalysis {
  count: number;
  lengths: number[];
  mean: number;
  variance: number;
  fanoFactor: number;
}

interface BulletPointAnalysis {
  count: number;
  per100Words: number;
}

interface FormulaAnalysis {
  openingDetected: boolean;
  openingMatches: string[];
  closingDetected: boolean;
  closingMatches: string[];
}

interface SectionAnalysis {
  count: number;
  lengthVariance: number | null;
}

interface TransitionAnalysis {
  count: number;
  per1000Words: number;
  found: string[];
}

interface StructureAnalysisResult {
  paragraphAnalysis: ParagraphAnalysis;
  bulletPoints: BulletPointAnalysis;
  formulas: FormulaAnalysis;
  sections: SectionAnalysis;
  transitions: TransitionAnalysis;
  signals: string[];
  classification: "likely_ai" | "likely_human" | "uncertain";
  confidence: number;
  context: ResolvedWritingConfig;
  summary: string;
}

// Opening formulas commonly found in AI text
const OPENING_FORMULAS = [
  /\b(In today's (fast-paced|competitive|digital|modern|complex|evolving))/i,
  /\b(In an era where)/i,
  /\b(Have you ever wondered)/i,
  /\b(In the realm of)/i,
  /\b(When it comes to)/i,
  /\b(\w+ is one of the most (important|significant|crucial|vital|essential))/i,
];

// Closing formulas commonly found in AI text
const CLOSING_FORMULAS = [
  /\b(In conclusion,?)/i,
  /\b(In summary,?)/i,
  /\b(To sum up,?)/i,
  /\b(Whether you're .+ or .+,.+offers)/i,
  /\b(Both sides present valid)/i,
  /\b(As (I|we) progress|move forward|continue)/i,
];

// Transition words that indicate structured AI writing
const TRANSITION_WORDS = [
  "firstly",
  "secondly",
  "thirdly",
  "finally",
  "moreover",
  "furthermore",
  "additionally",
  "however",
  "therefore",
  "consequently",
];

function calculateStats(values: number[]): { mean: number; variance: number } {
  if (values.length === 0) {
    return { mean: 0, variance: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  return { mean, variance };
}

function analyzeParagraphs(text: string): ParagraphAnalysis {
  // Split on double+ newlines
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const lengths = paragraphs.map((p) => p.trim().split(/\s+/).length);

  if (lengths.length === 0) {
    return {
      count: 0,
      lengths: [],
      mean: 0,
      variance: 0,
      fanoFactor: 0,
    };
  }

  const { mean, variance } = calculateStats(lengths);
  const fanoFactor = mean > 0 ? variance / mean : 0;

  return {
    count: lengths.length,
    lengths,
    mean,
    variance,
    fanoFactor,
  };
}

function analyzeBulletPoints(text: string, wordCount: number): BulletPointAnalysis {
  // Match bullet points: lines starting with -, *, •, or numbered lists
  const bulletRegex = /^[\s]*[-*•]\s|^\d+\.\s/gm;
  const matches = text.match(bulletRegex) || [];
  const count = matches.length;

  const per100Words = wordCount > 0 ? (count / wordCount) * 100 : 0;

  return {
    count,
    per100Words,
  };
}

function detectFormulas(text: string): FormulaAnalysis {
  const openingMatches: string[] = [];
  const closingMatches: string[] = [];

  // Check opening formulas
  for (const formula of OPENING_FORMULAS) {
    const match = text.match(formula);
    if (match) {
      openingMatches.push(match[0].substring(0, 50));
    }
  }

  // Check closing formulas
  for (const formula of CLOSING_FORMULAS) {
    const match = text.match(formula);
    if (match) {
      closingMatches.push(match[0].substring(0, 50));
    }
  }

  return {
    openingDetected: openingMatches.length > 0,
    openingMatches,
    closingDetected: closingMatches.length > 0,
    closingMatches,
  };
}

function analyzeSections(text: string): SectionAnalysis {
  // Find all headings (lines starting with #)
  const headingRegex = /^#+\s+.+$/gm;
  const headings = text.match(headingRegex) || [];

  if (headings.length === 0) {
    return {
      count: 0,
      lengthVariance: null,
    };
  }

  // Split content by headings
  const sections = text.split(headingRegex).filter((s) => s.trim().length > 0);
  const sectionLengths = sections.map((s) => s.trim().split(/\s+/).length);

  const { variance } = calculateStats(sectionLengths);

  return {
    count: headings.length,
    lengthVariance: variance,
  };
}

function analyzeTransitions(text: string, wordCount: number): TransitionAnalysis {
  const found: string[] = [];
  let count = 0;

  for (const word of TRANSITION_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = text.match(regex) || [];
    if (matches.length > 0) {
      found.push(word);
      count += matches.length;
    }
  }

  const per1000Words = wordCount > 0 ? (count / wordCount) * 1000 : 0;

  return {
    count,
    per1000Words,
    found,
  };
}

function analyzeStructure(
  text: string,
  _extraArgs: Record<string, string>,
  config: ResolvedWritingConfig
): StructureAnalysisResult {
  // Word count
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  // Analyses
  const paragraphAnalysis = analyzeParagraphs(text);
  const bulletPoints = analyzeBulletPoints(text, wordCount);
  const formulas = detectFormulas(text);
  const sections = analyzeSections(text);
  const transitions = analyzeTransitions(text, wordCount);

  // Get context-aware thresholds
  const fanoCheck = checkThreshold("structure", "paragraph_fano_factor", paragraphAnalysis.fanoFactor, config, "below");
  const bulletCheck = checkThreshold("structure", "bullet_density", bulletPoints.per100Words, config, "above");
  const transitionCheck = checkThreshold("structure", "transition_density", transitions.per1000Words, config, "above");

  const fanoThreshold = getThreshold("structure", "paragraph_fano_factor", config);
  const bulletThreshold = getThreshold("structure", "bullet_density", config);

  // Collect signals
  const signals: string[] = [];

  if (formulas.openingDetected) {
    signals.push(`Opening formula detected: "${formulas.openingMatches[0]}"`);
  }

  if (formulas.closingDetected) {
    signals.push(`Closing formula detected: "${formulas.closingMatches[0]}"`);
  }

  // Fano factor check (only if metric not disabled for this context)
  if (fanoCheck?.shouldFlag && paragraphAnalysis.count > 3) {
    signals.push(
      `Very uniform paragraph lengths (Fano factor: ${paragraphAnalysis.fanoFactor.toFixed(2)}, ${fanoCheck.reason})`
    );
  }

  // Bullet density check (only if metric not disabled for this context)
  if (bulletCheck?.shouldFlag) {
    signals.push(
      `High bullet point density (${bulletPoints.per100Words.toFixed(1)} per 100 words, ${bulletCheck.reason})`
    );
  }

  // Transition density check
  if (transitionCheck?.shouldFlag) {
    signals.push(
      `High transition word density (${transitions.per1000Words.toFixed(1)} per 1000 words, ${transitionCheck.reason})`
    );
  }

  // Human signal: high Fano factor (varied paragraphs)
  const humanFanoThreshold = fanoThreshold?.human_baseline ?? 1.5;
  if (paragraphAnalysis.fanoFactor > humanFanoThreshold) {
    signals.push(
      `Variable paragraph structure (Fano factor: ${paragraphAnalysis.fanoFactor.toFixed(2)}) - human signal`
    );
  }

  // Classification logic
  let classification: "likely_ai" | "likely_human" | "uncertain";
  let confidence = 0.5;

  const aiIndicators =
    (formulas.openingDetected ? 1 : 0) +
    (formulas.closingDetected ? 1 : 0) +
    (fanoCheck?.shouldFlag && paragraphAnalysis.count > 3 ? 1 : 0) +
    (bulletCheck?.shouldFlag ? 1 : 0);

  const humanIndicators = paragraphAnalysis.fanoFactor > humanFanoThreshold ? 1 : 0;

  if (aiIndicators >= 2) {
    classification = "likely_ai";
    confidence = Math.min(0.95, 0.5 + aiIndicators * 0.15);
  } else if (humanIndicators > 0 && aiIndicators === 0) {
    classification = "likely_human";
    confidence = Math.min(0.95, 0.6 + humanIndicators * 0.15);
  } else {
    classification = "uncertain";
    confidence = 0.5;
  }

  // Summary
  let summary = "";
  if (classification === "likely_ai") {
    summary = `Text shows AI-like structural patterns (${config.publication.media} context): ${signals.slice(0, 2).join("; ")}.`;
  } else if (classification === "likely_human") {
    summary = `Text shows natural, varied structural patterns typical of human writing (${config.publication.media} context).`;
  } else {
    summary =
      signals.length > 0
        ? `Mixed signals detected (${config.publication.media} context): ${signals.slice(0, 2).join("; ")}.`
        : `No clear structural markers indicating AI or human authorship (${config.publication.media} context).`;
  }

  return {
    paragraphAnalysis,
    bulletPoints,
    formulas,
    sections,
    transitions,
    signals,
    classification,
    confidence: Number(confidence.toFixed(2)),
    context: config,
    summary,
  };
}

// Main execution
runCLI("agent/tools/detector/structure-analyzer.ts", analyzeStructure);
