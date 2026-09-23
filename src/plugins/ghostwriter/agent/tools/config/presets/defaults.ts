/**
 * defaults.ts
 *
 * Hardcoded default thresholds for all detection metrics.
 * These are the baseline values used when no context or config is specified.
 *
 * Uses snake_case field names for consistency with YAML configs.
 */

import type { RuleConfigs, RuleCategory, RuleName, BaseRuleConfig } from "../schemas/rules.schema";
import type { ProseTargets } from "../schemas/publication.schema";

/**
 * Default rule configurations organized by category.
 *
 * This is the baseline configuration used when no context or preset is specified.
 * Each rule category contains multiple metrics with `ai_threshold` and `human_baseline` values.
 *
 * Structure:
 * ```
 * {
 *   [category: RuleCategory]: {
 *     [ruleName: RuleName]: {
 *       ai_threshold: number,      // Threshold that indicates AI-generated text
 *       human_baseline: number     // Expected baseline for human-written text
 *     }
 *   }
 * }
 * ```
 *
 * Categories include:
 * - `punctuation` - Em dashes, commas, quotes, and punctuation ratios
 * - `structure` - Paragraph uniformity, bullet density, transitions
 * - `vocabulary` - AI-specific vocabulary markers
 * - `burstiness` - Sentence length variation metrics
 * - `ngram` - N-gram patterns and type-token ratio
 * - `content` - Hedging, cliches, superlatives, filler words
 * - `syntactic` - Dependency depth and sentence type uniformity
 * - `perplexity` - GPT-2 perplexity scoring
 * - `detectgpt` - FastDetectGPT detection score
 *
 * These defaults serve as the foundation for all context-aware and preset-based
 * configurations. Presets and context-specific configs override these values.
 *
 * @type {RuleConfigs}
 */
export const DEFAULT_RULES: RuleConfigs = {
  // ============================================
  // Punctuation rules
  // ============================================
  punctuation: {
    period_quote: {
      ai_threshold: 97,
      human_baseline: 85,
    },
    oxford_comma: {
      ai_threshold: 95,
      human_baseline: 75,
    },
    em_dash: {
      ai_threshold: 2.5,
      human_baseline: 1.5,
    },
    semicolon_to_em_dash_ratio: {
      ai_threshold: 0.5,
      human_baseline: 1.5,
    },
    parenthesis_to_em_dash_ratio: {
      ai_threshold: 1.0,
      human_baseline: 2.0,
    },
  },

  // ============================================
  // Structure rules
  // ============================================
  structure: {
    paragraph_fano_factor: {
      ai_threshold: 0.5,
      human_baseline: 1.2,
    },
    bullet_density: {
      ai_threshold: 3,
      human_baseline: 1,
    },
    transition_density: {
      ai_threshold: 20,
      human_baseline: 10,
    },
  },

  // ============================================
  // Vocabulary rules
  // ============================================
  vocabulary: {
    ai_vocab_density: {
      ai_threshold: 15,
      human_baseline: 3,
    },
  },

  // ============================================
  // Burstiness rules
  // ============================================
  burstiness: {
    coefficient_of_variation: {
      ai_threshold: 30,
      human_baseline: 50,
    },
    fano_factor: {
      ai_threshold: 0.8,
      human_baseline: 1.5,
    },
    length_range: {
      ai_threshold: 10,
      human_baseline: 25,
    },
  },

  // ============================================
  // N-gram rules
  // ============================================
  ngram: {
    six_gram_repetition_rate: {
      ai_threshold: 0.3,
      human_baseline: 0.1,
    },
    six_gram_ttr: {
      ai_threshold: 0.3,
      human_baseline: 0.8,
    },
    ai_pattern_count: {
      ai_threshold: 2,
      human_baseline: 0,
    },
  },

  // ============================================
  // Content rules
  // ============================================
  content: {
    hedging: {
      ai_threshold: 10,
      human_baseline: 5,
    },
    cliche: {
      ai_threshold: 2,
      human_baseline: 0,
    },
    superlative: {
      ai_threshold: 8,
      human_baseline: 4,
    },
    filler: {
      ai_threshold: 2,
      human_baseline: 0,
    },
  },

  // ============================================
  // Syntactic rules
  // ============================================
  syntactic: {
    avg_dependency_depth: {
      ai_threshold: 3.5,
      // Human avg depth 4-8 (spaCy dependency parse). Target: midpoint.
      // Ref: Ju, Blix & Williams 2025 "Domain Regeneration" (ACL, arXiv:2505.07784)
      human_baseline: 6.0,
    },
    sentence_type_uniformity: {
      ai_threshold: 0.7,
      human_baseline: 0.5,
    },
  },

  // ============================================
  // Perplexity rules
  // ============================================
  perplexity: {
    perplexity: {
      ai_threshold: 20,
      human_baseline: 80,
    },
  },

  // ============================================
  // DetectGPT rules
  // ============================================
  detectgpt: {
    d_score: {
      ai_threshold: 2.0,
      human_baseline: 0.5,
    },
  },

  // ============================================
  // Fast-DetectGPT rules
  // ============================================
  fast_detectgpt: {
    probability: {
      ai_threshold: 0.70,
      human_baseline: 0.30,
    },
  },

  // ============================================
  // Binoculars rules
  // ============================================
  binoculars: {
    score: {
      ai_threshold: 0.8536,
      human_baseline: 1.2,
    },
  },
};

