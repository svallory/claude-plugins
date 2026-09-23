/**
 * writing-config.schema.ts
 *
 * Root schema for writing configuration.
 * This is the source of truth for the YAML configuration format.
 * Describes the writing context: author, publication, style, and rules.
 * Used by both detector and writer tools.
 *
 * Uses snake_case for YAML/JSON compatibility:
 * - publication (was: context)
 * - writing_style (was: style)
 */

import type { AuthorProfile } from "./author.schema";
import type { Publication, WritingStyle, MediaType } from "./publication.schema";
import type { RuleConfigs } from "./rules.schema";

/**
 * Configuration version for compatibility checking.
 */
export type ConfigVersion = "1.0";

/**
 * Writing configuration as written in YAML files.
 * This is the user-facing format before preset resolution.
 */
export interface WritingConfig {
  /** Configuration version for compatibility */
  version: ConfigVersion;

  /**
   * Presets to merge before this config.
   * Can be:
   * - Built-in preset names (e.g., "blog", "technical-book")
   * - File paths (e.g., "./authors/john-doe.yaml")
   *
   * Merged in order: later overrides former.
   */
  presets?: string[];

  /** Author profile */
  author?: AuthorProfile;

  /** Publication metadata (media, publisher, genre, etc.) */
  publication?: Partial<Publication>;

  /** Writing style preferences */
  writing_style?: Partial<WritingStyle>;

  /** Rule threshold configurations */
  rules?: RuleConfigs;
}

/**
 * Fully resolved configuration after merging presets.
 * All optional fields from WritingConfig are resolved to concrete values.
 */
export interface ResolvedWritingConfig {
  /** Author profile (may be undefined if no author info provided) */
  author?: AuthorProfile;

  /** Publication metadata (always has media, other fields may be undefined) */
  publication: Publication;

  /** Writing style (all fields may be undefined) */
  writing_style: WritingStyle;

  /** Rule thresholds (fully resolved with defaults) */
  rules: Required<RuleConfigs>;
}

/**
 * Partial config used during preset merging.
 * All fields are optional.
 */
export interface PartialWritingConfig {
  version?: ConfigVersion;
  presets?: string[];
  author?: AuthorProfile;
  publication?: Partial<Publication>;
  writing_style?: Partial<WritingStyle>;
  rules?: RuleConfigs;
}

/** @deprecated Use WritingConfig instead */
export type DetectionConfig = WritingConfig;
/** @deprecated Use ResolvedWritingConfig instead */
export type ResolvedDetectionConfig = ResolvedWritingConfig;
/** @deprecated Use PartialWritingConfig instead */
export type PartialDetectionConfig = PartialWritingConfig;

// Re-export types from sub-schemas for convenience
export type { AuthorProfile } from "./author.schema";
export type {
  Publication,
  WritingStyle,
  ProseTargets,
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
  PublisherInfo,
} from "./publication.schema";
export type {
  RuleConfigs,
  BaseRuleConfig,
  PeriodQuoteRuleConfig,
  OxfordCommaRuleConfig,
  PeriodQuoteConvention,
  OxfordCommaConvention,
  RuleCategory,
  RuleName,
} from "./rules.schema";
