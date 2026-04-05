#!/usr/bin/env bun
/**
 * mechanical-cleanup.ts
 *
 * Deterministic, rule-based text cleanup that modifies a markdown file in-place.
 * Applies safe mechanical fixes (em-dash spacing, doubled words, whitespace)
 * and optionally uses LanguageTool for typos/typography corrections.
 *
 * Usage:
 *   bun agent/tools/writer/mechanical-cleanup.ts <file.md> [options]
 *     --config <file.yaml>     Config file (checks disabled rules)
 *     --out <report.json>      Write change report (default: stdout)
 *     --no-languagetool        Skip LanguageTool
 *     --dry-run                Report without modifying file
 */

import { readFileSync, existsSync } from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CleanupChange {
  rule: string;
  line: number;
  before: string;
  after: string;
  context: string;
}

interface CleanupResult {
  text: string;
  changes: CleanupChange[];
}

interface CleanupRule {
  name: string;
  apply: (text: string, protectedRanges: Range[]) => CleanupResult;
}

interface Range {
  start: number;
  end: number;
}

interface CleanupReport {
  file: string;
  modified: boolean;
  totalChanges: number;
  changesByRule: Record<string, number>;
  changes: CleanupChange[];
  languageTool: {
    available: boolean;
    url: string | null;
    appliedCount: number;
    skippedCount: number;
    errors: string[];
  };
}

interface RuleConfig {
  disabled?: boolean;
  [key: string]: unknown;
}

interface ParsedConfig {
  rules?: {
    punctuation?: {
      em_dash?: RuleConfig;
      [key: string]: RuleConfig | undefined;
    };
    [key: string]: Record<string, RuleConfig | undefined> | undefined;
  };
}

// ---------------------------------------------------------------------------
// Protected ranges: code blocks, inline code, YAML frontmatter
// ---------------------------------------------------------------------------

