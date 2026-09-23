/**
 * config-loader.ts
 *
 * Loads writing configuration from YAML files, resolves preset chains,
 * and returns fully resolved configurations.
 *
 * YAML files use snake_case, TypeScript interfaces use snake_case.
 * No case conversion needed since we standardized on snake_case throughout.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname, isAbsolute } from "path";
import type {
  WritingConfig,
  ResolvedWritingConfig,
  PartialWritingConfig,
  RuleConfigs,
  Publication,
  WritingStyle,
  AuthorProfile,
  MediaType,
  AudienceLevel,
  LengthCategory,
  Platform,
  EditorialLevel,
  Era,
  WritingTone,
  FormalityLevel,
  NarrativeVoice,
  PrimaryTense,
} from "../config/schemas";
import { isMediaType, MEDIA_TYPES } from "../config/schemas";
import { DEFAULT_RULES } from "../config/presets/defaults";

// ============================================
// Validation Constants
// ============================================

const AUDIENCE_LEVELS: AudienceLevel[] = ["general", "expert", "beginner", "mixed"];
const LENGTH_CATEGORIES: LengthCategory[] = ["short_form", "medium_form", "long_form"];
const PLATFORMS: Platform[] = ["self_published", "traditional", "web", "academic_journal", "blog_platform", "social_media"];
const EDITORIAL_LEVELS: EditorialLevel[] = ["unedited", "self_edited", "copy_edited", "professionally_edited", "peer_reviewed"];
const ERAS: Era[] = ["contemporary", "modern", "classic", "historical"];
const WRITING_TONES: WritingTone[] = ["formal", "conversational", "casual", "academic", "technical"];
const FORMALITY_LEVELS: FormalityLevel[] = ["formal", "informal", "mixed"];
const NARRATIVE_VOICES: NarrativeVoice[] = ["first-person", "first-person-plural", "second-person", "third-person"];
const PRIMARY_TENSES: PrimaryTense[] = ["past", "present", "mixed"];

// Rule categories and their valid rule names
const VALID_RULE_NAMES: Record<string, string[]> = {
  punctuation: ["period_quote", "oxford_comma", "em_dash", "semicolon_to_em_dash_ratio", "parenthesis_to_em_dash_ratio"],
  structure: ["paragraph_fano_factor", "bullet_density", "transition_density"],
  vocabulary: ["ai_vocab_density"],
  burstiness: ["coefficient_of_variation", "fano_factor", "length_range"],
  ngram: ["six_gram_repetition_rate", "six_gram_ttr", "ai_pattern_count"],
  content: ["hedging", "cliche", "superlative", "filler"],
  syntactic: ["avg_dependency_depth", "sentence_type_uniformity"],
  perplexity: ["perplexity"],
  detectgpt: ["d_score"],
};

// Valid threshold config keys
const VALID_THRESHOLD_KEYS = ["ai_threshold", "human_baseline", "disabled", "weight", "expected"];

/**
 * Validation error with path information.
 */
export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Parse YAML content into a JavaScript object.
 * We avoid external dependencies - the YAML format we use is simple enough.
 *
 * @param content - The YAML content to parse
 * @returns Parsed object
 * @throws Error if parsing fails
 */
function parseYaml(content: string): Record<string, unknown> {
  try {
    return parseSimpleYaml(content);
  } catch (e) {
    throw new Error(`Failed to parse YAML: ${e}`);
  }
}

