#!/usr/bin/env bun
/**
 * heuristics.ts
 *
 * Runs all detection tools in parallel and combines their scores using
 * heuristics weights to produce a unified AI detection result.
 *
 * Usage:
 *   bun agent/tools/detector/heuristics.ts "<text to analyze>"
 *   bun agent/tools/detector/heuristics.ts input.md
 *   bun agent/tools/detector/heuristics.ts input.md --config my-config.yml
 *   bun agent/tools/detector/heuristics.ts input.md --config ./configs/author.yaml --out results.json
 *   echo "text to analyze" | bun agent/tools/detector/heuristics.ts
 *   bun agent/tools/detector/heuristics.ts input.md --use-llm       # Include LLM-based tools (binoculars, fast-detectgpt)
 *   bun agent/tools/detector/heuristics.ts input.md --only ai      # Show only AI-detecting tools
 *   bun agent/tools/detector/heuristics.ts input.md --only human   # Show only human-detecting tools
 *   bun agent/tools/detector/heuristics.ts input.md --profile      # Include execution time profiling
 *
 * Output:
 *   JSON with heuristics score, classification, tool results, and top signals.
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { runCLI } from '../lib/cli-utils';
import type { ResolvedWritingConfig } from '../config/schemas';
import { serializeConfigForEnv } from '../lib/config-loader';

// Resolve paths relative to this file's location, not process.cwd()
// This is critical for plugin usage where cwd is the user's project, not the plugin dir
const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const PLUGIN_ROOT = join(SCRIPT_DIR, '..', '..', '..');

// Heuristics weights from research (tool-specifications.md)
// binoculars (0.20) + fast_detectgpt (0.15) replace old detectgpt + perplexity
const HEURISTICS_WEIGHTS = {
  binoculars: 0.20,
  fast_detectgpt: 0.15,
  vocabulary: 0.15,
  burstiness: 0.12,
  ngram: 0.10,
  syntactic: 0.10,
  content: 0.08,
  punctuation: 0.05,
  structure: 0.05,
} as const;

// Tool paths relative to plugin root (resolved via PLUGIN_ROOT, not cwd)
const TOOL_PATHS = {
  vocabulary: 'agent/tools/detector/vocabulary-scan.ts',
  punctuation: 'agent/tools/detector/unicode-punctuation-scan.ts',
  structure: 'agent/tools/detector/structure-analyzer.ts',
  burstiness: 'agent/tools/detector/burstiness-calculator.py',
  ngram: 'agent/tools/detector/ngram-analyzer.py',
  content: 'agent/tools/detector/content-analyzer.py',
  syntactic: 'agent/tools/detector/syntactic-complexity.py',
  fast_detectgpt: 'agent/tools/detector/fast-detectgpt-wrapper.py',
  binoculars: 'agent/tools/detector/binoculars-wrapper.py',
} as const;

interface ToolResult {
  score: number;
  classification: string;
  confidence: number;
  weight: number;
  weightedContribution: number;
  signals: string[];
  executionTimeMs?: number;
  error?: string;
}

interface HeuristicsResult {
  heuristicsScore: number;
  classification: 'likely_ai' | 'likely_human' | 'uncertain';
  confidence: number;
  config: {
    media: string;
    author?: string;
    style?: Record<string, unknown>;
  };
  toolResults: Record<string, ToolResult>;
  topSignals: string[];
  summary: string;
  filter?: 'ai' | 'human'; // Track if results were filtered
  profiling?: {
    wallClockTimeMs: number;
    totalCpuTimeMs: number;
    toolTimes: Record<string, number>;
  };
}

/**
 * Run a TypeScript tool using bun with config
 */
async function runTypeScriptTool(
  toolName: string,
  toolPath: string,
  text: string,
  config: ResolvedWritingConfig,
  timeout: number = 30000,
): Promise<{ name: string; result: unknown; executionTimeMs: number }> {
  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    const absolutePath = join(PLUGIN_ROOT, toolPath);
    // Config is passed via WRITING_CONFIG env var
    const proc = spawn('bun', [absolutePath, text], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: {
        ...process.env,
        WRITING_CONFIG: serializeConfigForEnv(config),
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTimeMs = performance.now() - startTime;

      if (code === 0 && stdout) {
        try {
          resolve({
            name: toolName,
            result: JSON.parse(stdout),
            executionTimeMs,
          });
        } catch (err) {
          reject(new Error(`[${toolName}] Failed to parse JSON: ${err}`));
        }
      } else {
        reject(
          new Error(`[${toolName}] Process failed (code ${code}): ${stderr}`),
        );
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`[${toolName}] Failed to spawn: ${err.message}`));
    });
  });
}

