#!/usr/bin/env python3
"""
Syntactic Complexity Analyzer - AI Text Detection Tool

Analyzes syntactic complexity metrics for detecting AI-generated text based on:
- Dependency depth (max depth, mean, variance)
- Sentence type classification (simple, compound, complex, compound-complex)
- POS distribution (NOUN, AUX, PRON, etc.)
- Branching factor (average children per non-leaf node)
- Clause count and clauses per sentence
- Flesch-Kincaid readability metrics

Key AI indicators:
- Shallow dependency depth (avg < 5)
- Low depth variance
- Missing compound-complex sentences (<5%)
- Elevated AUX (40-58% higher than human baseline)
- Reduced NOUN (17-18% vs 20% human)
- Elevated PRON (6-7% vs 5% human)

Output: JSON with comprehensive metrics, signals, classification, and confidence

Usage:
    python3 syntactic-complexity.py "Your text here"
    echo "Your text here" | python3 syntactic-complexity.py
"""

import json
import sys
import os
from typing import Dict, List, Tuple, Optional
from statistics import mean, stdev, variance
import re
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

try:
    import spacy
except ImportError:
    print(
        json.dumps(
            {
                "error": "spacy not installed. Install with: pip install spacy"
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)

# Try to load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(
        json.dumps(
            {
                "error": "spacy model 'en_core_web_sm' not found. Install with: python -m spacy download en_core_web_sm"
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)


def count_syllables(word: str) -> int:
    """
    Estimate syllable count using vowel groups.

    Args:
        word: Word to count syllables in

    Returns:
        Estimated syllable count (minimum 1)
    """
    word = word.lower()
    syllable_count = 0
    vowels = "aeiouy"
    previous_was_vowel = False

    for char in word:
        is_vowel = char in vowels
        if is_vowel and not previous_was_vowel:
            syllable_count += 1
        previous_was_vowel = is_vowel

    # Adjust for silent e
    if word.endswith("e"):
        syllable_count -= 1

    # Adjust for le
    if word.endswith("le") and len(word) > 2 and word[-3] not in vowels:
        syllable_count += 1

    # Minimum 1 syllable
    return max(1, syllable_count)


def get_dependency_depth(token) -> int:
    """
    Calculate maximum dependency depth from a token to its deepest child.

    Args:
        token: spaCy token to analyze

    Returns:
        Maximum depth in dependency tree
    """
    if not list(token.children):
        return 0
    return 1 + max((get_dependency_depth(child) for child in token.children), default=0)


def calculate_dependency_depths(doc) -> List[int]:
    """
    Calculate maximum dependency depth for each sentence.

    Args:
        doc: spaCy Doc object

    Returns:
        List of max depths for each sentence
    """
    depths = []

    for sent in doc.sents:
        # Find root token (token whose head is itself)
        root = [t for t in sent if t.head == t]
        if root:
            depths.append(get_dependency_depth(root[0]))
        else:
            depths.append(0)

    return depths


def classify_sentence_types(doc) -> Dict:
    """
    Classify sentences into simple, compound, complex, compound-complex.

    Args:
        doc: spaCy Doc object

    Returns:
        Dictionary with counts and ratios
    """
    classifications = {
        "simple": 0,
        "compound": 0,
        "complex": 0,
        "compoundComplex": 0,
    }

    clause_markers = ["ccomp", "xcomp", "advcl", "relcl", "acl", "csubj"]
    coord_markers = ["cc", "conj"]

    for sent in doc.sents:
        clauses = sum(1 for t in sent if t.dep_ in clause_markers)
        coordinations = sum(1 for t in sent if t.dep_ in coord_markers)

        has_subordination = clauses > 0
        has_coordination = coordinations > 0

        if not has_subordination and not has_coordination:
            classifications["simple"] += 1
        elif has_coordination and not has_subordination:
            classifications["compound"] += 1
        elif has_subordination and not has_coordination:
            classifications["complex"] += 1
        else:
            classifications["compoundComplex"] += 1

    total = len(list(doc.sents))
    ratios = {k: round(v / total, 4) if total > 0 else 0 for k, v in classifications.items()}

    return {
        "simple": {"count": classifications["simple"], "ratio": ratios["simple"]},
        "compound": {"count": classifications["compound"], "ratio": ratios["compound"]},
        "complex": {"count": classifications["complex"], "ratio": ratios["complex"]},
        "compoundComplex": {
            "count": classifications["compoundComplex"],
            "ratio": ratios["compoundComplex"],
        },
    }


def calculate_pos_distribution(doc) -> Dict[str, float]:
    """
    Calculate POS tag distribution.

    Args:
        doc: spaCy Doc object

    Returns:
        Dictionary mapping POS tags to percentages
    """
    pos_counts = {}
    total = len([t for t in doc if not t.is_punct])  # Exclude punctuation

    for token in doc:
        if not token.is_punct:
            pos = token.pos_
            pos_counts[pos] = pos_counts.get(pos, 0) + 1

    pos_dist = {
        pos: round((count / total) * 100, 2) if total > 0 else 0
        for pos, count in sorted(pos_counts.items())
    }

    return pos_dist


def calculate_branching_factor(doc) -> float:
    """
    Calculate average branching factor (children per non-leaf node).

    Args:
        doc: spaCy Doc object

    Returns:
        Average branching factor
    """
    non_leaf_tokens = [t for t in doc if list(t.children)]

    if not non_leaf_tokens:
        return 0.0

    branching_factors = [len(list(t.children)) for t in non_leaf_tokens]
    return round(mean(branching_factors), 2)


def calculate_clause_count(doc) -> Tuple[int, float]:
    """
    Count clause markers and calculate clauses per sentence.

    Args:
        doc: spaCy Doc object

    Returns:
        Tuple of (total clauses, clauses per sentence)
    """
    clause_markers = ["ccomp", "xcomp", "advcl", "relcl", "acl", "csubj"]
    clause_count = sum(1 for t in doc if t.dep_ in clause_markers)

    sent_count = len(list(doc.sents))
    clauses_per_sent = round(clause_count / sent_count, 2) if sent_count > 0 else 0

    return clause_count, clauses_per_sent


def calculate_flesch_kincaid(text: str, doc) -> Dict[str, float]:
    """
    Calculate Flesch Reading Ease and Flesch-Kincaid Grade Level.

    Args:
        text: Original text
        doc: spaCy Doc object (for word count)

    Returns:
        Dictionary with FRE and FKGL scores
    """
    # Count sentences (using doc.sents for consistency)
    sent_count = len(list(doc.sents))

    # Count words (tokens, excluding punctuation)
    words = [t for t in doc if not t.is_punct]
    word_count = len(words)

    if sent_count == 0 or word_count == 0:
        return {"fleschReadingEase": 0, "fleschKincaidGrade": 0}

    # Count syllables
    syllable_count = sum(count_syllables(t.text) for t in words)

    asl = word_count / sent_count  # Average sentence length
    asw = syllable_count / word_count  # Average syllables per word

    # Flesch Reading Ease (0-100, higher = easier)
    fre = 206.835 - (1.015 * asl) - (84.6 * asw)
    fre = round(max(0, min(100, fre)), 1)  # Clamp 0-100

    # Flesch-Kincaid Grade Level
    fkgl = (0.39 * asl) + (11.8 * asw) - 15.59
    fkgl = round(max(0, fkgl), 1)  # Ensure non-negative

    return {"fleschReadingEase": fre, "fleschKincaidGrade": fkgl}


def calculate_uniformity_score(mean_val: float, std_dev: float) -> float:
    """
    Calculate sentence length uniformity score.
    Higher = more uniform = more AI-like.

    Args:
        mean_val: Mean sentence length
        std_dev: Standard deviation

    Returns:
        Uniformity score (0-1)
    """
    if mean_val <= 0:
        return 1.0
    uniformity = 1.0 - (std_dev / mean_val)
    return round(max(0, min(1, uniformity)), 3)


def extract_ai_signals(analysis: Dict, context: Dict) -> List[str]:
    """
    Extract AI detection signals from analysis using context-aware thresholds.

    Args:
        analysis: Complete analysis dictionary
        context: Writing context

    Returns:
        List of AI signal descriptions
    """
    signals = []

    # Compound-complex check (fallback threshold)
    cc_ratio = analysis["sentenceTypes"]["compoundComplex"]["ratio"]
    if cc_ratio < 0.05:
        signals.append("Missing compound-complex sentences (ratio < 0.05)")

    # Depth variance check (fallback threshold)
    depth_var = analysis["dependencyDepth"]["variance"]
    if depth_var < 1.0:
        signals.append("Low depth variance (< 1.0)")

    # Average depth check - using context-aware threshold
    avg_depth = analysis["dependencyDepth"]["mean"]
    if CONTEXT_AVAILABLE:
        depth_check = check_threshold("syntactic", "avg_dependency_depth", avg_depth, context, "below")
        if depth_check and depth_check["shouldFlag"]:
            signals.append(f"Shallow dependency structure: {depth_check['reason']}")
    else:
        # Fallback threshold
        if avg_depth < 5.0:
            signals.append(f"Shallow dependency structure (avg depth {avg_depth} < 5.0)")

    # Uniformity check - using context-aware threshold
    uniformity = analysis.get("uniformityScore", 0)
    if CONTEXT_AVAILABLE:
        uniformity_check = check_threshold("syntactic", "sentence_type_uniformity", uniformity, context, "above")
        if uniformity_check and uniformity_check["shouldFlag"]:
            signals.append(f"High sentence uniformity: {uniformity_check['reason']}")
    else:
        # Fallback threshold
        if uniformity > 0.8:
            signals.append(f"High sentence uniformity ({uniformity} > 0.8)")

    # POS distribution checks (fallback thresholds)
    pos = analysis["posDistribution"]
    aux_pct = pos.get("AUX", 0)
    if aux_pct > 5.5:
        signals.append(f"Elevated auxiliary verbs ({aux_pct}% > 5.5%)")

    noun_pct = pos.get("NOUN", 0)
    if noun_pct < 18:
        signals.append(f"Reduced noun frequency ({noun_pct}% < 18%)")

    pron_pct = pos.get("PRON", 0)
    if pron_pct > 7:
        signals.append(f"Elevated pronoun usage ({pron_pct}% > 7%)")

    return signals


def classify_text(analysis: Dict, context: Dict) -> Tuple[str, float]:
    """
    Classify text as likely_ai, likely_human, or uncertain.

    Args:
        analysis: Complete analysis dictionary
        context: Writing context

    Returns:
        Tuple of (classification, confidence)
    """
    score = 0.0
    max_score = 0.0

    # Check 1: Compound-complex ratio (high weight)
    max_score += 0.25
    cc_ratio = analysis["sentenceTypes"]["compoundComplex"]["ratio"]
    if cc_ratio < 0.05:
        score += 0.25  # Strong AI signal
    elif cc_ratio > 0.15:
        score -= 0.15  # Human signal

    # Check 2: Depth variance (high weight)
    max_score += 0.25
    depth_var = analysis["dependencyDepth"]["variance"]
    if depth_var < 1.0:
        score += 0.25  # Strong AI signal
    elif depth_var > 2.0:
        score -= 0.15  # Human signal

    # Check 3: Average depth (medium weight) - context-aware
    max_score += 0.2
    avg_depth = analysis["dependencyDepth"]["mean"]
    if CONTEXT_AVAILABLE:
        depth_check = check_threshold("syntactic", "avg_dependency_depth", avg_depth, context, "below")
        if depth_check and depth_check["shouldFlag"]:
            score += 0.2  # AI signal
    else:
        # Fallback threshold
        if avg_depth < 5.0:
            score += 0.2

    # Check 4: AUX percentage (medium weight)
    max_score += 0.15
    aux_pct = analysis["posDistribution"].get("AUX", 0)
    if aux_pct > 5.5:
        score += 0.15  # AI signal

    # Check 5: Uniformity (low weight) - context-aware
    max_score += 0.15
    uniformity = analysis.get("uniformityScore", 0)
    if CONTEXT_AVAILABLE:
        uniformity_check = check_threshold("syntactic", "sentence_type_uniformity", uniformity, context, "above")
        if uniformity_check and uniformity_check["shouldFlag"]:
            score += 0.15  # AI signal
    else:
        # Fallback threshold
        if uniformity > 0.8:
            score += 0.15

    # Normalize confidence
    if max_score > 0:
        confidence = round(abs(score) / max_score, 2)
    else:
        confidence = 0.5

    # Classify
    if score > 0.3:
        classification = "likely_ai"
    elif score < -0.3:
        classification = "likely_human"
    else:
        classification = "uncertain"

    return classification, confidence


def analyze_syntactic_complexity(text: str) -> Dict:
    """
    Comprehensive syntactic complexity analysis for AI detection.

    Args:
        text: Input text to analyze

    Returns:
        Dictionary with complete analysis
    """
    # Get context
    context = get_config_from_env()
    
    if not text or not text.strip():
        return {
            "error": "Empty text provided",
            "sentenceCount": 0,
            "classification": "uncertain",
            "confidence": 0,
            "context": context
        }

    # Process with spaCy
    doc = nlp(text)

    # Get sentences
    sentences = list(doc.sents)
    if not sentences:
        return {
            "error": "No sentences found",
            "sentenceCount": 0,
            "classification": "uncertain",
            "confidence": 0,
            "context": context
        }

    # Sentence length metrics
    sent_lengths = [len(sent) for sent in sentences]
    avg_sent_length = round(mean(sent_lengths), 2)
    sent_length_std = (
        round(stdev(sent_lengths), 2) if len(sent_lengths) > 1 else 0.0
    )

    # Dependency depth metrics
    dep_depths = calculate_dependency_depths(doc)
    avg_depth = round(mean(dep_depths), 2) if dep_depths else 0.0
    max_depth = max(dep_depths) if dep_depths else 0
    depth_var = (
        round(variance(dep_depths), 2) if len(dep_depths) > 1 else 0.0
    )

    # Sentence types
    sent_types = classify_sentence_types(doc)

    # POS distribution
    pos_dist = calculate_pos_distribution(doc)

    # Branching factor
    branching = calculate_branching_factor(doc)

    # Clause count
    clause_count, clauses_per_sent = calculate_clause_count(doc)

    # Readability
    readability = calculate_flesch_kincaid(text, doc)

    # Uniformity
    uniformity = calculate_uniformity_score(avg_sent_length, sent_length_std)

    # Build analysis dictionary
    analysis = {
        "sentenceCount": len(sentences),
        "avgSentenceLength": avg_sent_length,
        "sentenceLengthStd": sent_length_std,
        "dependencyDepth": {
            "mean": avg_depth,
            "max": max_depth,
            "variance": depth_var,
        },
        "sentenceTypes": sent_types,
        "posDistribution": pos_dist,
        "branchingFactor": branching,
        "clausesPerSentence": clauses_per_sent,
        "readability": readability,
        "uniformityScore": uniformity,
    }

    # Extract signals and classify
    signals = extract_ai_signals(analysis, context)
    classification, confidence = classify_text(analysis, context)

    # Add classification and context
    analysis["signals"] = signals
    analysis["classification"] = classification
    analysis["confidence"] = confidence
    analysis["context"] = context

    # Generate summary
    summary_parts = []
    summary_parts.append(
        f"Text has {len(sentences)} sentences with avg length {avg_sent_length} words"
    )

    if signals:
        summary_parts.append(f"Detected {len(signals)} AI signal(s)")
    else:
        summary_parts.append("No strong AI signals detected")

    summary_parts.append(
        f"Classification: {classification} (confidence: {confidence})"
    )

    analysis["summary"] = "; ".join(summary_parts)

    return analysis


def get_text_input() -> str:
    """
    Get text from command line argument or stdin.

    Returns:
        Text to analyze
    """
    if len(sys.argv) > 1:
        # Get text from command line argument
        return " ".join(sys.argv[1:])
    else:
        # Read from stdin
        text = sys.stdin.read()
        if not text:
            print(
                json.dumps({"error": "No text provided via argument or stdin"}),
                file=sys.stderr,
            )
            sys.exit(1)
        return text


def main():
    """Main entry point."""
    text = get_text_input()

    try:
        result = analyze_syntactic_complexity(text)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(
            json.dumps({"error": f"Analysis failed: {str(e)}", "type": type(e).__name__}),
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