function findProtectedRanges(text: string): Range[] {
  const ranges: Range[] = [];

  // YAML frontmatter (must start at beginning of file)
  if (text.startsWith("---")) {
    const endMatch = text.indexOf("\n---", 3);
    if (endMatch !== -1) {
      ranges.push({ start: 0, end: endMatch + 4 });
    }
  }

  // Fenced code blocks (``` or ~~~)
  const fencedCodeRegex = /^(```|~~~)[^\n]*\n[\s\S]*?^(\1)/gm;
  let match;
  while ((match = fencedCodeRegex.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Inline code (backticks) — single or double
  const inlineCodeRegex = /(`{1,2})(?!\s)([^`\n]+?)(?<!\s)\1/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  return ranges.sort((a, b) => a.start - b.start);
}

function isProtected(offset: number, ranges: Range[]): boolean {
  for (const r of ranges) {
    if (offset >= r.start && offset < r.end) return true;
    if (r.start > offset) break; // sorted, no need to check further
  }
  return false;
}

/**
 * Get the 1-based line number for a character offset.
 */
function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Get surrounding context for a change.
 */
function contextAround(text: string, offset: number, len: number): string {
  const pad = 30;
  const start = Math.max(0, offset - pad);
  const end = Math.min(text.length, offset + len + pad);
  let ctx = text.slice(start, end).replace(/\n/g, "\\n");
  if (start > 0) ctx = "..." + ctx;
  if (end < text.length) ctx = ctx + "...";
  return ctx;
}

// ---------------------------------------------------------------------------
// Regex-based rules
// ---------------------------------------------------------------------------

/**
 * Build a safe regex replacer that skips protected ranges.
 * For each match, calls `replacer` to get the replacement string.
 * Collects changes and returns modified text.
 */
function regexReplace(
  text: string,
  regex: RegExp,
  ruleName: string,
  protectedRanges: Range[],
  replacer: (match: RegExpMatchArray) => string | null,
): CleanupResult {
  const changes: CleanupChange[] = [];
  let result = "";
  let lastIndex = 0;

  // Reset regex state
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (isProtected(m.index, protectedRanges)) continue;

    const replacement = replacer(m);
    if (replacement === null || replacement === m[0]) continue;

    changes.push({
      rule: ruleName,
      line: lineAt(text, m.index),
      before: m[0],
      after: replacement,
      context: contextAround(text, m.index, m[0].length),
    });

    result += text.slice(lastIndex, m.index) + replacement;
    lastIndex = m.index + m[0].length;
  }

  result += text.slice(lastIndex);
  return { text: result, changes };
}

const EM_DASH = "\u2014";

function makeEmDashSpacingRule(): CleanupRule {
  return {
    name: "em_dash_spacing",
    apply(text: string, protectedRanges: Range[]): CleanupResult {
      const allChanges: CleanupChange[] = [];
      let current = text;

      // Pass 1: word—word → word — word (no spaces on either side)
      {
        const r = regexReplace(
          current,
          /(\S)\u2014(\S)/g,
          "em_dash_spacing",
          protectedRanges,
          (m) => `${m[1]} ${EM_DASH} ${m[2]}`,
        );
        current = r.text;
        allChanges.push(...r.changes);
      }

      // Pass 2: word— (space or end) → word —
      {
        const r = regexReplace(
          current,
          /(\S)\u2014(\s)/g,
          "em_dash_spacing",
          protectedRanges,
          (m) => `${m[1]} ${EM_DASH}${m[2]}`,
        );
        current = r.text;
        allChanges.push(...r.changes);
      }

      // Pass 3: (space)—word → (space)— word
      {
        const r = regexReplace(
          current,
          /(\s)\u2014(\S)/g,
          "em_dash_spacing",
          protectedRanges,
          (m) => `${m[1]}${EM_DASH} ${m[2]}`,
        );
        current = r.text;
        allChanges.push(...r.changes);
      }

      // Pass 4: normalize excess spaces around em-dashes: "  — " or " —  " → " — "
      {
        const r = regexReplace(
          current,
          / {2,}\u2014 {1,}| {1,}\u2014 {2,}/g,
          "em_dash_spacing",
          protectedRanges,
          () => ` ${EM_DASH} `,
        );
        current = r.text;
        allChanges.push(...r.changes);
      }

      return { text: current, changes: allChanges };
    },
  };
}

function makeDoubleHyphenRule(): CleanupRule {
  return {
    name: "double_hyphen_to_em_dash",
    apply(text: string, protectedRanges: Range[]): CleanupResult {
      // " -- " → " — "
      return regexReplace(
        text,
        /(\s)--(\s)/g,
        "double_hyphen_to_em_dash",
        protectedRanges,
        (m) => `${m[1]}${EM_DASH}${m[2]}`,
      );
    },
  };
}

function makeDoubledWordsRule(): CleanupRule {
  return {
    name: "doubled_words",
    apply(text: string, protectedRanges: Range[]): CleanupResult {
      // Match "the the", "a a", "is is", etc. Case-insensitive, word boundary.
      // Only match common small words to avoid false positives on intentional repetition.
      return regexReplace(
        text,
        /\b(a|an|and|as|at|be|but|by|do|for|from|had|has|have|he|her|him|his|I|if|in|into|is|it|its|my|no|not|of|on|or|our|own|she|so|than|that|the|their|them|then|there|these|they|this|to|up|us|was|we|were|what|when|which|who|will|with|would|you|your)\s+\1\b/gi,
        "doubled_words",
        protectedRanges,
        (m) => m[1],
      );
    },
  };
}

function makeTrailingWhitespaceRule(): CleanupRule {
  return {
    name: "trailing_whitespace",
    apply(text: string, protectedRanges: Range[]): CleanupResult {
      // Process line by line, but track offsets for protected range checks
      const lines = text.split("\n");
      const changes: CleanupChange[] = [];
      let offset = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.replace(/[ \t]+$/, "");
        if (trimmed !== line && !isProtected(offset, protectedRanges)) {
          changes.push({
            rule: "trailing_whitespace",
            line: i + 1,
            before: JSON.stringify(line.slice(trimmed.length)),
            after: '""',
            context: line.trimEnd(),
          });
          lines[i] = trimmed;
        }
        offset += line.length + 1; // +1 for the \n
      }

      return { text: lines.join("\n"), changes };
    },
  };
}

function makeMultipleBlankLinesRule(): CleanupRule {
  return {
    name: "multiple_blank_lines",
    apply(text: string, protectedRanges: Range[]): CleanupResult {
      // 3+ consecutive blank lines → 2 blank lines
      return regexReplace(
        text,
        /\n{4,}/g,
        "multiple_blank_lines",
        protectedRanges,
        () => "\n\n\n", // 3 newlines = 2 blank lines between paragraphs
      );
    },
  };
}

// ---------------------------------------------------------------------------
// LanguageTool integration
// ---------------------------------------------------------------------------

const LT_LOCAL_URL = "http://localhost:8081/v2/check";
const LT_PUBLIC_URL = "https://api.languagetoolplus.com/v2/check";

const SAFE_LT_CATEGORIES = new Set([
  "TYPOS",
  "TYPOGRAPHY",
  "PUNCTUATION",
  "CASING",
  "COMPOUNDING",
  "WHITESPACE",
  "REDUNDANCY",
]);

interface LTMatch {
  offset: number;
  length: number;
  message: string;
  rule: { id: string; category: { id: string } };
  replacements: { value: string }[];
  context: { text: string; offset: number; length: number };
}

interface LTResponse {
  matches: LTMatch[];
}

async function tryLanguageTool(
  text: string,
  protectedRanges: Range[],
): Promise<{
  available: boolean;
  url: string | null;
  changes: CleanupChange[];
  skippedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let ltUrl: string | null = null;
  let response: Response | null = null;

  // Try local first
  for (const url of [LT_LOCAL_URL, LT_PUBLIC_URL]) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ text, language: "en-US" }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        ltUrl = url;
        break;
      }
      response = null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${url}: ${msg}`);
      response = null;
    }
  }

  if (!response || !ltUrl) {
    return { available: false, url: null, changes: [], skippedCount: 0, errors };
  }

  let data: LTResponse;
  try {
    data = (await response.json()) as LTResponse;
  } catch {
    errors.push("Failed to parse LanguageTool response");
    return { available: true, url: ltUrl, changes: [], skippedCount: 0, errors };
  }

  const changes: CleanupChange[] = [];
  let skippedCount = 0;

  // Filter to safe categories and sort by offset descending (apply from end backward)
  const safeMatches = data.matches.filter((m) => {
    if (!SAFE_LT_CATEGORIES.has(m.rule.category.id)) {
      skippedCount++;
      return false;
    }
    if (m.replacements.length === 0) {
      skippedCount++;
      return false;
    }
    if (isProtected(m.offset, protectedRanges)) {
      skippedCount++;
      return false;
    }
    return true;
  });

  // Sort descending so we can apply from end without offset shift
  safeMatches.sort((a, b) => b.offset - a.offset);

  for (const m of safeMatches) {
    const original = text.slice(m.offset, m.offset + m.length);
    const replacement = m.replacements[0].value;

    if (original === replacement) continue;

    changes.push({
      rule: `languagetool:${m.rule.category.id}`,
      line: lineAt(text, m.offset),
      before: original,
      after: replacement,
      context: contextAround(text, m.offset, m.length),
    });
  }

  return { available: true, url: ltUrl, changes, skippedCount, errors };
}