/**
 * Run a Python tool using run-python.sh wrapper with config via env var
 */
async function runPythonTool(
  toolName: string,
  toolPath: string,
  text: string,
  config: ResolvedWritingConfig,
  timeout: number = 30000,
): Promise<{ name: string; result: unknown; executionTimeMs: number }> {
  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    const absolutePath = join(PLUGIN_ROOT, toolPath);
    const runPythonScript = join(PLUGIN_ROOT, 'agent/tools/run-python.sh');

    const proc = spawn(runPythonScript, [absolutePath, text], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: {
        ...process.env,
        WRITING_CONFIG: serializeConfigForEnv(config),
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTimeMs = performance.now() - startTime;

      if (code === 0 && stdout) {
        try {
          resolve({
            name: toolName,
            result: JSON.parse(stdout),
            executionTimeMs,
          });
        } catch (err) {
          reject(new Error(`[${toolName}] Failed to parse JSON: ${err}`));
        }
      } else {
        reject(
          new Error(`[${toolName}] Process failed (code ${code}): ${stderr}`),
        );
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`[${toolName}] Failed to spawn: ${err.message}`));
    });
  });
}

/**
 * Map classification strings to continuous score values.
 * Uses confidence to produce a continuous range [0.1, 0.9] instead of discrete buckets.
 */
function classificationToScore(
  classification: string,
  confidence: number,
): number {
  const normalizedClass = classification.toLowerCase();
  const clampedConf = Math.max(0, Math.min(1, confidence));

  if (normalizedClass === 'likely_ai') {
    return 0.5 + clampedConf * 0.4; // Range: [0.5, 0.9]
  } else if (normalizedClass === 'likely_human') {
    return 0.5 - clampedConf * 0.4; // Range: [0.1, 0.5]
  }
  return 0.5; // uncertain
}

/**
 * Extract signals from tool result
 */
function extractSignals(
  toolName: string,
  result: Record<string, unknown>,
): string[] {
  const signals: string[] = [];

  // Most tools have a 'signals' array
  if (Array.isArray(result.signals)) {
    return result.signals as string[];
  }

  // Vocabulary scan has flaggedWords
  if (result.flaggedWords && Array.isArray(result.flaggedWords)) {
    return (
      result.flaggedWords as Array<{
        word: string;
        count: number;
        severity: string;
      }>
    ).map((fw) => `${fw.word} (${fw.count}x, severity: ${fw.severity})`);
  }

  // Structure analyzer has specific properties
  if (result.formulas && typeof result.formulas === 'object') {
    const formulas = result.formulas as {
      openingDetected?: boolean;
      closingDetected?: boolean;
      openingMatches?: string[];
      closingMatches?: string[];
    };
    if (formulas.openingDetected && formulas.openingMatches) {
      signals.push(...formulas.openingMatches);
    }
    if (formulas.closingDetected && formulas.closingMatches) {
      signals.push(...formulas.closingMatches);
    }
  }

  // Add summary as fallback
  if (result.summary && typeof result.summary === 'string') {
    signals.push(result.summary);
  }

  return signals;
}

/**
 * Run all detection tools in parallel with config.
 * LLM-based tools (binoculars, fast-detectgpt) are skipped unless useLlm is true.
 */
