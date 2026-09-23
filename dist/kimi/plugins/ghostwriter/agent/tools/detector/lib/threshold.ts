/**
 * threshold.ts
 *
 * Detection-specific threshold checking logic.
 * Retrieves rule configs and compares measured values against AI thresholds.
 */

import type {
  ResolvedWritingConfig,
  BaseRuleConfig,
  RuleCategory,
} from '../../config/schemas';

/**
 * Get threshold configuration for a rule from a resolved config.
 *
 * Retrieves the configuration object for a specific rule within a rule category.
 * Returns null if the rule is disabled or doesn't exist for the given config context.
 *
 * @param category - Rule category (e.g., "vocabulary", "punctuation", "structure")
 * @param rule - Rule name within the category (e.g., "ai_vocab_density")
 * @param config - Resolved writing config
 * @returns BaseRuleConfig object with thresholds, or null if rule is disabled or not found
 */
export function getThreshold(
  category: RuleCategory,
  rule: string,
  config: ResolvedWritingConfig,
): BaseRuleConfig | null {
  // Get the category configuration
  const categoryConfig = config.rules[category];
  if (!categoryConfig) {
    return null;
  }

  // Get the rule configuration (use type assertion due to complex nested types)
  const ruleConfig = (
    categoryConfig as Record<string, BaseRuleConfig | undefined>
  )[rule];
  if (!ruleConfig || ruleConfig.disabled) {
    return null;
  }

  return ruleConfig;
}

/**
 * Check if a rule should trigger an AI signal based on config.
 *
 * Compares a measured value against the AI threshold for a rule and determines
 * whether it signals AI-generated content. Returns null if the rule is disabled
 * for the given context.
 *
 * The direction parameter controls the comparison:
 * - "above": signals AI if value > ai_threshold (e.g., RepetitionRate > 0.8)
 * - "below": signals AI if value < ai_threshold (e.g., Perplexity < 20)
 *
 * @param category - Rule category (e.g., "vocabulary", "punctuation", "structure")
 * @param rule - Rule name within the category (e.g., "ai_vocab_density")
 * @param value - Measured value to check against threshold
 * @param config - Resolved writing config
 * @param direction - Comparison direction: "above" (default) or "below"
 * @returns Object with `shouldFlag` (boolean) and `reason` (string), or null if rule
 *          is disabled or unreliable for the given context
 */
export function checkThreshold(
  category: RuleCategory,
  rule: string,
  value: number,
  config: ResolvedWritingConfig,
  direction: 'above' | 'below' = 'above',
): { shouldFlag: boolean; reason: string } | null {
  // Get the threshold
  const threshold = getThreshold(category, rule, config);

  // Rule disabled for this context
  if (!threshold) {
    return null;
  }

  // Threshold is null = unreliable for this context
  if (threshold.ai_threshold === null || threshold.ai_threshold === undefined) {
    return {
      shouldFlag: false,
      reason: `${category}.${rule} unreliable for ${config.publication.media}`,
    };
  }

  // Auto-disable when human baseline exceeds AI threshold (rule not useful)
  if (threshold.human_baseline !== undefined && threshold.human_baseline !== null) {
    if (direction === 'above' && threshold.human_baseline >= threshold.ai_threshold) {
      return null;
    }
    if (direction === 'below' && threshold.human_baseline <= threshold.ai_threshold) {
      return null;
    }
  }

  const shouldFlag =
    direction === 'above'
      ? value > threshold.ai_threshold
      : value < threshold.ai_threshold;

  const reason = shouldFlag
    ? `${category}.${rule}: ${value.toFixed(2)} ${direction === 'above' ? '>' : '<'} ${threshold.ai_threshold} (AI threshold for ${config.publication.media})`
    : '';

  return { shouldFlag, reason };
}
