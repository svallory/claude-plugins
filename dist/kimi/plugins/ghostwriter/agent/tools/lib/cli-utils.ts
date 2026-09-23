#!/usr/bin/env bun
/**
 * cli-utils.ts
 *
 * Shared CLI utilities for detection and humanization tools.
 * Provides consistent argument parsing, file input handling, and output handling.
 */

import { existsSync } from 'fs';
import type { ResolvedWritingConfig } from '../config/schemas';
import {
  resolveConfig,
  serializeConfigForEnv,
  loadConfig,
} from './context-resolver';

/**
 * Parsed command line arguments.
 *
 * @property text - The input text to process
 * @property outFile - Optional output file path for results
 * @property config - Resolved detection configuration
 * @property configPath - Path to the YAML config file if provided
 * @property extraArgs - Extra arguments parsed from command line
 */
export interface CLIArgs {
  text: string;
  outFile: string | null;
  config: ResolvedWritingConfig;
  configPath: string | null;
  extraArgs: Record<string, string>;
}

/**
 * Parse command line arguments and extract text input.
 * Supports:
 *   - Direct text as argument
 *   - File path (reads markdown file)
 *   - Stdin input
 *   - --out FILE_PATH for output
 *   - --config FILE_PATH for YAML config file
 *   - --preset NAME for applying a single preset (repeatable)
 *   - --presets NAME,NAME for applying multiple presets (comma-separated)
 *   - Flag arguments (--flag) and value arguments (--arg value)
 *
 * @param argv - Process arguments (usually Bun.argv or process.argv)
 * @param extraArgDefs - Additional arguments to parse (e.g., ["--target-cv", "--detect"])
 *                       Flags without values should be listed, they'll be set to "true"
 */
export async function parseArgs(
  argv: string[] = process.argv,
  extraArgDefs: string[] = [],
): Promise<CLIArgs> {
  const args = argv.slice(2);

  // Handle --help before anything else
  if (args.includes('--help') || args.includes('-h')) {
    throw new Error('__HELP__');
  }

  let text: string | null = null;
  let outFile: string | null = null;
  let configPath: string | null = null;
  const cliPresets: string[] = [];
  const extraArgs: Record<string, string> = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;

    const nextArg = args[i + 1];

    if (arg === '--out' && nextArg && !nextArg.startsWith('--')) {
      outFile = nextArg;
      i++; // Skip next arg
      continue;
    }

    if (arg === '--config' && nextArg && !nextArg.startsWith('--')) {
      configPath = nextArg;
      i++; // Skip next arg
      continue;
    }

    if ((arg === '--preset' || arg === '--presets') && nextArg && !nextArg.startsWith('--')) {
      for (const p of nextArg.split(',')) {
        const trimmed = p.trim();
        if (trimmed) cliPresets.push(trimmed);
      }
      i++; // Skip next arg
      continue;
    }

    // Check for extra arguments
    let isExtraArg = false;
    for (const extraDef of extraArgDefs) {
      if (arg === extraDef) {
        // Check if next arg exists, is not a flag, and is not a file path
        // File paths (.md, .txt) should be treated as text input, not flag values
        const isNextArgFileOrFlag =
          nextArg &&
          (nextArg.startsWith('--') ||
            nextArg.endsWith('.md') ||
            nextArg.endsWith('.txt') ||
            existsSync(nextArg));
        if (nextArg && !isNextArgFileOrFlag) {
          extraArgs[extraDef] = nextArg;
          i++;
        } else {
          // It's a flag without value
          extraArgs[extraDef] = 'true';
        }
        isExtraArg = true;
        break;
      }
    }
    if (isExtraArg) continue;

    // If not a flag, treat as text or file path
    if (!arg.startsWith('--') && text === null) {
      // Check if it's a file path
      if (existsSync(arg) && /\.(md|mdx|txt|markdown|rst|adoc|tex)$/i.test(arg)) {
        text = await Bun.file(arg).text();
      } else {
        text = arg;
      }
    }
  }

  // If no text from args, try stdin
  if (text === null) {
    if (!process.stdin.isTTY) {
      text = await Bun.stdin.text();
    }
  }

  if (!text || !text.trim()) {
    throw new Error(
      'No text provided. Pass text as argument, file path, or via stdin.',
    );
  }

  // Resolve config: --config/--preset > WRITING_CONFIG env var > defaults
  let config: ResolvedWritingConfig;
  if (configPath || cliPresets.length > 0) {
    config = loadConfig(configPath, {}, cliPresets.length > 0 ? cliPresets : undefined);
  } else {
    // Check env var (set by parent heuristics runner or other orchestrators)
    const envConfig = process.env.WRITING_CONFIG;
    if (envConfig) {
      try {
        config = JSON.parse(envConfig) as ResolvedWritingConfig;
      } catch {
        config = resolveConfig(null);
      }
    } else {
      config = resolveConfig(null);
    }
  }

  // Set environment variable for child processes
  process.env.WRITING_CONFIG = serializeConfigForEnv(config);

  return {
    text: text.trim(),
    outFile,
    config,
    configPath,
    extraArgs,
  };
}