function applyLTChanges(text: string, changes: CleanupChange[]): string {
  // Changes are already sorted descending by position (from tryLanguageTool).
  // We need to find each "before" string at its approximate location and replace.
  // Since we sorted descending, offsets stay valid.
  let result = text;
  for (const change of changes) {
    // Find the exact location by searching near the reported line
    const idx = findChangeOffset(result, change);
    if (idx === -1) continue;
    result = result.slice(0, idx) + change.after + result.slice(idx + change.before.length);
  }
  return result;
}

function findChangeOffset(text: string, change: CleanupChange): number {
  // Convert line number to approximate offset, then search nearby
  let offset = 0;
  let currentLine = 1;
  while (currentLine < change.line && offset < text.length) {
    if (text[offset] === "\n") currentLine++;
    offset++;
  }

  // Search within a window around the expected location
  const searchStart = Math.max(0, offset - 200);
  const searchEnd = Math.min(text.length, offset + 500);
  const window = text.slice(searchStart, searchEnd);
  const idx = window.indexOf(change.before);
  if (idx === -1) return -1;
  return searchStart + idx;
}

// ---------------------------------------------------------------------------
// Config loading (lightweight — only needs rules.punctuation.em_dash.disabled)
// ---------------------------------------------------------------------------

function loadConfig(configPath: string): ParsedConfig {
  if (!existsSync(configPath)) {
    console.error(`Warning: config file not found: ${configPath}`);
    return {};
  }

  // Minimal YAML parsing: we only need rules.punctuation.em_dash.disabled
  // Use the project's config-loader if available, otherwise parse manually
  try {
    // Try dynamic import of config-loader
    const { loadConfigFromFile } = require("../lib/config-loader");
    const config = loadConfigFromFile(configPath);
    return config as ParsedConfig;
  } catch {
    // Fall back to simple YAML key scanning
    const content = readFileSync(configPath, "utf-8");
    return parseSimpleYaml(content);
  }
}