async function runAllTools(
  text: string,
  config: ResolvedWritingConfig,
  useLlm: boolean = false,
): Promise<{
  toolResults: Record<string, unknown>;
  toolTimes: Record<string, number>;
  wallClockTimeMs: number;
}> {
  const wallClockStart = performance.now();

  // TypeScript tools
  const vocabularyPromise = runTypeScriptTool(
    'vocabulary',
    TOOL_PATHS.vocabulary,
    text,
    config,
  );
  const punctuationPromise = runTypeScriptTool(
    'punctuation',
    TOOL_PATHS.punctuation,
    text,
    config,
  );
  const structurePromise = runTypeScriptTool(
    'structure',
    TOOL_PATHS.structure,
    text,
    config,
  );

  // Python tools
  const burstiessPromise = runPythonTool(
    'burstiness',
    TOOL_PATHS.burstiness,
    text,
    config,
    30000,
  );
  const ngramPromise = runPythonTool(
    'ngram',
    TOOL_PATHS.ngram,
    text,
    config,
    30000,
  );
  const contentPromise = runPythonTool(
    'content',
    TOOL_PATHS.content,
    text,
    config,
    30000,
  );
  const syntacticPromise = runPythonTool(
    'syntactic',
    TOOL_PATHS.syntactic,
    text,
    config,
    30000,
  );

  // LLM-based detection tools (opt-in via --use-llm)
  const toolPromises: Promise<{ name: string; result: unknown; executionTimeMs: number }>[] = [
    vocabularyPromise,
    punctuationPromise,
    structurePromise,
    burstiessPromise,
    ngramPromise,
    contentPromise,
    syntacticPromise,
  ];

  if (useLlm) {
    toolPromises.push(
      runPythonTool('fast_detectgpt', TOOL_PATHS.fast_detectgpt, text, config, 30000),
      runPythonTool('binoculars', TOOL_PATHS.binoculars, text, config, 30000),
    );
  }

  // Wait for all tools with Promise.allSettled
  const results = await Promise.allSettled(toolPromises);

  const wallClockTimeMs = performance.now() - wallClockStart;

  // Build results object
  const toolResults: Record<string, unknown> = {};
  const toolTimes: Record<string, number> = {};

  for (const settledResult of results) {
    if (settledResult.status === 'fulfilled') {
      const { name, result, executionTimeMs } = settledResult.value;
      toolResults[name] = result;
      toolTimes[name] = executionTimeMs;
    } else {
      // Extract tool name from rejected promise error message
      const errorMatch = settledResult.reason.message.match(/\[(\w+)\]/);
      const toolName = errorMatch ? errorMatch[1] : 'unknown';
      toolResults[toolName] = {
        error: settledResult.reason.message,
        classification: 'error',
        confidence: 0,
        signals: [],
      };
    }
  }

  return { toolResults, toolTimes, wallClockTimeMs };
}

/**
 * Filter tool results based on classification
 */
function filterToolResults(
  toolResults: Record<string, ToolResult>,
  filter: 'ai' | 'human' | null,
): Record<string, ToolResult> {
  if (!filter) return toolResults;

  const filtered: Record<string, ToolResult> = {};
  for (const [toolName, result] of Object.entries(toolResults)) {
    if (result.error) continue;
    if (filter === 'ai' && result.classification.toLowerCase() === 'likely_ai') {
      filtered[toolName] = result;
    } else if (filter === 'human' && result.classification.toLowerCase() === 'likely_human') {
      filtered[toolName] = result;
    }
  }
  return filtered;
}

/**
 * Calculate heuristics score from tool results
 */