/**
 * Output result to stdout or file based on --out argument.
 *
 * @param result - The result object to output (will be JSON stringified)
 * @param outFile - Optional output file path
 * @param extractText - If true and result has 'transformed' field, output only that text
 */
export async function outputResult(
  result: unknown,
  outFile: string | null,
  extractText: boolean = false,
): Promise<void> {
  let output: string;

  if (
    extractText &&
    typeof result === 'object' &&
    result !== null &&
    'transformed' in result
  ) {
    output = (result as { transformed: string }).transformed;
  } else {
    output = JSON.stringify(result, null, 2);
  }

  if (outFile) {
    await Bun.write(outFile, output);
    console.error(`Output written to: ${outFile}`);
  } else {
    console.log(output);
  }
}

/**
 * Print usage information and exit.
 *
 * @param toolName - Name of the tool for usage message
 * @param extraUsage - Additional usage info for extra arguments
 */
export function printUsage(toolName: string, extraUsage: string = '', exitCode: number = 1): never {
  const out = exitCode === 0 ? console.log : console.error;
  out(
    `Usage: bun ${toolName} <text|file.md> [--config config.yml] [--presets a,b] [--out output.json]${extraUsage}`,
  );
  out(
    `       echo "text" | bun ${toolName} [--config config.yml] [--out output.json]${extraUsage}`,
  );
  out(`\nConfig options:`);
  out(`  --config <file.yaml>   Load full config from YAML file`);
  out(`  --preset <name>        Apply a preset (repeatable)`);
  out(`  --presets <a,b,c>      Apply multiple presets (comma-separated)`);
  out(
    `\nAvailable presets: blog, book, technical-book, technical-docs, academic, casual, student, business`,
  );
  process.exit(exitCode);
}

/**
 * Main wrapper that handles common CLI patterns.
 *
 * @param toolName - Name of the tool
 * @param processor - Function that processes text and returns result
 * @param options - Additional options
 */
export async function runCLI<T>(
  toolName: string,
  processor: (
    text: string,
    extraArgs: Record<string, string>,
    config: ResolvedWritingConfig,
  ) => T | Promise<T>,
  options: {
    extraArgDefs?: string[];
    extraUsage?: string;
    extractText?: boolean;
  } = {},
): Promise<void> {
  try {
    const { text, outFile, extraArgs, config } = await parseArgs(
      process.argv,
      options.extraArgDefs || [],
    );
    const result = await processor(text, extraArgs, config);
    await outputResult(result, outFile, options.extractText);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === '__HELP__') {
      printUsage(toolName, options.extraUsage || '', 0);
    }
    if (error.message.includes('No text provided')) {
      printUsage(toolName, options.extraUsage || '');
    }
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Legacy runCLI for tools that don't need config yet.
 * Wraps the processor to ignore config parameter.
 */
export async function runCLILegacy<T>(
  toolName: string,
  processor: (
    text: string,
    extraArgs: Record<string, string>,
  ) => T | Promise<T>,
  options: {
    extraArgDefs?: string[];
    extraUsage?: string;
    extractText?: boolean;
  } = {},
): Promise<void> {
  return runCLI(
    toolName,
    (text, extraArgs, _config) => processor(text, extraArgs),
    options,
  );
}

// Re-export types for convenience
export type { ResolvedWritingConfig };
