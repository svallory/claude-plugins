#!/usr/bin/env bun
/**
 * build-fix-plan.ts
 *
 * Cross-references all analysis tool outputs and computes the minimum set of
 * sentences to fix, with ALL issues per sentence combined into a single entry.
 *
 * This eliminates the "whack-a-mole" problem where fixing one issue type
 * introduces another, by giving the Writer ONE rewrite instruction per sentence
 * covering ALL constraints simultaneously.
 *
 * Usage:
 *   bun agent/tools/writer/build-fix-plan.ts \
 *     --aux auxiliary-analysis.json \
 *     --pronoun pronoun-analysis.json \
 *     --punctuation punctuation-analysis.json \
 *     --structure structure-analysis.json \
 *     --noun noun-analysis.json \
 *     --vocabulary vocabulary-analysis.json \
 *     --config config.yml \
 *     --out fix-plan.json
 *
 * All flags optional — if a JSON file doesn't exist or isn't passed, skip it.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DEFAULT_PROSE_TARGETS } from "../config/presets/defaults";
import type { ProseTargets } from "../config/schemas";
import { loadConfig, deserializeConfigFromEnv } from "../lib/config-loader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolName =
  | "punctuation"
  | "auxiliary"
  | "pronoun"
  | "structure"
  | "noun"
  | "vocabulary";

type Priority = "critical" | "high" | "medium" | "low";

interface Issue {
  tool: ToolName;
  priority: Priority;
  instruction: string;
  contribution: number;
}

interface ToolBudget {
  tool: ToolName;
  metric: string;
  current: number;
  target: number;
  unit: string;
  excess: number;
  needsFix: boolean;
}

interface Constraint {
  tool: string;
  priority: string;
  instruction: string;
}

interface FixPlanEntry {
  id: number;
  text: string;
  paragraphIndex: number;
  issueCount: number;
  constraints: Constraint[];
}

interface FixPlan {
  summary: {
    totalSentencesToFix: number;
    budgets: ToolBudget[];
  };
  sentences: FixPlanEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum word count for a sentence to be considered "short punchy".
 * Short sentences contribute to burstiness (the strongest human signal),
 * so they should NOT be flagged for structural expansion.
 */
const SHORT_SENTENCE_WORD_LIMIT = 6;

// ---------------------------------------------------------------------------
// Priority scoring
// ---------------------------------------------------------------------------

const PRIORITY_SCORE: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ---------------------------------------------------------------------------
// Human baseline targets for writer-only metrics (no detector rule equivalent)
// Resolved from config at runtime; falls back to DEFAULT_PROSE_TARGETS.
// ---------------------------------------------------------------------------