/**
 * Simple YAML parser for our specific format.
 * Handles nested objects, arrays, and primitive values.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const lines = content.split("\n");
  const result: Record<string, unknown> = {};
  const stack: { obj: Record<string, unknown>; indent: number; key?: string }[] = [
    { obj: result, indent: -2 },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    // Calculate indentation
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle array items
    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();

      // Pop stack until we find the right parent (array parent level)
      while (stack.length > 1) {
        const lastItem = stack[stack.length - 1];
        if (!lastItem || lastItem.indent < indent) break;
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      if (!parent) continue;

      const parentObj = parent.obj;
      const arrayKey = parent.key;

      if (arrayKey) {
        if (!Array.isArray(parentObj[arrayKey])) {
          parentObj[arrayKey] = [];
        }
        (parentObj[arrayKey] as unknown[]).push(parseValue(value));
      }
      continue;
    }

    // Handle key: value pairs
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();

    // Pop stack until we find the right parent
    while (stack.length > 1) {
      const lastItem = stack[stack.length - 1];
      if (!lastItem || lastItem.indent < indent) break;
      stack.pop();
    }

    const currentEntry = stack[stack.length - 1];
    if (!currentEntry) continue;

    const current = currentEntry.obj;

    if (valueStr === "" || valueStr === "|" || valueStr === ">") {
      // Check if next line is an array item
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine?.trim();
      if (nextTrimmed && nextTrimmed.startsWith("- ")) {
        // This key will hold an array
        current[key] = [];
        stack.push({ obj: current, indent, key });
      } else {
        // Nested object
        const newObj: Record<string, unknown> = {};
        current[key] = newObj;
        stack.push({ obj: newObj, indent });
      }
    } else {
      // Simple value
      current[key] = parseValue(valueStr);
    }
  }

  return result;
}

/**
 * Parse an inline YAML array like [a, b, c] or ["a", "b", "c"].
 *
 * @param value - The inline array string (including brackets)
 * @returns Parsed array
 */
function parseInlineArray(value: string): unknown[] {
  // Remove the outer brackets
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];

  const items: unknown[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let depth = 0;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = "";
      current += char;
    } else if (!inQuotes && char === "[") {
      depth++;
      current += char;
    } else if (!inQuotes && char === "]") {
      depth--;
      current += char;
    } else if (!inQuotes && depth === 0 && char === ",") {
      // End of item
      const trimmed = current.trim();
      if (trimmed) {
        items.push(parseValue(trimmed));
      }
      current = "";
    } else {
      current += char;
    }
  }

  // Don't forget the last item
  const trimmed = current.trim();
  if (trimmed) {
    items.push(parseValue(trimmed));
  }

  return items;
}

/**
 * Parse a YAML value to its JavaScript equivalent.
 * Handles null, booleans, numbers, strings (quoted and unquoted), inline arrays, and inline comments.
 *
 * @param value - The YAML value string to parse
 * @returns The parsed value (null, boolean, number, array, or string)
 */
function parseValue(value: string): unknown {
  // Strip inline comments (but not from quoted strings or arrays)
  let cleanValue = value;
  if (!value.startsWith('"') && !value.startsWith("'") && !value.startsWith("[")) {
    const commentIndex = value.indexOf(" #");
    if (commentIndex > 0) {
      cleanValue = value.slice(0, commentIndex).trim();
    }
  }

  if (cleanValue === "null" || cleanValue === "~") return null;
  if (cleanValue === "true") return true;
  if (cleanValue === "false") return false;

  // Handle inline arrays
  if (cleanValue.startsWith("[") && cleanValue.endsWith("]")) {
    return parseInlineArray(cleanValue);
  }

  if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
    return cleanValue.slice(1, -1);
  }
  if (cleanValue.startsWith("'") && cleanValue.endsWith("'")) {
    return cleanValue.slice(1, -1);
  }
  const num = Number(cleanValue);
  if (!isNaN(num) && cleanValue !== "") return num;
  return cleanValue;
}

/**
 * Built-in preset names that map to files in the presets directory.
 */
const BUILTIN_PRESETS = [
  "blog",
  "book",
  "technical-book",
  "technical-docs",
  "academic",
  "casual",
  "student",
  "business",
] as const;

type BuiltinPreset = (typeof BUILTIN_PRESETS)[number];

/**
 * Check if a preset name is a built-in preset.
 *
 * @param name - The preset name to check
 * @returns True if the preset is a built-in preset
 */
function isBuiltinPreset(name: string): name is BuiltinPreset {
  return BUILTIN_PRESETS.includes(name as BuiltinPreset);
}

/**
 * Get the path to a preset file.
 * Resolves built-in presets, absolute paths, and relative paths.
 *
 * @param preset - The preset name or path
 * @param basePath - Optional base path for resolving relative paths
 * @returns The absolute path to the preset file
 * @throws Error if the preset cannot be found
 */
function getPresetPath(preset: string, basePath?: string): string {
  // Built-in preset
  if (isBuiltinPreset(preset)) {
    const presetsDir = join(__dirname, "../config/presets");
    return join(presetsDir, `${preset}.yaml`);
  }

  // File path (relative or absolute)
  if (preset.endsWith(".yaml") || preset.endsWith(".yml")) {
    if (isAbsolute(preset)) {
      return preset;
    }
    // Relative to base config path or cwd
    const base = basePath ? dirname(basePath) : process.cwd();
    return join(base, preset);
  }

  // Try as built-in preset name with .yaml extension
  const presetsDir = join(__dirname, "../config/presets");
  const withYaml = join(presetsDir, `${preset}.yaml`);
  if (existsSync(withYaml)) {
    return withYaml;
  }

  throw new Error(`Unknown preset: ${preset}`);
}

