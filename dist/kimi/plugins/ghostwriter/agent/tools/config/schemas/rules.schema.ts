/**
 * rules.schema.ts
 *
 * Rule configurations organized by category with type-safe expected values.
 * Uses snake_case for YAML/JSON compatibility.
 */

// ============================================
// Base Config
// ============================================

/**
 * Base configuration for a single rule.
 * All rules can have these properties.
 */
export interface BaseRuleConfig {
  /**
   * Value above/below which triggers AI signal.
   * null = metric unreliable for this context (skip check)
   */
  ai_threshold?: number | null;

  /** Expected value for human-written text in this context */
  human_baseline?: number;

  /** If true, completely skip this metric for this context */
  disabled?: boolean;

  /** Weight multiplier for this context (0-1). Lower values reduce metric influence. */
  weight?: number;
}

// ============================================
// Punctuation Rules
// ============================================

/**
 * Period-quote placement convention.
 *
 * Defines where punctuation marks are placed relative to closing quotation marks:
 * - `american`: Period/comma inside closing quote (e.g., "Hello.")
 * - `british`: Period/comma outside closing quote (e.g., "Hello".)
 * - `logical`: Placement based on semantic meaning rather than convention
 */
export type PeriodQuoteConvention = "american" | "british" | "logical";

/**
 * Oxford comma usage convention.
 *
 * Defines whether a comma is used before the final item in a list:
 * - `always`: Oxford comma is always used (e.g., "apples, oranges, and bananas")
 * - `never`: Oxford comma is never used (e.g., "apples, oranges and bananas")
 * - `flexible`: Oxford comma usage is context-dependent and acceptable either way
 */
export type OxfordCommaConvention = "always" | "never" | "flexible";

/**
 * Rule config for period-quote placement checking.
 */
export interface PeriodQuoteRuleConfig extends BaseRuleConfig {
  /** Expected convention for this context */
  expected?: PeriodQuoteConvention;
}

/**
 * Rule config for Oxford comma usage checking.
 */
export interface OxfordCommaRuleConfig extends BaseRuleConfig {
  /** Expected convention for this context */
  expected?: OxfordCommaConvention;
}

/**
 * Punctuation-related rules for detecting AI-generated text patterns.
 *
 * AI-generated text often shows distinctive punctuation patterns that differ from human writing.
 * These rules measure punctuation consistency and usage patterns that may indicate automated generation.
 */
export interface PunctuationRules {
  /**
   * Period-quote consistency.
   * Checks if quotation marks are placed correctly relative to periods/commas.
   * AI models sometimes have inconsistent period-quote placement based on training data.
   */
  period_quote?: PeriodQuoteRuleConfig;

  /**
   * Oxford comma consistency.
   * Measures whether serial commas are used consistently in lists.
   * AI models may show patterns different from typical human writing conventions.
   */
  oxford_comma?: OxfordCommaRuleConfig;

  /**
   * Em-dash usage rate.
   * Measured as frequency per 1000 words.
   * AI-generated text often shows atypical em-dash usage compared to human writing.
   */
  em_dash?: BaseRuleConfig;

  /**
   * Semicolon to em-dash ratio.
   * Measures the relative frequency of semicolons versus em-dashes.
   * Different genres and authors have characteristic ratios; AI may deviate from these.
   */
  semicolon_to_em_dash_ratio?: BaseRuleConfig;

  /**
   * Parenthesis to em-dash ratio.
   * Measures the relative frequency of parentheses versus em-dashes.
   * AI models may substitute one form for another in patterns that differ from human conventions.
   */
  parenthesis_to_em_dash_ratio?: BaseRuleConfig;
}

// ============================================
// Structure Rules
// ============================================

/**
 * Structure-related rules for paragraph and document-level analysis.
 *
 * These rules analyze how text is organized at the paragraph, section, and document levels.
 * AI-generated text often shows different structural patterns than human-written content,
 * such as more uniform paragraph lengths or different transition patterns.
 */
export interface StructureRules {
  /**
   * Paragraph length Fano factor.
   * Measures the uniformity of paragraph lengths. The Fano factor is the ratio of variance to mean.
   * Lower values indicate more uniform paragraphs (common in AI), higher values indicate more variation (human-like).
   */
  paragraph_fano_factor?: BaseRuleConfig;