function getWriterTargets(prose?: ProseTargets): Record<string, { target: number; unit: string }> {
  return {
    auxiliaryDensity: { target: prose?.auxiliary_density ?? DEFAULT_PROSE_TARGETS.auxiliary_density, unit: "%" },
    pronounDensity: { target: prose?.pronoun_density ?? DEFAULT_PROSE_TARGETS.pronoun_density, unit: "%" },
    nounDensity: { target: prose?.noun_density ?? DEFAULT_PROSE_TARGETS.noun_density, unit: "%" },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafe(path: string | null): any | null {
  if (!path) return null;
  const resolved = resolve(path);
  if (!existsSync(resolved)) return null;
  try {
    return JSON.parse(readFileSync(resolved, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Try to get a sentence's text and paragraphIndex from any of the loaded data.
 * Falls back to empty string / -1 if not found.
 */
function getSentenceInfo(
  id: number,
  allData: Record<string, any>,
): { text: string; paragraphIndex: number } {
  // Check auxiliary flaggedSentences
  const aux = allData.auxiliary;
  if (aux?.flaggedSentences) {
    const s = aux.flaggedSentences.find((f: any) => f.id === id);
    if (s) return { text: s.text, paragraphIndex: s.paragraphIndex ?? -1 };
  }

  // Check pronoun sentenceGroups
  const pro = allData.pronoun;
  if (pro?.sentenceGroups) {
    for (const group of pro.sentenceGroups) {
      for (const s of group.sentences || []) {
        if (s.id === id) return { text: s.text, paragraphIndex: -1 };
      }
    }
  }

  // Check punctuation sentenceDetails
  const punc = allData.punctuation;
  if (punc?.sentenceDetails) {
    const s = punc.sentenceDetails.find((f: any) => f.id === id);
    if (s) return { text: s.text, paragraphIndex: s.paragraphIndex ?? -1 };
  }

  // Check structure flaggedSentences
  const struct = allData.structure;
  if (struct?.flaggedSentences) {
    const s = struct.flaggedSentences.find((f: any) => f.id === id);
    if (s) return { text: s.text, paragraphIndex: -1 };
  }

  // Check noun flaggedSentences
  const noun = allData.noun;
  if (noun?.flaggedSentences) {
    const s = noun.flaggedSentences.find((f: any) => f.id === id);
    if (s) return { text: s.text, paragraphIndex: -1 };
  }

  // Check vocabulary flaggedSentences
  const vocab = allData.vocabulary;
  if (vocab?.flaggedSentences) {
    const s = vocab.flaggedSentences.find((f: any) => f.id === id);
    if (s) return { text: s.text, paragraphIndex: -1 };
  }

  console.error(`[build-fix-plan] WARNING: Sentence ID ${id} not found in any tool output`);
  return { text: "", paragraphIndex: -1 };
}

// ---------------------------------------------------------------------------
// Step 1: Index issues by sentence ID
// ---------------------------------------------------------------------------

function indexAuxiliary(data: any): Map<number, Issue[]> {
  const map = new Map<number, Issue[]>();
  if (!data?.flaggedSentences) return map;

  for (const s of data.flaggedSentences) {
    const issues = map.get(s.id) || [];
    // Build instruction from patterns
    const patternInstructions = (s.patterns || [])
      .map((p: any) => {
        const phrase = p.fullPhrase ? ` "${p.fullPhrase}"` : "";
        return `${p.type}${phrase}: ${p.suggestion}`;
      })
      .join("; ");

    const instruction =
      patternInstructions ||
      (s.suggestedRewrites || []).join("; ") ||
      "Reduce auxiliary verbs";

    issues.push({
      tool: "auxiliary",
      priority: s.priority || "medium",
      instruction,
      contribution: Math.min(s.auxiliaryCount || 1, 2),
    });
    map.set(s.id, issues);
  }
  return map;
}

function indexPronoun(data: any): Map<number, Issue[]> {
  const map = new Map<number, Issue[]>();
  if (!data?.sentenceGroups) return map;

  for (const group of data.sentenceGroups) {
    const strategies = (group.suggestedStrategies || []).join("; ");
    for (const s of group.sentences || []) {
      if (s.role !== "target") continue;
      const issues = map.get(s.id) || [];
      issues.push({
        tool: "pronoun",
        priority: group.priority || "medium",
        instruction:
          strategies || "Replace pronouns with specific noun references",
        contribution: Math.ceil((s.pronounCount || 1) * 0.5),
      });
      map.set(s.id, issues);
    }
  }
  return map;
}

function indexPunctuation(data: any): Map<number, Issue[]> {
  const map = new Map<number, Issue[]>();
  if (!data?.issues) return map;

  for (const issue of data.issues) {
    const suggestion = issue.suggestion || "Fix punctuation issue";
    for (const sentenceId of issue.sentences || []) {
      const issues = map.get(sentenceId) || [];
      issues.push({
        tool: "punctuation",
        priority:
          issue.type === "em_dash_density"
            ? "high"
            : issue.type === "low_em_dash_density"
              ? "high"
              : "medium",
        instruction: `[${issue.type}] ${suggestion}`,
        contribution: 1,
      });
      map.set(sentenceId, issues);
    }
  }
  return map;
}

function indexStructure(data: any): Map<number, Issue[]> {
  const map = new Map<number, Issue[]>();
  if (!data?.flaggedSentences) return map;

  for (const s of data.flaggedSentences) {
    // Protect short punchy sentences that contribute to burstiness.
    // Burstiness (sentence length variation) carries the highest detection
    // weight (0.12) and is the strongest human signal. Expanding short
    // sentences would hurt burstiness to marginally improve a weaker metric.
    const wordCount = s.wordCount ?? (s.text ? s.text.split(/\s+/).filter(Boolean).length : 0);
    if (wordCount <= SHORT_SENTENCE_WORD_LIMIT) {
      console.error(
        `[build-fix-plan] Skipping structure fix for sentence ${s.id} (${wordCount} words) — protecting burstiness`,
      );
      continue;
    }

    const issues = map.get(s.id) || [];
    const actions = (s.suggestedActions || []).join("; ");
    issues.push({
      tool: "structure",
      priority: s.priority || "medium",
      instruction: actions || s.reason || "Improve sentence structure",
      contribution: 1,
    });
    map.set(s.id, issues);
  }
  return map;
}

function indexNoun(data: any): Map<number, Issue[]> {
  const map = new Map<number, Issue[]>();
  if (!data?.flaggedSentences) return map;

  for (const s of data.flaggedSentences) {
    const issues = map.get(s.id) || [];
    const actions = (s.suggestedActions || []).join("; ");
    issues.push({
      tool: "noun",
      priority: s.priority || "medium",
      instruction: actions || "Increase noun density",
      contribution: 1,
    });
    map.set(s.id, issues);
  }
  return map;
}

function indexVocabulary(data: any): Map<number, Issue[]> {
  const map = new Map<number, Issue[]>();
  if (!data?.flaggedSentences) return map;

  for (const s of data.flaggedSentences) {
    const issues = map.get(s.id) || [];
    issues.push({
      tool: "vocabulary",
      priority: s.priority || "medium",
      instruction: s.suggestion || `Replace AI vocabulary marker "${s.word}"`,
      contribution: 1,
    });
    map.set(s.id, issues);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Step 2: Compute per-tool budgets
// ---------------------------------------------------------------------------

function computeBudgets(allData: Record<string, any>, prose?: ProseTargets): ToolBudget[] {
  const budgets: ToolBudget[] = [];
  const writerTargets = getWriterTargets(prose);

  // Auxiliary verbs
  const aux = allData.auxiliary;
  if (aux?.metrics) {
    const m = aux.metrics;
    const target =
      writerTargets.auxiliaryDensity?.target ?? m.targetDensity ?? 3.0;
    const current = m.auxiliaryDensity ?? 0;
    const totalWords = m.totalWords ?? 0;
    const excessPct = current - target;
    const excess =
      excessPct > 0 ? Math.ceil((excessPct / 100) * totalWords) : 0;
    budgets.push({
      tool: "auxiliary",
      metric: "auxiliaryDensity",
      current,
      target,
      unit: "%",
      excess,
      needsFix: excess > 0,
    });
  }

  // Pronouns
  const pro = allData.pronoun;
  if (pro?.metrics) {
    const m = pro.metrics;
    const target =
      writerTargets.pronounDensity?.target ?? m.targetDensity ?? 5.0;
    const current = m.pronounDensity ?? 0;
    const totalWords = m.totalWords ?? 0;
    const excessPct = current - target;
    const excess =
      excessPct > 0 ? Math.ceil((excessPct / 100) * totalWords) : 0;
    budgets.push({
      tool: "pronoun",
      metric: "pronounDensity",
      current,
      target,
      unit: "%",
      excess,
      needsFix: excess > 0,
    });
  }

  // Punctuation (em-dash density)
  const punc = allData.punctuation;
  if (punc?.metrics) {
    const m = punc.metrics;
    const target = prose?.em_dash_density ?? DEFAULT_PROSE_TARGETS.em_dash_density;
    const current = m.emDashDensity ?? 0;
    // "excess" = density reduction needed, converted to count
    const totalWords = m.wordCount ?? 0;
    if (current > target) {
      const excessCount = Math.ceil(
        ((current - target) / 1000) * totalWords,
      );
      budgets.push({
        tool: "punctuation",
        metric: "emDashDensity",
        current,
        target,
        unit: "/1k",
        excess: excessCount,
        needsFix: excessCount > 0,
      });
    } else if (punc.issues && punc.issues.length > 0) {
      // Stacking or low density — still a fix needed but no "excess" budget
      budgets.push({
        tool: "punctuation",
        metric: "emDashDensity",
        current,
        target,
        unit: "/1k",
        excess: punc.issues.reduce(
          (sum: number, i: any) => sum + (i.sentences?.length || 0),
          0,
        ),
        needsFix: true,
      });
    } else if (current < target) {
      // Below target but above MIN — informational row for visibility
      budgets.push({
        tool: "punctuation",
        metric: "emDashDensity",
        current,
        target,
        unit: "/1k",
        excess: 0,
        needsFix: false,
      });
    }
  }

  // Structure — budget = number of flagged sentences (after filtering)
  // Note: indexStructure already filters out short sentences, so this count
  // reflects only actionable structure flags.
  const struct = allData.structure;
  if (struct?.flaggedSentences?.length > 0) {
    // Count only sentences that would survive the short-sentence filter
    const actionableCount = struct.flaggedSentences.filter((s: any) => {
      const wc = s.wordCount ?? (s.text ? s.text.split(/\s+/).filter(Boolean).length : 0);
      return wc > SHORT_SENTENCE_WORD_LIMIT;
    }).length;

    if (actionableCount > 0) {
      budgets.push({
        tool: "structure",
        metric: "structureSignals",
        current: actionableCount,
        target: 0,
        unit: "flags",
        excess: actionableCount,
        needsFix: true,
      });
    }
  }

  // Noun density (inverse — needs to go UP)
  const noun = allData.noun;
  if (noun?.metrics) {
    const m = noun.metrics;
    const target =
      writerTargets.nounDensity?.target ?? m.targetDensity ?? 20.0;
    const current = m.nounDensity ?? 0;
    // Noun density is inverse: needs to be ABOVE target
    if (current < target && noun.flaggedSentences?.length > 0) {
      budgets.push({
        tool: "noun",
        metric: "nounDensity",
        current,
        target,
        unit: "%",
        excess: noun.flaggedSentences.length,
        needsFix: true,
      });
    }
  }

  // Vocabulary
  const vocab = allData.vocabulary;
  if (vocab?.flaggedSentences?.length > 0) {
    budgets.push({
      tool: "vocabulary",
      metric: "aiVocabDensity",
      current: vocab.metrics?.aiVocabDensity ?? 0,
      target: 0,
      unit: "/1k",
      excess: vocab.flaggedSentences.length,
      needsFix: true,
    });
  }

  return budgets;
}

// ---------------------------------------------------------------------------
// Step 3: Greedy set-cover selection
// ---------------------------------------------------------------------------

function greedySelect(
  issueMap: Map<number, Issue[]>,
  budgets: ToolBudget[],
  allData: Record<string, any>,
): FixPlanEntry[] {
  // Only keep budgets that need fixing
  const activeBudgets = budgets.filter((b) => b.needsFix);
  if (activeBudgets.length === 0) return [];

  const remainingBudgets = new Map<ToolName, number>();
  for (const b of activeBudgets) {
    remainingBudgets.set(b.tool, b.excess);
  }

  // Sort sentences by: (1) number of distinct tools flagging them, (2) sum of priority scores
  const sentenceEntries = [...issueMap.entries()].map(([id, issues]) => {
    const distinctTools = new Set(issues.map((i) => i.tool)).size;
    const prioritySum = issues.reduce(
      (sum, i) => sum + PRIORITY_SCORE[i.priority],
      0,
    );
    return { id, issues, distinctTools, prioritySum };
  });

  sentenceEntries.sort((a, b) => {
    if (b.distinctTools !== a.distinctTools)
      return b.distinctTools - a.distinctTools;
    return b.prioritySum - a.prioritySum;
  });

  const selected: FixPlanEntry[] = [];

  for (const entry of sentenceEntries) {
    // Check if any issue contributes to a remaining budget > 0
    const hasContribution = entry.issues.some((issue) => {
      const remaining = remainingBudgets.get(issue.tool);
      return remaining !== undefined && remaining > 0;
    });
    if (!hasContribution) continue;

    const { text, paragraphIndex } = getSentenceInfo(entry.id, allData);
    if (!text) continue; // Skip sentences with no recoverable text

    // Deduplicate constraints by tool (keep highest priority per tool)
    const byTool = new Map<string, Issue>();
    for (const issue of entry.issues) {
      const existing = byTool.get(issue.tool);
      if (
        !existing ||
        PRIORITY_SCORE[issue.priority] > PRIORITY_SCORE[existing.priority]
      ) {
        byTool.set(issue.tool, issue);
      }
    }

    const constraints: Constraint[] = [...byTool.values()]
      .sort(
        (a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority],
      )
      .map((issue) => ({
        tool: issue.tool,
        priority: issue.priority,
        instruction: issue.instruction,
      }));

    selected.push({
      id: entry.id,
      text,
      paragraphIndex,
      issueCount: constraints.length,
      constraints,
    });

    // Deduct contributions from budgets
    for (const issue of entry.issues) {
      const remaining = remainingBudgets.get(issue.tool);
      if (remaining !== undefined) {
        remainingBudgets.set(issue.tool, remaining - issue.contribution);
      }
    }

    // Check if all budgets are satisfied
    const allSatisfied = [...remainingBudgets.values()].every((v) => v <= 0);
    if (allSatisfied) break;
  }

  return selected;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2);
  let auxPath: string | null = null;
  let pronounPath: string | null = null;
  let punctuationPath: string | null = null;
  let structurePath: string | null = null;
  let nounPath: string | null = null;
  let vocabularyPath: string | null = null;
  let configPath: string | null = null;
  let outFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case "--aux":
        auxPath = next;
        i++;
        break;
      case "--pronoun":
        pronounPath = next;
        i++;
        break;
      case "--punctuation":
        punctuationPath = next;
        i++;
        break;
      case "--structure":
        structurePath = next;
        i++;
        break;
      case "--noun":
        nounPath = next;
        i++;
        break;
      case "--vocabulary":
        vocabularyPath = next;
        i++;
        break;
      case "--config":
        configPath = next;
        i++;
        break;
      case "--out":
        outFile = next;
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`Usage: bun build-fix-plan.ts [options]

Options:
  --aux FILE          Path to auxiliary-analysis.json
  --pronoun FILE      Path to pronoun-analysis.json
  --punctuation FILE  Path to punctuation-analysis.json
  --structure FILE    Path to structure-analysis.json
  --noun FILE         Path to noun-analysis.json
  --vocabulary FILE   Path to vocabulary-analysis.json
  --config FILE       Path to config YAML (for threshold overrides)
  --out FILE          Write output to file instead of stdout
  --help, -h          Show this help message

All input flags are optional. Missing files are silently skipped.`);
        process.exit(0);
    }
  }

  // Resolve config for prose targets
  let prose: ProseTargets | undefined;
  if (configPath) {
    try {
      const resolved = loadConfig(configPath);
      prose = resolved.writing_style?.prose;
    } catch {}
  }
  if (!prose) {
    const envConfig = deserializeConfigFromEnv(process.env.WRITING_CONFIG);
    if (envConfig) {
      prose = envConfig.writing_style?.prose;
    }
  }

  // Load all analysis outputs
  const allData: Record<string, any> = {
    auxiliary: readJsonSafe(auxPath),
    pronoun: readJsonSafe(pronounPath),
    punctuation: readJsonSafe(punctuationPath),
    structure: readJsonSafe(structurePath),
    noun: readJsonSafe(nounPath),
    vocabulary: readJsonSafe(vocabularyPath),
  };

  // Step 1: Index issues by sentence ID
  const issueMap = new Map<number, Issue[]>();

  const mergeInto = (source: Map<number, Issue[]>) => {
    for (const [id, issues] of source) {
      const existing = issueMap.get(id) || [];
      existing.push(...issues);
      issueMap.set(id, existing);
    }
  };

  mergeInto(indexAuxiliary(allData.auxiliary));
  mergeInto(indexPronoun(allData.pronoun));
  mergeInto(indexPunctuation(allData.punctuation));
  mergeInto(indexStructure(allData.structure));
  mergeInto(indexNoun(allData.noun));
  mergeInto(indexVocabulary(allData.vocabulary));

  // Step 2: Compute budgets
  const budgets = computeBudgets(allData, prose);

  // Step 3: Greedy selection
  const sentences = greedySelect(issueMap, budgets, allData);

  // Step 4: Output
  const fixPlan: FixPlan = {
    summary: {
      totalSentencesToFix: sentences.length,
      budgets,
    },
    sentences,
  };

  const output = JSON.stringify(fixPlan, null, 2);

  if (outFile) {
    await Bun.write(outFile, output);
    console.error(`Fix plan written to: ${outFile}`);
  } else {
    console.log(output);
  }
}

export {
  type FixPlan,
  type FixPlanEntry,
  type ToolBudget,
  type Constraint,
  type Issue,
  type ToolName,
};
