/**
 * schemas/index.ts
 *
 * Re-exports all schema types for convenient importing.
 */

// Author schema
export type {
  AuthorProfile,
  AuthorBackground,
  WritingBackground,
} from "./author.schema";

// Publication schema (replaces context.schema.ts)
export type {
  MediaType,
  Publication,
  WritingStyle,
  ProseTargets,
  PublisherInfo,
  AudienceLevel,
  LengthCategory,
  Platform,
  EditorialLevel,
  Era,
  WritingTone,
  FormalityLevel,
  NarrativeVoice,
  PrimaryTense,
} from "./publication.schema";

export { MEDIA_TYPES, isMediaType } from "./publication.schema";

// Rules schema
export type {
  BaseRuleConfig,
  PeriodQuoteConvention,
  OxfordCommaConvention,
  PeriodQuoteRuleConfig,
  OxfordCommaRuleConfig,
  PunctuationRules,
  StructureRules,
  VocabularyRules,
  BurstinessRules,
  NgramRules,
  ContentRules,
  SyntacticRules,
  PerplexityRules,
  DetectGPTRules,
  FastDetectGPTRules,
  BinocularsRules,
  RuleConfigs,
  RuleCategory,
  RuleName,
} from "./rules.schema";

export { RULE_CATEGORIES } from "./rules.schema";

// Writing config schema
export type {
  ConfigVersion,
  WritingConfig,
  ResolvedWritingConfig,
  PartialWritingConfig,
  // Deprecated aliases
  DetectionConfig,
  ResolvedDetectionConfig,
  PartialDetectionConfig,
} from "./writing-config.schema";