  /**
   * Bullet point density.
   * Measures the frequency of bulleted lists relative to total content.
   * AI-generated content may have different bullet point usage patterns depending on the context.
   */
  bullet_density?: BaseRuleConfig;

  /**
   * Transition word density.
   * Measured as the frequency of transition words (however, therefore, moreover, etc.) per 1000 words.
   * AI models may overuse or underuse transition words compared to human writing patterns.
   */
  transition_density?: BaseRuleConfig;
}

// ============================================
// Vocabulary Rules
// ============================================

/**
 * Vocabulary-related rules for detecting AI-specific language patterns.
 *
 * AI language models are trained on large datasets and tend to use certain words and phrases
 * more frequently than human writers. These rules identify those distinctive vocabulary patterns.
 */
export interface VocabularyRules {
  /**
   * AI vocabulary density.
   * Measures the percentage of text that uses vocabulary or phrases commonly associated with AI generation.
   * Includes words/phrases like "delve into," "crucial," "moreover," and other patterns typical of AI models.
   * Higher densities may indicate AI-generated content.
   */
  ai_vocab_density?: BaseRuleConfig;
}

// ============================================
// Burstiness Rules
// ============================================

/**
 * Burstiness-related rules for sentence length variation analysis.
 *
 * Burstiness measures how uniformly sentence lengths are distributed.
 * Human writing typically shows higher burstiness (more variation in sentence length),
 * while AI-generated text often shows lower burstiness (more uniform sentence lengths).
 * These metrics help distinguish natural writing from automated generation.
 */
export interface BurstinessRules {
  /**
   * Coefficient of variation in sentence lengths.
   * Calculated as (standard deviation / mean) * 100. Higher values indicate more variation.
   * Humans typically have CV > 60% (burstier), AI often has CV < 30% (more uniform).
   */
  coefficient_of_variation?: BaseRuleConfig;

  /**
   * Fano factor for sentence lengths.
   * Calculated as variance / mean. Lower values indicate more uniform distribution.
   * Humans typically have Fano > 1.5 (burstier), AI often has Fano < 0.8 (more uniform).
   */
  fano_factor?: BaseRuleConfig;

  /**
   * Range between shortest and longest sentences.
   * Measures the absolute difference in word count between the shortest and longest sentences.
   * Larger ranges indicate more variation, which is typical of human writing.
   */
  length_range?: BaseRuleConfig;
}

// ============================================
// N-gram Rules
// ============================================

/**
 * N-gram analysis rules for detecting repeated phrase patterns.
 *
 * N-grams are sequences of N words. Analysis of n-gram patterns can reveal both
 * repeated phrase usage and the diversity of language patterns. AI-generated text
 * often shows distinctive n-gram distributions and higher repetition rates.
 */
export interface NgramRules {
  /**
   * 6-gram repetition rate.
   * Measures how often sequences of 6 consecutive words are repeated in the text.
   * Higher rates may indicate AI generation, as models tend to produce more formulaic language.
   */
  six_gram_repetition_rate?: BaseRuleConfig;

  /**
   * 6-gram type-token ratio.
   * Measures the diversity of 6-gram sequences. Calculated as (unique 6-grams / total 6-grams).
   * Lower ratios indicate less diversity (more repetitive), higher ratios indicate more diversity.
   * AI-generated text often shows lower TTR than human writing.
   */
  six_gram_ttr?: BaseRuleConfig;

  /**
   * Count of known AI phrase patterns.
   * Detects occurrences of specific phrases and patterns commonly found in AI-generated content.
   * Examples include "In this article," "It is worth noting," and other AI-typical openings or connectors.
   * Higher counts may indicate AI generation.
   */
  ai_pattern_count?: BaseRuleConfig;
}

// ============================================
// Content Rules
// ============================================

/**
 * Content analysis rules for semantic and linguistic patterns.
 *
 * These rules analyze the actual language content for patterns that may indicate AI generation.
 * They focus on hedging language, cliches, superlatives, and filler words that appear
 * at different frequencies in AI-generated versus human-written text.
 */
