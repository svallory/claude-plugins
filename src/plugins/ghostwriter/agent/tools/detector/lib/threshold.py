"""
threshold.py

Detection-specific threshold checking logic.
Retrieves rule configs and compares measured values against AI thresholds.
"""

from typing import Any, Dict, Optional


def get_threshold(
    category: str,
    rule: str,
    config: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Get threshold configuration for a rule.

    Args:
        category: Category name (e.g., "punctuation", "burstiness")
        rule: Rule name (e.g., "period_quote", "coefficient_of_variation")
        config: Resolved writing configuration

    Returns:
        ThresholdConfig dict or None if rule is disabled
    """
    rules = config.get("rules", {})
    category_config = rules.get(category, {})
    rule_config = category_config.get(rule)

    if rule_config and rule_config.get("disabled"):
        return None

    return rule_config


def check_threshold(
    category: str,
    rule: str,
    value: float,
    config: Dict[str, Any],
    direction: str = "above"
) -> Optional[Dict[str, Any]]:
    """
    Check if a rule should trigger an AI signal.

    Args:
        category: Category name (e.g., "punctuation", "burstiness")
        rule: Rule name (e.g., "period_quote", "coefficient_of_variation")
        value: The measured value to check against the threshold
        config: Resolved writing configuration
        direction: "above" if value should be above threshold to signal AI,
                   "below" if value should be below threshold to signal AI

    Returns:
        Dict with shouldFlag and reason, or None if rule disabled
    """
    threshold = get_threshold(category, rule, config)

    if threshold is None:
        return None

    ai_threshold = threshold.get("ai_threshold")

    if ai_threshold is None:
        media = config.get("publication", {}).get("media", "unknown")
        return {"shouldFlag": False, "reason": f"{category}.{rule} unreliable for {media}"}

    if direction == "above":
        should_flag = value > ai_threshold
    else:
        should_flag = value < ai_threshold

    media = config.get("publication", {}).get("media", "unknown")
    reason = (
        f"{category}.{rule}: {value:.2f} {'>' if direction == 'above' else '<'} {ai_threshold} (AI threshold for {media})"
        if should_flag
        else ""
    )

    return {"shouldFlag": should_flag, "reason": reason}