function parseSimpleYaml(content: string): ParsedConfig {
  // Very simple parser — just looks for disabled: true under em_dash
  const config: ParsedConfig = { rules: { punctuation: {} } };
  const lines = content.split("\n");
  let inPunctuation = false;
  let inEmDash = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (trimmed.startsWith("punctuation:") && indent <= 4) {
      inPunctuation = true;
      inEmDash = false;
      continue;
    }
    if (inPunctuation && trimmed.startsWith("em_dash:")) {
      inEmDash = true;
      continue;
    }
    if (inEmDash && trimmed.startsWith("disabled:")) {
      const val = trimmed.split(":")[1]?.trim();
      if (val === "true") {
        config.rules!.punctuation!.em_dash = { disabled: true };
      }
      inEmDash = false;
      continue;
    }
    // Reset context on de-indent
    if (indent <= 4 && !trimmed.startsWith("#") && trimmed.length > 0) {
      if (!trimmed.startsWith("em_dash:") && !trimmed.startsWith("period_quote:") &&
          !trimmed.startsWith("oxford_comma:") && !trimmed.startsWith("semicolon") &&
          !trimmed.startsWith("parenthesis")) {
        inPunctuation = false;
      }
      inEmDash = false;
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function runCleanup(opts: {
  filePath: string;
  configPath?: string;
  outPath?: string;
  noLanguageTool: boolean;
  dryRun: boolean;
}): Promise<CleanupReport> {
  const { filePath, configPath, outPath, noLanguageTool, dryRun } = opts;

  if (!existsSync(filePath)) {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(1);
  }

  const originalText = readFileSync(filePath, "utf-8");
  const protectedRanges = findProtectedRanges(originalText);

  // Load config to check disabled rules
  const config = configPath ? loadConfig(configPath) : ({} as ParsedConfig);
  const emDashDisabled = config.rules?.punctuation?.em_dash?.disabled === true;

  // Build rule list
  const rules: CleanupRule[] = [];

  if (!emDashDisabled) {
    rules.push(makeEmDashSpacingRule());
    rules.push(makeDoubleHyphenRule());
  }
  rules.push(makeDoubledWordsRule());
  rules.push(makeTrailingWhitespaceRule());
  rules.push(makeMultipleBlankLinesRule());

  // Apply regex rules in order
  let currentText = originalText;
  const allChanges: CleanupChange[] = [];

  for (const rule of rules) {
    // Recompute protected ranges after each rule (text may have shifted)
    const ranges = findProtectedRanges(currentText);
    const result = rule.apply(currentText, ranges);
    currentText = result.text;
    allChanges.push(...result.changes);
  }

  // LanguageTool
  let ltResult = {
    available: false,
    url: null as string | null,
    changes: [] as CleanupChange[],
    skippedCount: 0,
    errors: [] as string[],
  };

  if (!noLanguageTool) {
    const ranges = findProtectedRanges(currentText);
    ltResult = await tryLanguageTool(currentText, ranges);

    if (ltResult.changes.length > 0) {
      currentText = applyLTChanges(currentText, ltResult.changes);
      allChanges.push(...ltResult.changes);
    }

    if (!ltResult.available && ltResult.errors.length > 0) {
      console.error(`Warning: LanguageTool unavailable (${ltResult.errors[0]}). Continuing with regex rules only.`);
    }
  }

  // Write file if not dry-run and there are changes
  const modified = currentText !== originalText;
  if (modified && !dryRun) {
    await Bun.write(filePath, currentText);
  }

  // Build change counts by rule
  const changesByRule: Record<string, number> = {};
  for (const c of allChanges) {
    changesByRule[c.rule] = (changesByRule[c.rule] || 0) + 1;
  }

  const report: CleanupReport = {
    file: filePath,
    modified: modified && !dryRun,
    totalChanges: allChanges.length,
    changesByRule,
    changes: allChanges,
    languageTool: {
      available: ltResult.available,
      url: ltResult.url,
      appliedCount: ltResult.changes.length,
      skippedCount: ltResult.skippedCount,
      errors: ltResult.errors,
    },
  };

  return report;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    let filePath: string | null = null;
    let configPath: string | undefined;
    let outPath: string | undefined;
    let noLanguageTool = false;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--config" && args[i + 1]) {
        configPath = args[++i];
      } else if (arg === "--out" && args[i + 1]) {
        outPath = args[++i];
      } else if (arg === "--no-languagetool") {
        noLanguageTool = true;
      } else if (arg === "--dry-run") {
        dryRun = true;
      } else if (arg && !arg.startsWith("--") && filePath === null) {
        filePath = arg;
      }
    }

    if (!filePath) {
      console.error(
        "Usage: bun mechanical-cleanup.ts <file.md> [--config <file.yaml>] [--out <report.json>] [--no-languagetool] [--dry-run]",
      );
      process.exit(1);
    }

    const report = await runCleanup({
      filePath,
      configPath,
      outPath,
      noLanguageTool,
      dryRun,
    });

    const output = JSON.stringify(report, null, 2);

    if (outPath) {
      await Bun.write(outPath, output);
      console.error(`Report written to: ${outPath}`);
    } else {
      console.log(output);
    }

    if (report.modified) {
      console.error(`Applied ${report.totalChanges} changes to ${filePath}`);
    } else if (dryRun && report.totalChanges > 0) {
      console.error(`Dry run: ${report.totalChanges} changes would be applied to ${filePath}`);
    } else {
      console.error("No changes needed.");
    }
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

export { runCleanup, findProtectedRanges, type CleanupReport, type CleanupChange };