/**
 * Default prose targets for humanization tools.
 *
 * These are the baseline target values for writer analysis tools.
 * Presets can override these via `writing_style.prose.*`.
 */
export const DEFAULT_PROSE_TARGETS: Required<ProseTargets> = {
  pronoun_density: 5.0,
  auxiliary_density: 3.0,
  noun_density: 20.0,
  em_dash_density: 1.5,
  em_dash_min_density: 1.0,
  max_dependency_depth: 5.0,
  max_uniformity: 0.8,
  min_compound_complex_ratio: 0.05,
  min_depth_variance: 1.0,
};

/**
 * Retrieve default rule configuration for a specific category and rule name.
 *
 * This function provides type-safe access to default thresholds from {@link DEFAULT_RULES}.
 * It's useful for understanding what the baseline behavior is before any customization.
 *
 * @param {RuleCategory} category - The rule category (e.g., "punctuation", "vocabulary")
 * @param {string} rule - The specific rule name within the category (e.g., "period_quote", "ai_vocab_density")
 *
 * @returns {BaseRuleConfig | undefined} An object with `ai_threshold` and `human_baseline` properties,
 *                                       or `undefined` if the category or rule doesn't exist.
 *
 * @example
 * ```typescript
 * // Get the default threshold for period-quote punctuation
 * const threshold = getDefaultThreshold("punctuation", "period_quote");
 * if (threshold) {
 *   console.log(`AI Threshold: ${threshold.ai_threshold}`);      // 97
 *   console.log(`Human Baseline: ${threshold.human_baseline}`);  // 85
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Check for a non-existent rule
 * const missing = getDefaultThreshold("vocabulary", "nonexistent");
 * console.log(missing); // undefined
 * ```
 *
 * @example
 * ```typescript
 * // Loop through all vocabulary rules
 * const vocabRules = ["ai_vocab_density"];
 * vocabRules.forEach(rule => {
 *   const config = getDefaultThreshold("vocabulary", rule);
 *   if (config) {
 *     console.log(`${rule}: AI=${config.ai_threshold}, Human=${config.human_baseline}`);
 *   }
 * });
 * ```
 */
export function getDefaultThreshold(
  category: RuleCategory,
  rule: string
): BaseRuleConfig | undefined {
  const categoryConfig = DEFAULT_RULES[category];
  if (!categoryConfig) return undefined;
  return categoryConfig[rule as keyof typeof categoryConfig];
}
