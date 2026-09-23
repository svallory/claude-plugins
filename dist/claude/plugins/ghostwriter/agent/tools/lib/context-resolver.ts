/**
 * context-resolver.ts
 *
 * Resolves writing configuration from various input formats.
 * Central utility for making tools config-aware.
 *
 * This module wraps config-loader.ts and provides the main API for
 * resolving configs from different input types (file paths, media types,
 * preset names, JSON strings).
 */

import { existsSync } from 'fs';
import type {
  ResolvedWritingConfig,
  MediaType,
  BaseRuleConfig,
  RuleCategory,
  Publication,
  WritingStyle,
  FormalityLevel,
} from '../config/schemas';
import { isMediaType, MEDIA_TYPES } from '../config/schemas';
import {
  loadConfig,
  loadPreset,
  loadFromMediaType,
  serializeConfigForEnv,
  deserializeConfigFromEnv,
  getBuiltinPresets,
} from './config-loader';

// Re-export types from config-loader
export type {
  ResolvedWritingConfig,
  MediaType,
  BaseRuleConfig,
  RuleCategory,
  Publication,
  WritingStyle,
};

/** @deprecated Use ResolvedWritingConfig instead */
export type ResolvedDetectionConfig = ResolvedWritingConfig;

// Cache for loaded config
let cachedConfig: ResolvedWritingConfig | null = null;
let cachedConfigPath: string | null = null;

/**
 * Clear the cached config (useful for testing).
 *
 * When the config is loaded from a file path, it's cached to avoid redundant
 * file I/O. Call this function to force a fresh reload on next resolution.
 *
 * @example
 * ```ts
 * clearConfigCache();
 * const freshConfig = resolveConfig(undefined, "./new-config.yml");
 * ```
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedConfigPath = null;
}

/**
 * Resolve config input to a ResolvedWritingConfig.
 *
 * Attempts to interpret the input string and return appropriate config.
 * Supports multiple input formats in order of precedence:
 * - undefined/null/empty: returns default "unknown" config
 * - File path: "./config.yml" or "/absolute/path.yml" -> loads full YAML config
 * - Media type: "blog", "book", "academic" -> loads preset for that media
 * - Preset name: "technical-book", "student-essay" -> loads composite preset
 * - JSON string: '{"media":"blog"}' -> extracts media type from JSON
 * - Falls back to "unknown" with a warning if unrecognized
 *
 * Results are cached by file path to avoid redundant I/O. Call {@link clearConfigCache}
 * to force a fresh reload.
 *
 * @param input - Config input (string, null, or undefined)
 * @param configPath - Optional file path to config file. When provided, overrides input
 *                     and loads the config file directly.
 * @returns Resolved writing config
 */
export function resolveConfig(
  input?: string | null,
  configPath?: string,
): ResolvedWritingConfig {
  // If config path is provided, use it directly
  if (configPath) {
    if (cachedConfig && cachedConfigPath === configPath) {
      return cachedConfig;
    }
    cachedConfig = loadConfig(configPath);
    cachedConfigPath = configPath;
    return cachedConfig;
  }

  // Default context
  if (input === undefined || input === null || input === '') {
    return loadFromMediaType('unknown');
  }

  // String input
  const inputStr = input.trim();

  // Check if it's a file path
  if (
    inputStr.endsWith('.yaml') ||
    inputStr.endsWith('.yml') ||
    inputStr.startsWith('./') ||
    inputStr.startsWith('/')
  ) {
    if (existsSync(inputStr)) {
      return loadConfig(inputStr);
    }
  }

  // Check if it's a media type
  if (isMediaType(inputStr)) {
    return loadFromMediaType(inputStr as MediaType);
  }

  // Check if it's JSON format with media type
  if (inputStr.startsWith('{')) {
    try {
      const parsed = JSON.parse(inputStr) as Record<string, unknown>;
      const media = parsed.media as string | undefined;
      if (media && isMediaType(media)) {
        return loadFromMediaType(media as MediaType);
      }
      // Invalid JSON format, try as preset
    } catch {
      // Invalid JSON, try as preset
    }
  }

  // Check if it's a preset name
  try {
    return loadPreset(inputStr);
  } catch {
    // Not a valid preset
  }

  // Unknown input, default to unknown media
  console.error(`Warning: Unknown config input "${inputStr}", using default`);
  return loadFromMediaType('unknown');
}

/** @deprecated Use resolveConfig instead */
export const resolveContext = resolveConfig;

/**
 * Serialize config for environment variable.
 * Re-export from config-loader for convenience.
 */
export { serializeConfigForEnv };

/**
 * Deserialize config from environment variable.
 * Re-export from config-loader for convenience.
 */
export { deserializeConfigFromEnv };

/**
 * Get all available presets.
 *
 * Returns a list of all built-in preset names that can be passed to
 * {@link resolveConfig}.
 *
 * @returns Array of preset names
 */
export function getPresets(): string[] {
  return [...getBuiltinPresets()];
}

/**
 * Get all available media types.
 *
 * Returns a list of all supported media types that can be passed to
 * {@link resolveConfig}.
 *
 * @returns Array of media type names
 */
export function getMediaTypes(): MediaType[] {
  return [...MEDIA_TYPES];
}

/**
 * Load writing config from a YAML file.
 *
 * Low-level function for loading config from a file path. Most consumers should use
 * {@link resolveConfig} instead, which automatically detects file paths and handles
 * caching.
 */
export { loadConfig };

/**
 * Load writing config from a preset name.
 *
 * Low-level function for loading a built-in preset by name. Most consumers should use
 * {@link resolveConfig} instead, which automatically detects preset names.
 */
export { loadPreset };

/**
 * Load writing config from a media type.
 *
 * Low-level function for loading config for a specific media type. Most consumers should use
 * {@link resolveConfig} instead, which automatically detects media types.
 */
export { loadFromMediaType };

/**
 * Get all available built-in presets.
 *
 * Low-level function that returns preset names. Most consumers should use
 * {@link getPresets} instead.
 */
export { getBuiltinPresets };