/**
 * Options for loading a config file.
 */
export interface LoadConfigOptions {
  /** Whether to validate the config (default: true) */
  validate?: boolean;
  /** Whether to throw on validation errors (default: true) */
  throwOnError?: boolean;
  /** Whether to warn on validation warnings (default: false) */
  warnOnWarnings?: boolean;
}

/**
 * Load a YAML config file.
 *
 * @param filePath - The path to the YAML file
 * @param options - Options for loading the config
 * @returns The parsed configuration
 * @throws Error if the file doesn't exist or validation fails
 */
function loadYamlFile(filePath: string, options: LoadConfigOptions = {}): PartialWritingConfig {
  const { validate = true, throwOnError = true, warnOnWarnings = false } = options;

  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const parsed = parseYaml(content);

  if (validate) {
    const result = validateConfig(parsed);

    if (warnOnWarnings && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.warn(`[config warning] ${filePath}: ${warning.path} - ${warning.message}`);
      }
    }

    if (!result.valid && throwOnError) {
      const errorMessages = result.errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n");
      throw new Error(`Config validation failed for ${filePath}:\n${errorMessages}`);
    }
  }

  return parsed as PartialWritingConfig;
}

/**
 * Deep merge two objects. Later values override earlier ones.
 * Arrays are replaced, not merged.
 *
 * @template T - The type of the base object
 * @param base - The base object to merge into
 * @param override - The object with values to override
 * @returns The merged object
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>
): T {
  const result = { ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideValue = override[key as string];

    if (overrideValue === undefined) {
      continue;
    }

    if (
      overrideValue !== null &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue) &&
      base[key] !== null &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      // Override value (including arrays and primitives)
      result[key] = overrideValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Resolve presets recursively and merge into a single config.
 *
 * @param presets - Array of preset names or file paths
 * @param basePath - Base path for resolving relative file paths
 * @param visited - Set of already visited presets (for cycle detection)
 * @returns The merged configuration from all presets
 */
