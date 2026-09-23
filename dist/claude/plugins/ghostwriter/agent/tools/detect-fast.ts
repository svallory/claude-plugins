#!/usr/bin/env bun
/**
 * detect-fast.ts
 *
 * Runs only the fast TypeScript-based detectors (vocabulary, punctuation, structure)
 * for quick AI detection without the overhead of Python ML models.
 *
 * Usage:
 *   bun agent/tools/detect-fast.ts "<text to analyze>"
 *   bun agent/tools/detect-fast.ts input.md
 *   bun agent/tools/detect-fast.ts input.md --out results.json
 *   echo "text to analyze" | bun agent/tools/detect-fast.ts
 *
 * Output:
 *   JSON with combined score from fast detectors, classification, and signals.
 */

import { spawn } from "child_process";
import { join } from "path";
import { runCLI } from "./lib/cli-utils";

const TOOL_PATHS = {
  vocabulary: "agent/tools/detector/vocabulary-scan.ts",
  punctuation: "agent/tools/detector/unicode-punctuation-scan.ts",
  structure: "agent/tools/detector/structure-analyzer.ts",
};

// Weights for fast detector heuristics (normalized from full heuristics)
const FAST_WEIGHTS = {
  vocabulary: 0.40,   // 0.15 / (0.15 + 0.06 + 0.10) normalized
  punctuation: 0.16,  // 0.06 / (0.15 + 0.06 + 0.10) normalized
  structure: 0.44,    // ~0.10 + portion of content weight
};

interface ToolResult {
  score: number;
  classification: string;
  confidence: number;
  weight: number;
  weightedContribution: number;
  signals: string[];
  error?: string;
}

interface FastDetectResult {
  heuristicsScore: number;
  classification: "likely_ai" | "likely_human" | "uncertain";
  confidence: number;
  toolResults: Record<string, ToolResult>;
  topSignals: string[];
  summary: string;
  note: string;
}

/**
 * Run a TypeScript tool using bun
 */
async function runTool(
  toolName: string,
  toolPath: string,
  text: string
): Promise<{ name: string; result: any }> {
  return new Promise((resolve, reject) => {
    const absolutePath = join(process.cwd(), toolPath);
    const proc = spawn("bun", [absolutePath, text], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && stdout) {
        try {
          resolve({ name: toolName, result: JSON.parse(stdout) });
        } catch (err) {
          reject(new Error(`[${toolName}] Failed to parse JSON: ${err}`));
        }
      } else {
        reject(new Error(`[${toolName}] Process failed (code ${code}): ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`[${toolName}] Failed to spawn: ${err.message}`));
    });
  });
}

/**
 * Map classification strings to score values
 */
function classificationToScore(classification: string, confidence: number): number {
  const normalizedClass = classification.toLowerCase();

  if (normalizedClass.includes("ai")) {
    if (confidence >= 0.8) return 0.9;
    if (confidence >= 0.6) return 0.75;
    return 0.6;
  } else if (normalizedClass.includes("human")) {
    if (confidence >= 0.8) return 0.1;
    if (confidence >= 0.6) return 0.25;
    return 0.4;
  } else {
    return 0.5;
  }
}

/**
 * Extract signals from tool result
 */
function extractSignals(toolName: string, result: any): string[] {
  if (Array.isArray(result.signals)) {
    return result.signals;
  }

  if (result.flaggedWords && Array.isArray(result.flaggedWords)) {
    return result.flaggedWords.map((fw: any) =>
      `${fw.word} (${fw.count}x, severity: ${fw.severity})`
    );
  }

  if (result.summary && typeof result.summary === "string") {
    return [result.summary];
  }

  return [];
}

/**
 * Run fast detection
 */
async function runFastDetection(text: string): Promise<FastDetectResult> {
  // Run all fast tools in parallel
  const results = await Promise.allSettled([
    runTool("vocabulary", TOOL_PATHS.vocabulary, text),
    runTool("punctuation", TOOL_PATHS.punctuation, text),
    runTool("structure", TOOL_PATHS.structure, text),
  ]);

  const toolResults: Record<string, any> = {};

  for (const settledResult of results) {
    if (settledResult.status === "fulfilled") {
      const { name, result } = settledResult.value;
      toolResults[name] = result;
    } else {
      const errorMatch = settledResult.reason.message.match(/\[(\w+)\]/);
      const toolName = errorMatch ? errorMatch[1] : "unknown";
      toolResults[toolName] = {
        error: settledResult.reason.message,
        classification: "error",
        confidence: 0,
        signals: [],
      };
    }
  }

  // Calculate heuristics score
  const processedResults: Record<string, ToolResult> = {};
  let weightedSum = 0;
  let totalWeight = 0;
  const allSignals: Array<{ signal: string; weight: number }> = [];

  for (const [toolName, result] of Object.entries(toolResults)) {
    if (result.error) {
      processedResults[toolName] = {
        score: 0.5,
        classification: "error",
        confidence: 0,
        weight: 0,
        weightedContribution: 0,
        signals: [],
        error: result.error,
      };
      continue;
    }

    const weight = FAST_WEIGHTS[toolName as keyof typeof FAST_WEIGHTS] || 0.1;
    const confidence = result.confidence || 0.5;
    const classification = result.classification || "uncertain";
    const score = classificationToScore(classification, confidence);
    const signals = extractSignals(toolName, result);

    const weightedContribution = score * weight;

    processedResults[toolName] = {
      score,
      classification,
      confidence,
      weight,
      weightedContribution,
      signals,
    };

    weightedSum += weightedContribution;
    totalWeight += weight;

    for (const signal of signals) {
      allSignals.push({ signal, weight });
    }
  }

  const heuristicsScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Classification
  let classification: "likely_ai" | "likely_human" | "uncertain";
  let confidence: number;

  if (heuristicsScore > 0.65) {
    classification = "likely_ai";
    confidence = heuristicsScore > 0.80 ? 0.85 : 0.65;
  } else if (heuristicsScore < 0.35) {
    classification = "likely_human";
    confidence = heuristicsScore < 0.20 ? 0.85 : 0.65;
  } else {
    classification = "uncertain";
    confidence = 0.5;
  }

  // Top signals
  const uniqueSignals = new Map<string, number>();
  for (const { signal, weight } of allSignals) {
    if (!uniqueSignals.has(signal)) {
      uniqueSignals.set(signal, weight);
    }
  }

  const topSignals = Array.from(uniqueSignals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal]) => signal);

  // Summary
  const aiToolCount = Object.values(processedResults).filter(
    (r) => r.classification.includes("ai")
  ).length;

  const summary = `Fast detection complete (3 tools). Score: ${(heuristicsScore * 100).toFixed(1)}%. Classification: ${classification} (confidence: ${(confidence * 100).toFixed(0)}%). ${aiToolCount} tools detected AI signals.`;

  return {
    heuristicsScore: Number(heuristicsScore.toFixed(3)),
    classification,
    confidence: Number(confidence.toFixed(2)),
    toolResults: processedResults,
    topSignals,
    summary,
    note: "Fast detection uses only TypeScript tools (vocabulary, punctuation, structure). Use detect:heuristics for full analysis including Python ML models.",
  };
}

// Main execution
runCLI("agent/tools/detect-fast.ts", runFastDetection);
