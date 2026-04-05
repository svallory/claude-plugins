#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
N-gram analyzer for AI text detection.

Performs comprehensive n-gram analysis (2-6 grams) to identify AI text patterns.
Detects common AI phrases and classifies text as likely_ai, likely_human, or uncertain.

Usage:
    echo "text to analyze" | python3 ngram-analyzer.py
    python3 ngram-analyzer.py "text to analyze"
"""

import sys
from pathlib import Path
# Add lib directories to path
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
sys.path.insert(0, str(Path(__file__).parent / "lib"))

# Try to import from new module structure with fallback
try:
    from config_loader import get_config_from_env
    from threshold import get_threshold, check_threshold
    CONTEXT_AVAILABLE = True
except ImportError:
    CONTEXT_AVAILABLE = False
    def get_config_from_env():
        return {"media": "unknown"}
    def get_threshold(category, rule, context=None):
        return None
    def check_threshold(category, rule, value, context=None, direction="above"):
        return None

import json
from collections import Counter
from typing import List, Dict, Tuple
import nltk
from nltk.tokenize import word_tokenize

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)


def extract_ngrams(text: str, n: int) -> List[Tuple[str, ...]]:
    """Extract n-grams from text."""
    tokens = word_tokenize(text.lower())
    return list(nltk.ngrams(tokens, n))


def analyze_ngrams(text: str, n_values: List[int] = [2, 3, 4, 5, 6]) -> Dict:
    """
    Comprehensive n-gram analysis.

    Returns metrics for each n-gram size including TTR, hapax ratio,
    repetition rate, and top n-grams.
    """
    results = {}

    for n in n_values:
        ngrams = extract_ngrams(text, n)
        freq_dist = Counter(ngrams)

        total = len(ngrams)
        unique = len(freq_dist)

        if total == 0:
            continue

        # Type-token ratio (vocabulary richness)
        ttr = unique / total

        # Hapax legomena ratio (n-grams appearing only once)
        hapax = sum(1 for count in freq_dist.values() if count == 1)
        hapax_ratio = hapax / unique if unique > 0 else 0

        # Repetition rate
        repetitions = total - unique
        repetition_rate = repetitions / total if total > 0 else 0

        # Most common n-grams
        top_ngrams = freq_dist.most_common(10)

        results[f'{n}-gram'] = {
            'totalCount': total,
            'uniqueCount': unique,
            'typeTokenRatio': round(ttr, 4),
            'hapaxRatio': round(hapax_ratio, 4),
            'repetitionRate': round(repetition_rate, 4),
            'topNgrams': [[' '.join(ng), count] for ng, count in top_ngrams]
        }

    return results


def detect_ai_patterns(text: str) -> Dict:
    """
    Detect common AI phrases and patterns.

    Returns detected patterns and count.
    """
    ai_patterns = [
        "it's worth noting that",
        "in light of this",
        "it is important to",
        "this approach ensures",
        "in today's digital age",
        "when it comes to",
        "in the realm of",
        "let's dive into",
        "in conclusion",
        "to sum up",
    ]

    text_lower = text.lower()
    detected = []
    count = 0

    for pattern in ai_patterns:
        if pattern in text_lower:
            detected.append(pattern)
            # Count occurrences
            count += text_lower.count(pattern)

    return {
        'detected': detected,
        'count': count
    }


def classify_text(ngram_results: Dict, ai_patterns: Dict, context: Dict) -> Tuple[str, float, List[str]]:
    """
    Classify text as likely_ai, likely_human, or uncertain.

    Returns: (classification, confidence, signals)
    """
    signals = []
    scores = []

    # Extract 6-gram metrics (most discriminative)
    if '6-gram' in ngram_results:
        six_gram = ngram_results['6-gram']
        rep_rate = six_gram['repetitionRate']
        ttr = six_gram['typeTokenRatio']
        hapax = six_gram['hapaxRatio']

        # AI signals with context-aware thresholds
        if CONTEXT_AVAILABLE:
            rep_result = check_threshold('ngram', 'six_gram_repetition_rate', rep_rate, context, 'above')
            if rep_result and rep_result['shouldFlag']:
                signals.append(f"High 6-gram repetition: {rep_result['reason']}")
                scores.append(0.7)

            ttr_result = check_threshold('ngram', 'six_gram_ttr', ttr, context, 'below')
            if ttr_result and ttr_result['shouldFlag']:
                signals.append(f"Low 6-gram diversity: {ttr_result['reason']}")
                scores.append(0.6)
        else:
            # Fallback thresholds
            if rep_rate > 0.15:
                signals.append(f"High 6-gram repetition rate: {rep_rate}")
                scores.append(0.7)
            if ttr < 0.85:
                signals.append(f"Low 6-gram type-token ratio: {ttr}")
                scores.append(0.6)

        # Human signals
        if ttr > 0.95 and hapax > 0.9:
            signals.append(f"Very high diversity (TTR: {ttr}, hapax: {hapax})")
            scores.append(-0.7)

    # AI pattern detection with context-aware threshold
    pattern_count = ai_patterns['count']

    if CONTEXT_AVAILABLE:
        pattern_result = check_threshold('ngram', 'ai_pattern_count', pattern_count, context, 'above')
        if pattern_result and pattern_result['shouldFlag']:
            signals.append(f"AI patterns detected: {pattern_result['reason']}")
            scores.append(0.8)
        elif pattern_count > 0:
            signals.append(f"Some AI patterns detected ({pattern_count} occurrences)")
            scores.append(0.4)
    else:
        # Fallback thresholds
        if pattern_count >= 2:
            signals.append(f"Multiple AI patterns detected ({pattern_count} occurrences)")
            scores.append(0.8)
        elif pattern_count > 0:
            signals.append(f"Some AI patterns detected ({pattern_count} occurrences)")
            scores.append(0.4)

    # 4-gram and 5-gram metrics - use fallback thresholds
    if '4-gram' in ngram_results:
        four_gram = ngram_results['4-gram']
        if four_gram['repetitionRate'] > 0.25:
            signals.append(f"Elevated 4-gram repetition: {four_gram['repetitionRate']}")
            scores.append(0.3)

    if '5-gram' in ngram_results:
        five_gram = ngram_results['5-gram']
        if five_gram['typeTokenRatio'] > 0.9:
            signals.append(f"High 5-gram diversity: {five_gram['typeTokenRatio']}")
            scores.append(-0.3)

    # Compute aggregate score
    if scores:
        avg_score = sum(scores) / len(scores)
    else:
        avg_score = 0

    # Classification logic
    six_gram_rep = ngram_results.get('6-gram', {}).get('repetitionRate', 0)
    six_gram_ttr = ngram_results.get('6-gram', {}).get('typeTokenRatio', 1)
    six_gram_hapax = ngram_results.get('6-gram', {}).get('hapaxRatio', 0)

    # Get context-aware thresholds or use fallbacks
    if CONTEXT_AVAILABLE:
        rep_threshold_config = get_threshold('ngram', 'six_gram_repetition_rate', context)
        pattern_threshold_config = get_threshold('ngram', 'ai_pattern_count', context)

        rep_threshold = rep_threshold_config.get('ai_threshold', 0.15) if rep_threshold_config else 0.15
        pattern_threshold = pattern_threshold_config.get('ai_threshold', 2) if pattern_threshold_config else 2
    else:
        rep_threshold = 0.15
        pattern_threshold = 2
    
    if pattern_count >= pattern_threshold or six_gram_rep > rep_threshold:
        classification = 'likely_ai'
        confidence = min(0.95, 0.5 + abs(avg_score))
    elif six_gram_ttr > 0.95 and six_gram_hapax > 0.9:
        classification = 'likely_human'
        confidence = min(0.95, 0.5 + abs(avg_score))
    else:
        # Score-based classification
        if avg_score > 0.3:
            classification = 'likely_ai'
        elif avg_score < -0.3:
            classification = 'likely_human'
        else:
            classification = 'uncertain'
        confidence = min(0.95, 0.4 + abs(avg_score * 0.5))

    return classification, confidence, signals


def generate_summary(ngram_results: Dict, ai_patterns: Dict, classification: str, context: Dict) -> str:
    """Generate a human-readable summary."""
    signals = []

    if ai_patterns['count'] > 0:
        signals.append(f"{ai_patterns['count']} AI pattern(s) detected")

    if '6-gram' in ngram_results:
        six_gram = ngram_results['6-gram']


        # Get context-aware thresholds or use fallbacks
        if CONTEXT_AVAILABLE:
            rep_threshold_config = get_threshold('ngram', 'six_gram_repetition_rate', context)
            ttr_threshold_config = get_threshold('ngram', 'six_gram_ttr', context)

            rep_threshold = rep_threshold_config.get('ai_threshold', 0.15) if rep_threshold_config else 0.15
            ttr_threshold = ttr_threshold_config.get('ai_threshold', 0.85) if ttr_threshold_config else 0.85
        else:
            rep_threshold = 0.15
            ttr_threshold = 0.85
        
        if six_gram['repetitionRate'] > rep_threshold * 0.67:
            signals.append(f"Repetitive phrasing at 6-gram level")
        if six_gram['typeTokenRatio'] < ttr_threshold * 1.1:
            signals.append("Limited vocabulary diversity")

    summary = f"Classification: {classification}. "
    if signals:
        summary += " ".join(signals)
    else:
        summary += "No significant AI patterns detected."

    return summary


def main():
    """Main entry point."""
    # Get input text
    if len(sys.argv) > 1:
        text = sys.argv[1]
    else:
        text = sys.stdin.read().strip()

    if not text:
        print(json.dumps({'error': 'No text provided'}, indent=2), file=sys.stderr)
        sys.exit(1)

    # Get context
    context = get_config_from_env()
    word_count = len(word_tokenize(text))

    # Perform analysis
    ngram_results = analyze_ngrams(text)
    ai_patterns = detect_ai_patterns(text)
    classification, confidence, signals = classify_text(ngram_results, ai_patterns, context)
    summary = generate_summary(ngram_results, ai_patterns, classification, context)

    # Build output
    output = {
        'wordCount': word_count,
        'context': context,
        'ngrams': ngram_results,
        'aiPatterns': ai_patterns,
        'signals': signals,
        'classification': classification,
        'confidence': round(confidence, 4),
        'summary': summary
    }

    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
