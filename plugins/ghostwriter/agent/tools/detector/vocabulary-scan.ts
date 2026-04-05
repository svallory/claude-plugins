#!/usr/bin/env bun
/**
 * vocabulary-scan.ts
 *
 * Scans text for AI vocabulary markers and outputs JSON to stdout.
 * Supports context-aware thresholds for different media types.
 *
 * Usage:
 *   bun agent/tools/detector/vocabulary-scan.ts "<text to analyze>"
 *   bun agent/tools/detector/vocabulary-scan.ts input.md --config config.yml
 *   bun agent/tools/detector/vocabulary-scan.ts input.md --config config.yml --out results.json
 *   echo "text to analyze" | bun agent/tools/detector/vocabulary-scan.ts
 *
 * Output:
 *   JSON with flagged words, locations, severity, and overall score.
 */

import { runCLI } from "../lib/cli-utils";
import type { ResolvedWritingConfig } from "../config/schemas";
import { getThreshold, checkThreshold } from "./lib/threshold";

// AI vocabulary markers with frequency multipliers
// Source: Kobak et al. (2024) arXiv:2406.07016 (PubMed study)
const AI_VOCAB_MARKERS: Record<string, { multiplier: number; severity: "critical" | "high" | "moderate" }> = {
  // Critical markers (25x+ frequency in AI text)
  delve: { multiplier: 25.2, severity: "critical" },
  delves: { multiplier: 25.2, severity: "critical" },
  delving: { multiplier: 25.2, severity: "critical" },
  showcasing: { multiplier: 9.2, severity: "critical" },
  underscores: { multiplier: 9.1, severity: "critical" },
  tapestry: { multiplier: 10, severity: "critical" },

  // High-risk markers (5x+ frequency)
  comprehensive: { multiplier: 5, severity: "high" },
  crucial: { multiplier: 5, severity: "high" },
  meticulous: { multiplier: 5, severity: "high" },
  robust: { multiplier: 5, severity: "high" },
  pivotal: { multiplier: 5, severity: "high" },

  // Moderate markers (3x+ frequency)
  harness: { multiplier: 3, severity: "moderate" },
  leverage: { multiplier: 3, severity: "moderate" },
  utilize: { multiplier: 3, severity: "moderate" },
  notably: { multiplier: 3, severity: "moderate" },
  furthermore: { multiplier: 3, severity: "moderate" },
  bustling: { multiplier: 6, severity: "moderate" },
  vibrant: { multiplier: 4, severity: "moderate" },
  underpins: { multiplier: 4, severity: "moderate" },
  nuanced: { multiplier: 4, severity: "moderate" },
  multifaceted: { multiplier: 5, severity: "moderate" },
  intricate: { multiplier: 3, severity: "moderate" },
  realm: { multiplier: 3, severity: "moderate" },
};

interface FlaggedWord {
  word: string;
  count: number;
  positions: number[];
  multiplier: number;
  severity: "critical" | "high" | "moderate";
  contribution: number;
}

interface ScanResult {
  flaggedWords: FlaggedWord[];
  totalFlags: number;
  aiVocabScore: number;
  aiVocabDensity: number;
  wordCount: number;
  classification: "likely_ai" | "likely_human" | "uncertain";
  confidence: number;
  context: ResolvedWritingConfig;
  summary: string;
}

function scanText(
  text: string,
  _extraArgs: Record<string, string>,
  config: ResolvedWritingConfig
): ScanResult {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  const flagged: Map<string, FlaggedWord> = new Map();

  // Scan for each marker
  for (const [marker, info] of Object.entries(AI_VOCAB_MARKERS)) {
    const regex = new RegExp(`\\b${marker}\\b`, "gi");
    let match;
    const positions: number[] = [];

    while ((match = regex.exec(text)) !== null) {
      positions.push(match.index);
    }

    if (positions.length > 0) {
      const contribution = positions.length * info.multiplier;
      flagged.set(marker, {
        word: marker,
        count: positions.length,
        positions,
        multiplier: info.multiplier,
        severity: info.severity,
        contribution,
      });
    }
  }

  const flaggedWords = Array.from(flagged.values()).sort((a, b) => b.contribution - a.contribution);

  const totalFlags = flaggedWords.reduce((sum, f) => sum + f.count, 0);
  const totalContribution = flaggedWords.reduce((sum, f) => sum + f.contribution, 0);

  // Calculate AI vocab density (per 1000 words)
  const aiVocabDensity = wordCount > 0 ? (totalFlags / wordCount) * 1000 : 0;

  // Calculate AI vocab score (0-1)
  // Normalize contribution by word count, cap at 1
  const aiVocabScore = Math.min(1, totalContribution / (wordCount * 0.5));

  // Get context-aware threshold
  const densityCheck = checkThreshold("vocabulary", "ai_vocab_density", aiVocabDensity, config, "above");
  const densityThreshold = getThreshold("vocabulary", "ai_vocab_density", config);

  // Classification using context-aware thresholds
  let classification: "likely_ai" | "likely_human" | "uncertain";
  let confidence: number;

  const hasCritical = flaggedWords.some((f) => f.severity === "critical");
  const aiThreshold = densityThreshold?.ai_threshold ?? 15;
  const humanThreshold = densityThreshold?.human_baseline ?? 5;

  if (densityCheck?.shouldFlag || hasCritical) {
    classification = "likely_ai";
    confidence = hasCritical ? 0.85 : 0.70;
  } else if (aiVocabDensity < humanThreshold && totalFlags === 0) {
    classification = "likely_human";
    confidence = 0.65;
  } else {
    classification = "uncertain";
    confidence = 0.50;
  }

  // Summary
  const criticalWords = flaggedWords.filter((f) => f.severity === "critical");
  const highWords = flaggedWords.filter((f) => f.severity === "high");

  let summary = "";
  if (totalFlags === 0) {
    summary = `No AI vocabulary markers detected (${config.publication.media} context).`;
  } else {
    const parts: string[] = [];
    if (criticalWords.length > 0) {
      parts.push(`Critical: ${criticalWords.map((w) => `'${w.word}'`).join(", ")}`);
    }
    if (highWords.length > 0) {
      parts.push(`High-risk: ${highWords.map((w) => `'${w.word}'`).join(", ")}`);
    }
    summary = `Found ${totalFlags} AI vocabulary marker(s) (${config.publication.media} context, threshold: ${aiThreshold}). ${parts.join(". ")}`;
  }

  return {
    flaggedWords,
    totalFlags,
    aiVocabScore,
    aiVocabDensity,
    wordCount,
    classification,
    confidence: Number(confidence.toFixed(2)),
    context: config,
    summary,
  };
}

// Main execution
runCLI("agent/tools/detector/vocabulary-scan.ts", scanText);