export interface ContentRules {
  /**
   * Hedging language frequency.
   * Measured as occurrences per 1000 words.
   * Hedging words include "perhaps," "arguably," "may," "could," and similar phrases.
   * AI-generated text often uses hedging more frequently than human writing.
   */
  hedging?: BaseRuleConfig;

  /**
   * Cliche count.
   * Counts occurrences of common, overused phrases (e.g., "in this day and age," "tip of the iceberg").
   * AI models frequently generate cliches more often than human writers do.
   */
  cliche?: BaseRuleConfig;

  /**
   * Superlative usage frequency.
   * Measured as occurrences per 1000 words.
   * Superlatives include words like "best," "worst," "most," "least," and similar extremes.
   * AI-generated text often uses superlatives more frequently than natural human writing.
   */
  superlative?: BaseRuleConfig;

  /**
   * Filler word count.
   * Counts occurrences of filler words like "basically," "really," "actually," "very," and "quite."
   * These provide little semantic content and may be overused in certain types of AI generation.
   */
  filler?: BaseRuleConfig;
}

// ============================================
// Syntactic Rules
// ============================================

/**
 * Syntactic complexity rules for grammatical structure analysis.
 *
 * These rules analyze the grammatical complexity and structure of sentences.
 * Syntactic patterns differ between human and AI-generated text, with AI often showing
 * different patterns of sentence complexity and structure variation.
 */
export interface SyntacticRules {
  /**
   * Average dependency tree depth.
   * Measures the average depth of syntactic dependencies in the text (parsed dependency grammar).
   * Higher depths indicate more complex sentence structures. AI-generated text often shows
   * different dependency depth patterns than human writing.
   */
  avg_dependency_depth?: BaseRuleConfig;

  /**
   * Sentence type uniformity.
   * Measures how uniformly different sentence types (declarative, interrogative, imperative, exclamatory)
   * are distributed. Higher uniformity may indicate AI, while human writing shows more variation.
   */
  sentence_type_uniformity?: BaseRuleConfig;
}

// ============================================
// ML-based Rules
// ============================================

/**
 * Perplexity-based rules using language model evaluation.
 *
 * Perplexity is a measure of how "surprised" a language model is by a piece of text.
 * Lower perplexity indicates the text is more predictable to the model.
 * AI-generated text often has distinctively different perplexity scores than human-written text.
 */
export interface PerplexityRules {
  /**
   * GPT-2 perplexity score.
   * Measures how well a GPT-2 language model predicts the text.
   * Lower scores (< 20) suggest AI generation, higher scores (> 50) suggest human writing.
   * Context matters: technical documents have lower baseline perplexity than conversational text.
   */
  perplexity?: BaseRuleConfig;
}

/**
 * DetectGPT-based rules using curvature analysis.
 *
 * DetectGPT is an AI detection method that analyzes how often words in the text
 * would be replaced by a language model when performing nucleus sampling.
 * It's based on the observation that AI-generated text has distinctive curvature
 * in the ranking of alternative words.
 */
export interface DetectGPTRules {
  /**
   * DetectGPT d-score.
   * Measures the curvature of the probability distribution when a language model re-ranks
   * words in the text. Higher scores (> 2.0) suggest AI generation, lower scores (< 0.5)
   * suggest human writing. This is one of the more robust indicators of AI generation.
   */
  d_score?: BaseRuleConfig;
}

/**
 * Fast-DetectGPT rules using conditional probability curvature.
 *
 * Fast-DetectGPT uses a scoring/sampling model pair (falcon-7b / falcon-7b-instruct)
 * to compute a probability that text is AI-generated. It is 340x faster than the
 * original DetectGPT approach, using analytic sampling discrepancy instead of
 * iterative perturbation.
 */
export interface FastDetectGPTRules {
  /** AI generation probability (0-1). Higher = more likely AI. */
  probability?: BaseRuleConfig;
}

/**
 * Binoculars rules using cross-perplexity ratio.
 *
 * Binoculars compares the perplexity of text under two related models (observer
 * and performer, e.g. falcon-7b / falcon-7b-instruct). The ratio of their
 * cross-entropy scores produces a score where lower values indicate AI generation.
 * Published with state-of-the-art accuracy on multiple benchmarks.
 */
export interface BinocularsRules {
  /** PPL/cross-entropy ratio. Lower = more likely AI. */
  score?: BaseRuleConfig;
}

