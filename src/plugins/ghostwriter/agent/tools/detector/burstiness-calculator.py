#!/usr/bin/env python3
"""
Burstiness Calculator - AI Text Detection Tool

Calculates burstiness metrics for detecting AI-generated text based on:
- Coefficient of Variation (CV) of sentence lengths
- Fano Factor (variance / mean)
- Uniformity Score
- Sentence length statistics

Supports context-aware thresholds for different media types.

Output: JSON with metrics, signals, classification, and confidence

Usage:
    python3 burstiness-calculator.py "Your text here"
    echo "Your text here" | python3 burstiness-calculator.py
"""

import json
import sys
import os
from typing import Dict, List, Tuple, Optional
from statistics import mean, stdev, variance
from pathlib import Path

# Add lib directories to path
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
sys.path.insert(0, str(Path(__file__).parent / "lib"))

try:
    import nltk
    from nltk.tokenize import sent_tokenize
except ImportError:
    print(
        json.dumps(
            {
                "error": "nltk not installed. Install with: pip install nltk numpy"
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import numpy as np
except ImportError:
    print(
        json.dumps(
            {
                "error": "numpy not installed. Install with: pip install nltk numpy"
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from config_loader import get_config_from_env
    from threshold import get_threshold, check_threshold
except ImportError:
    # Fallback if modules not available
    def get_config_from_env():
        return {"media": "unknown"}
    def get_threshold(category, rule, context=None):
        if category == "burstiness":
            defaults = {
                "coefficient_of_variation": {"ai_threshold": 30, "human_baseline": 50},
                "fano_factor": {"ai_threshold": 0.8, "human_baseline": 1.5},
                "length_range": {"ai_threshold": 10, "human_baseline": 25},
            }
            return defaults.get(rule)
        return None
    def check_threshold(category, rule, value, context=None, direction="above"):
        return None

# Download punkt_tab tokenizer if not already present
try:
    nltk.data.find("tokenizers/punkt_tab")
except LookupError:
    try:
        nltk.download("punkt_tab", quiet=True)
    except Exception:
        # Fallback to punkt for older versions
        try:
            nltk.data.find("tokenizers/punkt")
        except LookupError:
            nltk.download("punkt", quiet=True)


def tokenize_sentences(text: str) -> List[str]:
    """
    Tokenize text into sentences using NLTK.

    Args:
        text: Input text to tokenize

    Returns:
        List of sentences
    """
    sentences = sent_tokenize(text)
    return [s.strip() for s in sentences if s.strip()]


def calculate_sentence_lengths(sentences: List[str]) -> List[int]:
    """
    Calculate word count for each sentence.

    Args:
        sentences: List of sentences

    Returns:
        List of sentence lengths (word counts)
    """
    return [len(s.split()) for s in sentences]


def calculate_metrics(
    lengths: List[int],
) -> Tuple[float, float, float, float, float, int, int, int]:
    """
    Calculate burstiness metrics from sentence lengths.

    Args:
        lengths: List of sentence lengths (word counts)

    Returns:
        Tuple of (mean, std_dev, variance, cv, fano, min, max, range)
    """
    if not lengths:
        raise ValueError("No sentences to analyze")

    if len(lengths) < 2:
        raise ValueError("Need at least 2 sentences for burstiness calculation")

    length_mean = mean(lengths)
    length_std = stdev(lengths)
    length_variance = variance(lengths)
    length_min = min(lengths)
    length_max = max(lengths)
    length_range = length_max - length_min

    # Coefficient of Variation (CV) - scaled by 100
    cv = (length_std / length_mean * 100) if length_mean > 0 else 0

    # Fano Factor
    fano = (length_variance / length_mean) if length_mean > 0 else 0

    return (
        length_mean,
        length_std,
        length_variance,
        cv,
        fano,
        length_min,
        length_max,
        length_range,
    )


def calculate_uniformity_score(mean_val: float, std_dev: float) -> float:
    """
    Calculate uniformity score.

    Uniformity = 1 - (std / mean)
    Higher score = more uniform/AI-like

    Args:
        mean_val: Mean sentence length
        std_dev: Standard deviation

    Returns:
        Uniformity score (0-1)
    """
    if mean_val <= 0:
        return 1.0
    return max(0, 1 - (std_dev / mean_val))


def detect_signals(
    cv: float,
    fano: float,
    length_range: int,
    length_min: int,
    length_max: int,
    length_mean: float,
    length_std: float,
    context: dict,
) -> List[str]:
    """
    Detect AI and human text signals based on burstiness metrics.

    Args:
        cv: Coefficient of Variation
        fano: Fano Factor
        length_range: Range of sentence lengths
        length_min: Minimum sentence length
        length_max: Maximum sentence length
        length_mean: Mean sentence length
        length_std: Standard deviation
        context: Detection context

    Returns:
        List of detected signals
    """
    signals = []

    # CV signals - use context-aware thresholds
    cv_check_ai = check_threshold("burstiness", "coefficient_of_variation", cv, context, "below")
    if cv_check_ai and cv_check_ai.get("shouldFlag"):
        signals.append(f"Low CV ({cv:.1f}): uniform sentence lengths (AI-like)")

    cv_threshold = get_threshold("burstiness", "coefficient_of_variation", context)
    if cv_threshold and cv > cv_threshold.get("human_baseline", 60):
        signals.append(f"High CV ({cv:.1f}): varied sentence lengths (human-like)")

    # Fano Factor signals
    fano_check_ai = check_threshold("burstiness", "fano_factor", fano, context, "below")
    if fano_check_ai and fano_check_ai.get("shouldFlag"):
        signals.append(f"Low Fano Factor ({fano:.2f}): underdispersed/uniform (AI-like)")

    fano_threshold = get_threshold("burstiness", "fano_factor", context)
    if fano_threshold and fano > fano_threshold.get("human_baseline", 1.5):
        signals.append(f"High Fano Factor ({fano:.2f}): overdispersed/bursty (human-like)")

    # Length range signals
    range_check_ai = check_threshold("burstiness", "length_range", length_range, context, "below")
    if range_check_ai and range_check_ai.get("shouldFlag"):
        signals.append(f"Narrow length range ({length_range}): limited variety (AI-like)")

    range_threshold = get_threshold("burstiness", "length_range", context)
    if range_threshold and length_range > range_threshold.get("human_baseline", 25):
        signals.append(f"Wide length range ({length_range}): diverse lengths (human-like)")

    # Characteristic sentence lengths (AI: 12-18 words)
    if 12 <= length_mean <= 18 and length_std < 5:
        signals.append("Characteristic AI range: 12-18 word sentences with low variance")

    # Very short sentences (human signal)
    if length_min < 5:
        signals.append("Very short sentences detected (human signal)")

    # Very long sentences (human signal)
    if length_max > 35:
        signals.append("Very long sentences detected (human signal)")

    return signals


def classify_text(
    cv: float, fano: float, length_range: int, signals: List[str], context: dict
) -> Tuple[str, float, str]:
    """
    Classify text as AI or human based on burstiness metrics.

    Classification logic:
    - Uses context-aware thresholds
    - CV and Fano Factor are primary indicators
    - Length range provides supporting evidence

    Args:
        cv: Coefficient of Variation
        fano: Fano Factor
        length_range: Range of sentence lengths
        signals: List of detected signals
        context: Detection context

    Returns:
        Tuple of (classification, confidence, summary)
    """
    score = 0

    # Get context-aware thresholds
    cv_threshold = get_threshold("burstiness", "coefficient_of_variation", context) or {}
    fano_threshold = get_threshold("burstiness", "fano_factor", context) or {}
    range_threshold = get_threshold("burstiness", "length_range", context) or {}

    cv_ai = cv_threshold.get("ai_threshold", 30)
    cv_human = cv_threshold.get("human_baseline", 50)
    fano_ai = fano_threshold.get("ai_threshold", 0.8)
    fano_human = fano_threshold.get("human_baseline", 1.5)
    range_ai = range_threshold.get("ai_threshold", 10)
    range_human = range_threshold.get("human_baseline", 25)

    # CV contribution
    if cv_ai is not None and cv < cv_ai:
        score -= 2
    elif cv > cv_human:
        score += 2

    # Fano Factor contribution
    if fano_ai is not None and fano < fano_ai:
        score -= 2
    elif fano > fano_human:
        score += 2

    # Length range contribution
    if range_ai is not None and length_range < range_ai:
        score -= 1
    elif length_range > range_human:
        score += 1

    # Determine classification and confidence
    if cv_ai is not None and fano_ai is not None and cv < cv_ai and fano < fano_ai:
        classification = "likely_ai"
        confidence = 0.95
        summary = f"Strong AI indicators: both CV and Fano Factor show uniformity ({context.get('media', 'unknown')} context)"
    elif cv > cv_human and fano > fano_human:
        classification = "likely_human"
        confidence = 0.95
        summary = f"Strong human indicators: both CV and Fano Factor show high variation ({context.get('media', 'unknown')} context)"
    elif score <= -3:
        classification = "likely_ai"
        confidence = 0.75
        summary = f"Multiple AI signals detected (uniform sentence structure, {context.get('media', 'unknown')} context)"
    elif score <= -1:
        classification = "likely_ai"
        confidence = 0.55
        summary = f"Some AI signals present (moderate uniformity, {context.get('media', 'unknown')} context)"
    elif score >= 3:
        classification = "likely_human"
        confidence = 0.75
        summary = f"Multiple human signals detected (varied sentence structure, {context.get('media', 'unknown')} context)"
    elif score >= 1:
        classification = "likely_human"
        confidence = 0.55
        summary = f"Some human signals present (moderate variation, {context.get('media', 'unknown')} context)"
    else:
        classification = "uncertain"
        confidence = 0.40
        summary = f"Conflicting signals; inconclusive classification ({context.get('media', 'unknown')} context)"

    return classification, confidence, summary


def calculate_burstiness(text: str) -> Dict:
    """
    Calculate comprehensive burstiness metrics for text.

    Args:
        text: Input text to analyze

    Returns:
        Dictionary with metrics, signals, and classification
    """
    # Get context from environment
    context = get_config_from_env()

    if not text or not text.strip():
        return {
            "error": "Empty text provided",
            "sentenceCount": 0,
            "lengths": {
                "mean": 0,
                "stdDev": 0,
                "variance": 0,
                "min": 0,
                "max": 0,
                "range": 0,
            },
            "metrics": {
                "coefficientOfVariation": 0,
                "fanoFactor": 0,
                "uniformityScore": 0,
            },
            "signals": [],
            "classification": "error",
            "confidence": 0,
            "context": context,
            "summary": "Cannot analyze empty text",
        }

    try:
        # Tokenize
        sentences = tokenize_sentences(text)

        if len(sentences) < 2:
            return {
                "error": f"Need at least 2 sentences; found {len(sentences)}",
                "sentenceCount": len(sentences),
                "lengths": {
                    "mean": 0,
                    "stdDev": 0,
                    "variance": 0,
                    "min": 0,
                    "max": 0,
                    "range": 0,
                },
                "metrics": {
                    "coefficientOfVariation": 0,
                    "fanoFactor": 0,
                    "uniformityScore": 0,
                },
                "signals": [],
                "classification": "error",
                "confidence": 0,
                "context": context,
                "summary": "Insufficient text for analysis",
            }

        # Calculate lengths
        lengths = calculate_sentence_lengths(sentences)

        # Calculate metrics
        (
            length_mean,
            length_std,
            length_variance,
            cv,
            fano,
            length_min,
            length_max,
            length_range,
        ) = calculate_metrics(lengths)

        # Calculate uniformity
        uniformity = calculate_uniformity_score(length_mean, length_std)

        # Detect signals (now context-aware)
        signals = detect_signals(
            cv, fano, length_range, length_min, length_max, length_mean, length_std, context
        )

        # Classify (now context-aware)
        classification, confidence, summary = classify_text(
            cv, fano, length_range, signals, context
        )

        return {
            "sentenceCount": len(sentences),
            "lengths": {
                "mean": round(length_mean, 2),
                "stdDev": round(length_std, 2),
                "variance": round(length_variance, 2),
                "min": int(length_min),
                "max": int(length_max),
                "range": int(length_range),
            },
            "metrics": {
                "coefficientOfVariation": round(cv, 2),
                "fanoFactor": round(fano, 2),
                "uniformityScore": round(uniformity, 2),
            },
            "signals": signals,
            "classification": classification,
            "confidence": round(confidence, 2),
            "context": context,
            "summary": summary,
        }

    except ValueError as e:
        return {
            "error": str(e),
            "sentenceCount": 0,
            "lengths": {
                "mean": 0,
                "stdDev": 0,
                "variance": 0,
                "min": 0,
                "max": 0,
                "range": 0,
            },
            "metrics": {
                "coefficientOfVariation": 0,
                "fanoFactor": 0,
                "uniformityScore": 0,
            },
            "signals": [],
            "classification": "error",
            "confidence": 0,
            "context": context,
            "summary": str(e),
        }


def main():
    """Main entry point."""
    # Get text from command line argument or stdin
    text = None

    if len(sys.argv) > 1:
        # Use command line argument
        text = " ".join(sys.argv[1:])
    else:
        # Try to read from stdin
        if not sys.stdin.isatty():
            text = sys.stdin.read()
        else:
            print(
                json.dumps(
                    {
                        "error": "No text provided. Usage: burstiness-calculator.py 'text' or echo 'text' | burstiness-calculator.py"
                    }
                )
            )
            sys.exit(1)

    # Calculate and output JSON
    result = calculate_burstiness(text)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
