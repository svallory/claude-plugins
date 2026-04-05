/**
 * session-config.schema.ts
 *
 * Schema for humanization session configuration.
 * Extends WritingConfig with session-specific settings.
 */

import type { WritingConfig } from "./writing-config.schema";

/**
 * Success mode for determining when humanization is complete.
 *
 * - 'any_flag': Continue until no AI signals are detected (strictest)
 * - 'confidence': Continue until confidence drops below threshold
 */
export type SuccessMode = "any_flag" | "confidence";

/**
 * Content preservation options.
 * Specifies what content should be preserved verbatim during humanization.
 */
export type PreservableContent =
  | "code_blocks"
  | "quotes"
  | "links"
  | "images"
  | "tables"
  | "headings"
  | "lists"
  | "footnotes";

/**
 * Session-specific settings for the humanization loop.
 */
export interface SessionSettings {
  /**
   * Maximum number of humanization rounds before stopping.
   * Default: 5
   */
  max_rounds?: number;

  /**
   * How to determine success.
   * - 'any_flag': No AI signals detected
   * - 'confidence': Confidence below threshold
   * Default: 'any_flag'
   */
  success_mode?: SuccessMode;

  /**
   * Confidence threshold for 'confidence' success mode.
   * Session succeeds when AI confidence drops below this value.
   * Default: 0.30 (30%)
   */
  confidence_threshold?: number;

  /**
   * Whether to preserve the overall document structure.
   * When true, Writer maintains heading hierarchy, paragraph count, etc.
   * Default: true
   */
  preserve_structure?: boolean;

  /**
   * Specific content types to preserve verbatim.
   * These will be extracted before humanization and restored after.
   * Default: []
   */
  preserve?: PreservableContent[];

  /**
   * Enable verbose output during session execution.
   * Default: false
   */
  verbose?: boolean;
}

/**
 * Session configuration.
 * Extends WritingConfig with session-specific settings.
 *
 * This is the schema for config.yml files in session folders.
 */
export interface SessionConfig extends WritingConfig {
  /**
   * Session-specific settings.
   */
  session?: SessionSettings;
}

/**
 * Resolved session settings with all defaults applied.
 */
export interface ResolvedSessionSettings {
  max_rounds: number;
  success_mode: SuccessMode;
  confidence_threshold: number;
  preserve_structure: boolean;
  preserve: PreservableContent[];
  verbose: boolean;
}

/**
 * Default session settings.
 */
export const DEFAULT_SESSION_SETTINGS: ResolvedSessionSettings = {
  max_rounds: 5,
  success_mode: "any_flag",
  confidence_threshold: 0.3,
  preserve_structure: true,
  preserve: [],
  verbose: false,
};

/**
 * Resolve session settings with defaults.
 *
 * @param settings - Partial session settings from config
 * @returns Fully resolved session settings
 */
export function resolveSessionSettings(
  settings?: SessionSettings
): ResolvedSessionSettings {
  return {
    max_rounds: settings?.max_rounds ?? DEFAULT_SESSION_SETTINGS.max_rounds,
    success_mode: settings?.success_mode ?? DEFAULT_SESSION_SETTINGS.success_mode,
    confidence_threshold:
      settings?.confidence_threshold ?? DEFAULT_SESSION_SETTINGS.confidence_threshold,
    preserve_structure:
      settings?.preserve_structure ?? DEFAULT_SESSION_SETTINGS.preserve_structure,
    preserve: settings?.preserve ?? DEFAULT_SESSION_SETTINGS.preserve,
    verbose: settings?.verbose ?? DEFAULT_SESSION_SETTINGS.verbose,
  };
}