function calculateHeuristicsScore(
  toolResults: Record<string, unknown>,
  config: ResolvedWritingConfig,
  toolTimes: Record<string, number>,
  wallClockTimeMs: number | undefined,
  filter: 'ai' | 'human' | null = null,
  includeProfiling: boolean = false,
): HeuristicsResult {
  const processedResults: Record<string, ToolResult> = {};
  let weightedSum = 0;
  let totalWeight = 0;
  const allSignals: Array<{ signal: string; weight: number }> = [];

  // Map tool names to weights (some tools share weights)
  const toolWeightMap: Record<string, number> = {
    vocabulary: HEURISTICS_WEIGHTS.vocabulary,
    punctuation: HEURISTICS_WEIGHTS.punctuation,
    structure: HEURISTICS_WEIGHTS.structure,
    burstiness: HEURISTICS_WEIGHTS.burstiness,
    ngram: HEURISTICS_WEIGHTS.ngram,
    content: HEURISTICS_WEIGHTS.content,
    syntactic: HEURISTICS_WEIGHTS.syntactic,
    fast_detectgpt: HEURISTICS_WEIGHTS.fast_detectgpt,
    binoculars: HEURISTICS_WEIGHTS.binoculars,
  };

  // Process each tool result
  for (const [toolName, rawResult] of Object.entries(toolResults)) {
    const result = rawResult as Record<string, unknown>;

    if (result.error) {
      // Skip failed tools
      processedResults[toolName] = {
        score: 0.5,
        classification: 'error',
        confidence: 0,
        weight: 0,
        weightedContribution: 0,
        signals: [],
        error: result.error as string,
      };
      continue;
    }

    const weight = toolWeightMap[toolName] || 0.05;
    const confidence = (result.confidence as number) || 0.5;
    const classification = (result.classification as string) || 'uncertain';
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
      executionTimeMs: toolTimes[toolName],
    };

    // Add to weighted sum
    weightedSum += weightedContribution;
    totalWeight += weight;

    // Collect signals with weights for ranking
    for (const signal of signals) {
      allSignals.push({ signal, weight });
    }
  }

  // Normalize if some tools failed
  const heuristicsScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Classification thresholds
  let classification: 'likely_ai' | 'likely_human' | 'uncertain';
  let confidence: number;

  if (heuristicsScore > 0.7) {
    classification = 'likely_ai';
    confidence = heuristicsScore > 0.85 ? 0.95 : 0.75;
  } else if (heuristicsScore < 0.3) {
    classification = 'likely_human';
    confidence = heuristicsScore < 0.15 ? 0.95 : 0.75;
  } else {
    classification = 'uncertain';
    confidence = 0.5;
  }

  // Sort signals by weight and deduplicate
  const uniqueSignals = new Map<string, number>();
  for (const { signal, weight } of allSignals) {
    if (!uniqueSignals.has(signal)) {
      uniqueSignals.set(signal, weight);
    }
  }

  const topSignals = Array.from(uniqueSignals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([signal]) => signal);

  // Filter results if requested
  const displayResults = filterToolResults(processedResults, filter);

  // Generate summary
  const aiToolCount = Object.values(processedResults).filter((r) =>
    r.classification.toLowerCase() === 'likely_ai',
  ).length;
  const humanToolCount = Object.values(processedResults).filter((r) =>
    r.classification.toLowerCase() === 'likely_human',
  ).length;
  const successfulTools = Object.values(processedResults).filter(
    (r) => !r.error,
  ).length;

  let summary = `Heuristics analysis complete (${successfulTools} tools, context: ${config.publication.media}). `;
  summary += `Score: ${(heuristicsScore * 100).toFixed(1)}%. `;
  summary += `Classification: ${classification} (confidence: ${(confidence * 100).toFixed(0)}%). `;
  summary += `${aiToolCount} tools detected AI signals, ${humanToolCount} detected human signals.`;
  if (filter) {
    summary += ` Showing only ${filter}-detecting tools (${Object.keys(displayResults).length} shown).`;
  }

  // Build config summary for output
  const configSummary: HeuristicsResult['config'] = {
    media: config.publication.media,
  };
  if (config.author?.name) {
    configSummary.author = config.author.name;
  }
  if (config.writing_style && Object.keys(config.writing_style).length > 0) {
    configSummary.style = config.writing_style as Record<string, unknown>;
  }

  const result: HeuristicsResult = {
    heuristicsScore: Number(heuristicsScore.toFixed(3)),
    classification,
    confidence: Number(confidence.toFixed(2)),
    config: configSummary,
    toolResults: displayResults,
    topSignals,
    summary,
  };

  if (filter) {
    result.filter = filter;
  }

  if (includeProfiling && wallClockTimeMs !== undefined) {
    const totalCpuTimeMs = Object.values(toolTimes).reduce(
      (sum, time) => sum + time,
      0,
    );
    result.profiling = {
      wallClockTimeMs: Number(wallClockTimeMs.toFixed(2)),
      totalCpuTimeMs: Number(totalCpuTimeMs.toFixed(2)),
      toolTimes: Object.fromEntries(
        Object.entries(toolTimes).map(([name, time]) => [
          name,
          Number(time.toFixed(2)),
        ]),
      ),
    };
  }

  return result;
}

/**
 * Run heuristics analysis with config
 */
async function runHeuristics(
  text: string,
  extraArgs: Record<string, string>,
  config: ResolvedWritingConfig,
): Promise<HeuristicsResult> {
  const useLlm = extraArgs['--use-llm'] === 'true';
  const { toolResults, toolTimes, wallClockTimeMs } = await runAllTools(
    text,
    config,
    useLlm,
  );
  const filter = extraArgs['--only'] as 'ai' | 'human' | undefined;
  const includeProfiling =
    extraArgs['--profile'] === 'true' || extraArgs['--profile'] === '';
  return calculateHeuristicsScore(
    toolResults,
    config,
    toolTimes,
    wallClockTimeMs,
    filter || null,
    includeProfiling,
  );
}

/**
 * Main execution
 */
runCLI('agent/tools/detector/heuristics.ts', runHeuristics, {
  extraArgDefs: ['--only', '--profile', '--use-llm'],
  extraUsage: ' [--use-llm] [--only ai|human] [--profile]',
});