function resolvePresets(
  presets: string[],
  basePath?: string,
  visited: Set<string> = new Set()
): PartialWritingConfig {
  let merged: Record<string, unknown> = {};

  for (const preset of presets) {
    // Check for cycles
    const presetKey = isAbsolute(preset) ? preset : getPresetPath(preset, basePath);
    if (visited.has(presetKey)) {
      throw new Error(`Circular preset dependency detected: ${preset}`);
    }
    visited.add(presetKey);

    // Load the preset
    const presetPath = getPresetPath(preset, basePath);
    const presetConfig = loadYamlFile(presetPath);

    // Recursively resolve nested presets
    if (presetConfig.presets && presetConfig.presets.length > 0) {
      const nestedResolved = resolvePresets(
        presetConfig.presets,
        presetPath,
        new Set(visited)
      );
      merged = deepMerge(merged, nestedResolved as Record<string, unknown>);
    }

    // Merge this preset (excluding the presets array)
    const { presets: _, ...configWithoutPresets } = presetConfig;
    merged = deepMerge(merged, configWithoutPresets as Record<string, unknown>);
  }

  return merged as PartialWritingConfig;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Check if a value is one of the allowed values.
 */
function isOneOf<T>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

/**
 * Validate the publication section of a config.
 */
function validatePublication(
  publication: unknown,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  if (!publication || typeof publication !== "object") {
    return;
  }

  const pub = publication as Record<string, unknown>;

  // media is required
  if (pub.media !== undefined) {
    if (!isMediaType(pub.media as string)) {
      errors.push({
        path: "publication.media",
        message: `Invalid media type. Must be one of: ${MEDIA_TYPES.join(", ")}`,
        value: pub.media,
      });
    }
  }

  // audience
  if (pub.audience !== undefined && !isOneOf(pub.audience, AUDIENCE_LEVELS)) {
    errors.push({
      path: "publication.audience",
      message: `Invalid audience level. Must be one of: ${AUDIENCE_LEVELS.join(", ")}`,
      value: pub.audience,
    });
  }

  // length_category
  if (pub.length_category !== undefined && !isOneOf(pub.length_category, LENGTH_CATEGORIES)) {
    errors.push({
      path: "publication.length_category",
      message: `Invalid length category. Must be one of: ${LENGTH_CATEGORIES.join(", ")}`,
      value: pub.length_category,
    });
  }

  // platform
  if (pub.platform !== undefined && !isOneOf(pub.platform, PLATFORMS)) {
    errors.push({
      path: "publication.platform",
      message: `Invalid platform. Must be one of: ${PLATFORMS.join(", ")}`,
      value: pub.platform,
    });
  }

  // editorial_level
  if (pub.editorial_level !== undefined && !isOneOf(pub.editorial_level, EDITORIAL_LEVELS)) {
    errors.push({
      path: "publication.editorial_level",
      message: `Invalid editorial level. Must be one of: ${EDITORIAL_LEVELS.join(", ")}`,
      value: pub.editorial_level,
    });
  }

  // era (can be string or number)
  if (pub.era !== undefined) {
    if (typeof pub.era === "string" && !isOneOf(pub.era, ERAS)) {
      errors.push({
        path: "publication.era",
        message: `Invalid era. Must be one of: ${ERAS.join(", ")} or a year number`,
        value: pub.era,
      });
    } else if (typeof pub.era === "number" && (pub.era < 1000 || pub.era > 3000)) {
      warnings.push({
        path: "publication.era",
        message: `Era year ${pub.era} seems unusual. Expected a year between 1000 and 3000.`,
        value: pub.era,
      });
    }
  }

  // genres should be an array
  if (pub.genres !== undefined && !Array.isArray(pub.genres)) {
    errors.push({
      path: "publication.genres",
      message: "genres must be an array of strings",
      value: pub.genres,
    });
  }

  // subjects should be an array
  if (pub.subjects !== undefined && !Array.isArray(pub.subjects)) {
    errors.push({
      path: "publication.subjects",
      message: "subjects must be an array of strings",
      value: pub.subjects,
    });
  }

  // is_translation should be boolean
  if (pub.is_translation !== undefined && typeof pub.is_translation !== "boolean") {
    errors.push({
      path: "publication.is_translation",
      message: "is_translation must be a boolean",
      value: pub.is_translation,
    });
  }
}

/**
 * Validate the writing_style section of a config.
 */
function validateWritingStyle(
  style: unknown,
  errors: ValidationError[],
  _warnings: ValidationError[]
): void {
  if (!style || typeof style !== "object") {
    return;
  }

  const s = style as Record<string, unknown>;

  // tone
  if (s.tone !== undefined && !isOneOf(s.tone, WRITING_TONES)) {
    errors.push({
      path: "writing_style.tone",
      message: `Invalid tone. Must be one of: ${WRITING_TONES.join(", ")}`,
      value: s.tone,
    });
  }

  // formality
  if (s.formality !== undefined && !isOneOf(s.formality, FORMALITY_LEVELS)) {
    errors.push({
      path: "writing_style.formality",
      message: `Invalid formality level. Must be one of: ${FORMALITY_LEVELS.join(", ")}`,
      value: s.formality,
    });
  }

  // voice
  if (s.voice !== undefined && !isOneOf(s.voice, NARRATIVE_VOICES)) {
    errors.push({
      path: "writing_style.voice",
      message: `Invalid narrative voice. Must be one of: ${NARRATIVE_VOICES.join(", ")}`,
      value: s.voice,
    });
  }

  // tense
  if (s.tense !== undefined && !isOneOf(s.tense, PRIMARY_TENSES)) {
    errors.push({
      path: "writing_style.tense",
      message: `Invalid tense. Must be one of: ${PRIMARY_TENSES.join(", ")}`,
      value: s.tense,
    });
  }
}

/**
 * Validate a threshold config object.
 */
function validateThresholdConfig(
  config: unknown,
  path: string,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  if (!config || typeof config !== "object") {
    return;
  }

  const cfg = config as Record<string, unknown>;

  for (const key of Object.keys(cfg)) {
    if (!VALID_THRESHOLD_KEYS.includes(key)) {
      warnings.push({
        path: `${path}.${key}`,
        message: `Unknown threshold config key: ${key}. Valid keys are: ${VALID_THRESHOLD_KEYS.join(", ")}`,
        value: cfg[key],
      });
    }
  }

  // ai_threshold should be a number
  if (cfg.ai_threshold !== undefined && typeof cfg.ai_threshold !== "number") {
    errors.push({
      path: `${path}.ai_threshold`,
      message: "ai_threshold must be a number",
      value: cfg.ai_threshold,
    });
  }

  // human_baseline should be a number
  if (cfg.human_baseline !== undefined && typeof cfg.human_baseline !== "number") {
    errors.push({
      path: `${path}.human_baseline`,
      message: "human_baseline must be a number",
      value: cfg.human_baseline,
    });
  }

  // disabled should be a boolean
  if (cfg.disabled !== undefined && typeof cfg.disabled !== "boolean") {
    errors.push({
      path: `${path}.disabled`,
      message: "disabled must be a boolean",
      value: cfg.disabled,
    });
  }

  // weight should be a number between 0 and 1
  if (cfg.weight !== undefined) {
    if (typeof cfg.weight !== "number") {
      errors.push({
        path: `${path}.weight`,
        message: "weight must be a number",
        value: cfg.weight,
      });
    } else if (cfg.weight < 0 || cfg.weight > 1) {
      warnings.push({
        path: `${path}.weight`,
        message: "weight is typically between 0 and 1",
        value: cfg.weight,
      });
    }
  }
}

/**
 * Validate the rules section of a config.
 */
function validateRules(
  rules: unknown,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  if (!rules || typeof rules !== "object") {
    return;
  }

  const r = rules as Record<string, unknown>;

  for (const [category, categoryRules] of Object.entries(r)) {
    // Check if category is valid
    if (!VALID_RULE_NAMES[category]) {
      warnings.push({
        path: `rules.${category}`,
        message: `Unknown rule category: ${category}. Valid categories are: ${Object.keys(VALID_RULE_NAMES).join(", ")}`,
        value: categoryRules,
      });
      continue;
    }

    if (!categoryRules || typeof categoryRules !== "object") {
      continue;
    }

    const validRules = VALID_RULE_NAMES[category] || [];

    for (const [ruleName, ruleConfig] of Object.entries(categoryRules as Record<string, unknown>)) {
      // Check if rule name is valid for this category
      if (!validRules.includes(ruleName)) {
        warnings.push({
          path: `rules.${category}.${ruleName}`,
          message: `Unknown rule: ${ruleName}. Valid rules for ${category} are: ${validRules.join(", ")}`,
          value: ruleConfig,
        });
        continue;
      }

      // Validate the threshold config
      validateThresholdConfig(ruleConfig, `rules.${category}.${ruleName}`, errors, warnings);
    }
  }
}

/**
 * Validate the author section of a config.
 */
function validateAuthor(
  author: unknown,
  errors: ValidationError[],
  _warnings: ValidationError[]
): void {
  if (!author || typeof author !== "object") {
    return;
  }

  const a = author as Record<string, unknown>;

  // writing_background validation
  if (a.writing_background && typeof a.writing_background === "object") {
    const wb = a.writing_background as Record<string, unknown>;

    if (wb.other_languages !== undefined && !Array.isArray(wb.other_languages)) {
      errors.push({
        path: "author.writing_background.other_languages",
        message: "other_languages must be an array of strings",
        value: wb.other_languages,
      });
    }

    if (wb.published_works !== undefined && typeof wb.published_works !== "boolean") {
      errors.push({
        path: "author.writing_background.published_works",
        message: "published_works must be a boolean",
        value: wb.published_works,
      });
    }

    if (wb.technical_writer !== undefined && typeof wb.technical_writer !== "boolean") {
      errors.push({
        path: "author.writing_background.technical_writer",
        message: "technical_writer must be a boolean",
        value: wb.technical_writer,
      });
    }

    if (wb.academic_writer !== undefined && typeof wb.academic_writer !== "boolean") {
      errors.push({
        path: "author.writing_background.academic_writer",
        message: "academic_writer must be a boolean",
        value: wb.academic_writer,
      });
    }
  }

  // background validation
  if (a.background && typeof a.background === "object") {
    const bg = a.background as Record<string, unknown>;

    if (bg.years_experience !== undefined && typeof bg.years_experience !== "number") {
      errors.push({
        path: "author.background.years_experience",
        message: "years_experience must be a number",
        value: bg.years_experience,
      });
    }
  }

  // personality should be an array
  if (a.personality !== undefined && !Array.isArray(a.personality)) {
    errors.push({
      path: "author.personality",
      message: "personality must be an array of strings",
      value: a.personality,
    });
  }
}

/**
 * Check for deprecated/old field names (camelCase instead of snake_case).
 */
function checkDeprecatedFields(
  config: Record<string, unknown>,
  warnings: ValidationError[]
): void {
  const deprecatedMappings: Record<string, string> = {
    context: "publication",
    style: "writing_style",
    writingContext: "publication",
    writingStyle: "writing_style",
  };

  for (const [oldKey, newKey] of Object.entries(deprecatedMappings)) {
    if (config[oldKey] !== undefined) {
      warnings.push({
        path: oldKey,
        message: `"${oldKey}" is deprecated. Use "${newKey}" instead.`,
        value: config[oldKey],
      });
    }
  }

  // Check for camelCase in rules
  if (config.rules && typeof config.rules === "object") {
    const rules = config.rules as Record<string, unknown>;
    const camelCaseRules = [
      ["periodQuote", "period_quote"],
      ["oxfordComma", "oxford_comma"],
      ["emDash", "em_dash"],
      ["semicolonToEmDashRatio", "semicolon_to_em_dash_ratio"],
      ["parenthesisToEmDashRatio", "parenthesis_to_em_dash_ratio"],
      ["paragraphFanoFactor", "paragraph_fano_factor"],
      ["bulletDensity", "bullet_density"],
      ["transitionDensity", "transition_density"],
      ["aiVocabDensity", "ai_vocab_density"],
      ["coefficientOfVariation", "coefficient_of_variation"],
      ["fanoFactor", "fano_factor"],
      ["lengthRange", "length_range"],
      ["sixGramRepetitionRate", "six_gram_repetition_rate"],
      ["sixGramTTR", "six_gram_ttr"],
      ["aiPatternCount", "ai_pattern_count"],
      ["avgDependencyDepth", "avg_dependency_depth"],
      ["sentenceTypeUniformity", "sentence_type_uniformity"],
      ["dScore", "d_score"],
    ];

    for (const category of Object.values(rules)) {
      if (!category || typeof category !== "object") continue;
      const cat = category as Record<string, unknown>;

      for (const [camel, snake] of camelCaseRules) {
        if (cat[camel] !== undefined) {
          warnings.push({
            path: `rules.*.${camel}`,
            message: `"${camel}" is deprecated. Use "${snake}" instead.`,
            value: cat[camel],
          });
        }
      }

      // Check threshold config keys
      for (const ruleConfig of Object.values(cat)) {
        if (!ruleConfig || typeof ruleConfig !== "object") continue;
        const rc = ruleConfig as Record<string, unknown>;

        if (rc.aiThreshold !== undefined) {
          warnings.push({
            path: "rules.*.*.aiThreshold",
            message: `"aiThreshold" is deprecated. Use "ai_threshold" instead.`,
            value: rc.aiThreshold,
          });
        }
        if (rc.humanBaseline !== undefined) {
          warnings.push({
            path: "rules.*.*.humanBaseline",
            message: `"humanBaseline" is deprecated. Use "human_baseline" instead.`,
            value: rc.humanBaseline,
          });
        }
      }
    }
  }
}

/**
 * Validate a parsed detection configuration.
 *
 * @param config - The parsed configuration object
 * @returns Validation result with errors and warnings
 */
export function validateConfig(config: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check for deprecated field names
  checkDeprecatedFields(config, warnings);

  // Validate publication
  validatePublication(config.publication, errors, warnings);

  // Validate writing_style
  validateWritingStyle(config.writing_style, errors, warnings);

  // Validate rules
  validateRules(config.rules, errors, warnings);

  // Validate author
  validateAuthor(config.author, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Resolve a partial config to a fully resolved config.
 *
 * @param partial - The partial configuration to resolve
 * @returns A fully resolved configuration with all required fields
 */
function resolveToFull(partial: PartialWritingConfig): ResolvedWritingConfig {
  // Start with defaults
  const rules = deepMerge(
    DEFAULT_RULES as Record<string, unknown>,
    (partial.rules || {}) as Record<string, unknown>
  ) as Required<RuleConfigs>;

  // Resolve publication with defaults
  const publication: Publication = {
    media: partial.publication?.media || "unknown",
    publisher: partial.publication?.publisher,
    audience: partial.publication?.audience,
    domain: partial.publication?.domain,
    genre: partial.publication?.genre,
    genres: partial.publication?.genres,
    content_type: partial.publication?.content_type,
    length_category: partial.publication?.length_category,
    platform: partial.publication?.platform,
    editorial_level: partial.publication?.editorial_level,
    era: partial.publication?.era,
    subjects: partial.publication?.subjects,
    source_language: partial.publication?.source_language,
    is_translation: partial.publication?.is_translation,
  };

  // Resolve writing_style (all optional)
  const writing_style: WritingStyle = {
    tone: partial.writing_style?.tone,
    formality: partial.writing_style?.formality,
    voice: partial.writing_style?.voice,
    tense: partial.writing_style?.tense,
    prose: partial.writing_style?.prose,
  };

  return {
    author: partial.author,
    publication,
    writing_style,
    rules,
  };
}

/**
 * Load and resolve a detection configuration.
 *
 * @param configPath - Path to the config YAML file, or undefined for defaults
 * @param options - Options for loading the config
 * @returns Fully resolved configuration
 */
export function loadConfig(
  configPath?: string,
  options: LoadConfigOptions = {},
  cliPresets?: string[],
): ResolvedWritingConfig {
  // CLI presets only, no config file
  if (!configPath) {
    if (cliPresets && cliPresets.length > 0) {
      const merged = resolvePresets(cliPresets) as Record<string, unknown>;
      return resolveToFull(merged as PartialWritingConfig);
    }
    return resolveToFull({});
  }

  // Load the main config
  const config = loadYamlFile(configPath, options);

  // Combine CLI presets (first) with file presets (after)
  const allPresets = [
    ...(cliPresets || []),
    ...(config.presets || []),
  ];

  // Resolve presets
  let merged: Record<string, unknown> = {};

  if (allPresets.length > 0) {
    merged = resolvePresets(allPresets, configPath) as Record<string, unknown>;
  }

  // Merge main config on top of resolved presets
  const { presets: _, ...configWithoutPresets } = config;
  merged = deepMerge(merged, configWithoutPresets as Record<string, unknown>);

  // Resolve to full config
  return resolveToFull(merged as PartialWritingConfig);
}

/**
 * Load config from a preset name only (no file).
 * Useful for quick CLI usage.
 *
 * @param presetName - The name of the preset to load
 * @returns Fully resolved configuration
 * @throws Error if the preset is unknown
 */
export function loadPreset(presetName: string): ResolvedWritingConfig {
  // Check if it's a media type
  if (isMediaType(presetName)) {
    return loadConfig(getPresetPath(presetName));
  }

  // Check if it's a built-in preset
  if (isBuiltinPreset(presetName)) {
    return loadConfig(getPresetPath(presetName));
  }

  throw new Error(`Unknown preset: ${presetName}`);
}

/**
 * Create a resolved config from just a media type.
 * Useful for backward compatibility with the old context system.
 *
 * @param media - The media type to load configuration for
 * @returns Fully resolved configuration
 */
export function loadFromMediaType(media: MediaType): ResolvedWritingConfig {
  // Try to load the corresponding preset if it exists
  const presetPath = join(__dirname, "../config/presets", `${media}.yaml`);
  if (existsSync(presetPath)) {
    return loadConfig(presetPath);
  }

  // Otherwise, just set the media type with defaults
  return resolveToFull({ publication: { media } });
}

/**
 * Get list of available built-in presets.
 */
export function getBuiltinPresets(): readonly string[] {
  return BUILTIN_PRESETS;
}

/**
 * Get list of available media types.
 */
export function getMediaTypes(): readonly MediaType[] {
  return MEDIA_TYPES;
}

/**
 * Serialize resolved config for environment variable (for Python tools).
 */
export function serializeConfigForEnv(config: ResolvedWritingConfig): string {
  return JSON.stringify(config);
}

/**
 * Deserialize config from environment variable.
 */
export function deserializeConfigFromEnv(envValue?: string): ResolvedWritingConfig | null {
  if (!envValue) {
    return null;
  }

  try {
    return JSON.parse(envValue) as ResolvedWritingConfig;
  } catch {
    return null;
  }
}

// Re-export types for convenience
export type {
  WritingConfig,
  ResolvedWritingConfig,
  PartialWritingConfig,
  RuleConfigs,
  Publication,
  WritingStyle,
  ProseTargets,
  AuthorProfile,
  MediaType,
} from "../config/schemas";