// ============================================
// Root Rules Config
// ============================================

/**
 * Root configuration object containing all configurable rule thresholds organized by category.
 *
 * This is the top-level interface that aggregates all rule categories. Context-aware
 * detection systems use this interface to configure thresholds for different media types,
 * formality levels, and writing styles.
 *
 * Example usage:
 * ```typescript
 * const config: RuleConfigs = {
 *   punctuation: {
 *     period_quote: { expected: "american", weight: 0.8 },
 *     em_dash: { ai_threshold: 15, human_baseline: 25 }
 *   },
 *   burstiness: {
 *     fano_factor: { ai_threshold: 0.8, human_baseline: 1.5, weight: 0.9 }
 *   }
 * };
 * ```
 */
export interface RuleConfigs {
  /** Punctuation consistency rules (period-quote, Oxford comma, em-dashes, etc.) */
  punctuation?: PunctuationRules;

  /** Document and paragraph structure rules (paragraph uniformity, bullets, transitions) */
  structure?: StructureRules;

  /** Vocabulary pattern rules (AI-typical words and phrases) */
  vocabulary?: VocabularyRules;

  /** Sentence length variation rules (burstiness metrics) */
  burstiness?: BurstinessRules;

  /** Phrase repetition and diversity rules (n-gram analysis) */
  ngram?: NgramRules;

  /** Content-level analysis rules (hedging, cliches, superlatives, fillers) */
  content?: ContentRules;

  /** Grammar and sentence structure rules (dependency depth, sentence type uniformity) */
  syntactic?: SyntacticRules;

  /** Language model-based perplexity rules (GPT-2 perplexity) */
  perplexity?: PerplexityRules;

  /** DetectGPT curvature-based rules (d-score) */
  detectgpt?: DetectGPTRules;

  /** Fast-DetectGPT probability-based rules (conditional probability curvature) */
  fast_detectgpt?: FastDetectGPTRules;

  /** Binoculars cross-perplexity ratio rules (observer/performer comparison) */
  binoculars?: BinocularsRules;
}

// ============================================
// Utility Types
// ============================================

/**
 * Union type of all valid rule category names.
 *
 * Represents the top-level keys in the RuleConfigs interface.
 * Use this type when you need to validate or iterate over rule categories.
 *
 * @example
 * ```typescript
 * function processCategory(category: RuleCategory) {
 *   // category can be "punctuation" | "structure" | "vocabulary" | etc.
 * }
 * ```
 */
export type RuleCategory = keyof RuleConfigs;

/**
 * Generic type for rule names within a specific category.
 *
 * Given a rule category (e.g., "punctuation"), this type resolves to the union
 * of all rule names within that category (e.g., "period_quote" | "oxford_comma" | etc.).
 *
 * @template C - The rule category (e.g., "punctuation", "burstiness")
 *
 * @example
 * ```typescript
 * type PunctuationRuleNames = RuleName<"punctuation">;
 * // Resolves to: "period_quote" | "oxford_comma" | "em_dash" | "semicolon_to_em_dash_ratio" | "parenthesis_to_em_dash_ratio"
 *
 * type BurstinessRuleNames = RuleName<"burstiness">;
 * // Resolves to: "coefficient_of_variation" | "fano_factor" | "length_range"
 * ```
 */
export type RuleName<C extends RuleCategory> =
  RuleConfigs[C] extends infer R ? (R extends object ? keyof R : never) : never;

/**
 * Exhaustive list of all rule category names as an array constant.
 *
 * This array includes every top-level category in the RuleConfigs interface.
 * Use this when you need to iterate over all categories or validate that a string
 * is a valid rule category.
 *
 * @example
 * ```typescript
 * RULE_CATEGORIES.forEach(category => {
 *   console.log(`Processing category: ${category}`);
 * });
 *
 * const isValidCategory = (name: string): name is RuleCategory =>
 *   RULE_CATEGORIES.includes(name as RuleCategory);
 * ```
 */
export const RULE_CATEGORIES: RuleCategory[] = [
  "punctuation",
  "structure",
  "vocabulary",
  "burstiness",
  "ngram",
  "content",
  "syntactic",
  "perplexity",
  "detectgpt",
  "fast_detectgpt",
  "binoculars",
];
