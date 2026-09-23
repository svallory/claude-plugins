#!/usr/bin/env python3
"""
Content Analyzer - AI Text Detection Tool

Analyzes content patterns for AI text detection using spaCy:
- Hedging language detection (overused by AI)
- Cliché detection (common AI patterns)
- Superlative overuse (intensifiers and superlatives)
- Topic coherence (entity consistency)
- Filler phrase detection (AI markers)

Output: JSON with analyses, signals, classification, and confidence

Usage:
    python3 content-analyzer.py "Your text here"
    echo "Your text here" | python3 content-analyzer.py
"""

import json
import sys
import re
from typing import Dict, List, Tuple, Set
from collections import Counter
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
            {"error": "spacy not installed. Install with: pip install spacy"}
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
                "error": "spaCy model 'en_core_web_sm' not found. Install with: python -m spacy download en_core_web_sm"
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)


# Hedge words that AI overuses
HEDGE_WORDS = {
    "perhaps",
    "maybe",
    "possibly",
    "might",
    "could",
    "seem",
    "appear",
    "likely",
    "probably",
    "generally",
    "typically",
    "often",
    "usually",
}

# Common AI clichés
CLICHES = {
    "at the end of the day",
    "it goes without saying",
    "in a nutshell",
    "food for thought",
    "think outside the box",
    "game changer",
    "low-hanging fruit",
    "deep dive",
    "paradigm shift",
    "cutting edge",
    "best practices",
    "value proposition",
}

# Superlatives and intensifiers
SUPERLATIVES = {
    "very",
    "extremely",
    "incredibly",
    "highly",
    "absolutely",
    "truly",
    "really",
    "completely",
    "utterly",
    "definitely",
    "most important",
    "best",
    "worst",
    "greatest",
}

# AI filler phrases
FILLER_PHRASES = {
    "as mentioned earlier",
    "it is worth noting",
    "in this context",
    "given the above",
    "with that said",
    "that being said",
}


def count_words(text: str) -> int:
    """
    Count words in text.

    Args:
        text: Input text

    Returns:
        Word count
    """
    return len(text.split())


def detect_hedge_words(text: str) -> Tuple[int, List[str]]:
    """
    Detect hedge words in text.

    Args:
        text: Input text (lowercased for matching)

    Returns:
        Tuple of (count, found_words)
    """
    tokens = text.lower().split()
    found = []
    count = 0

    for token in tokens:
        # Remove punctuation from token for matching
        clean_token = re.sub(r"[^\w]", "", token)
        if clean_token in HEDGE_WORDS:
            found.append(clean_token)
            count += 1

    return count, found


def detect_cliches(text: str) -> Tuple[int, List[str]]:
    """
    Detect AI clichés in text (phrase-level).

    Args:
        text: Input text (lowercased for matching)

    Returns:
        Tuple of (count, found_cliches)
    """
    text_lower = text.lower()
    found = []
    count = 0

    for cliche in CLICHES:
        # Use word boundary to avoid partial matches
        pattern = r"\b" + re.escape(cliche) + r"\b"
        matches = re.findall(pattern, text_lower)
        count += len(matches)
        if matches:
            found.extend([cliche] * len(matches))

    return count, found


def detect_superlatives(text: str) -> Tuple[int, List[str]]:
    """
    Detect superlatives and intensifiers in text.

    Args:
        text: Input text (lowercased for matching)

    Returns:
        Tuple of (count, found_words)
    """
    tokens = text.lower().split()
    found = []
    count = 0

    for i, token in enumerate(tokens):
        # Remove punctuation from token for matching
        clean_token = re.sub(r"[^\w]", "", token)

        if clean_token in SUPERLATIVES:
            found.append(clean_token)
            count += 1
        # Check for "most X" pattern
        elif clean_token == "most" and i + 1 < len(tokens):
            next_token = re.sub(r"[^\w]", "", tokens[i + 1])
            if next_token in {"important", "significant", "critical", "valuable"}:
                found.append(f"most {next_token}")
                count += 1

    return count, found


def detect_filler_phrases(text: str) -> Tuple[int, List[str]]:
    """
    Detect AI filler phrases in text.

    Args:
        text: Input text (lowercased for matching)

    Returns:
        Tuple of (count, found_phrases)
    """
    text_lower = text.lower()
    found = []
    count = 0

    for phrase in FILLER_PHRASES:
        pattern = r"\b" + re.escape(phrase) + r"\b"
        matches = re.findall(pattern, text_lower)
        count += len(matches)
        if matches:
            found.extend([phrase] * len(matches))

    return count, found


def analyze_topic_coherence(text: str) -> Dict:
    """
    Analyze topic coherence using spaCy NER.

    Extracts main entities and checks consistency.

    Args:
        text: Input text

    Returns:
        Dictionary with entity analysis
    """
    try:
        doc = nlp(text)

        # Extract entities
        entities = []
        entity_types = Counter()

        for ent in doc.ents:
            entities.append(ent.text)
            entity_types[ent.label_] += 1

        # Count entity occurrences
        entity_counts = Counter(entities)

        # Top entities (most frequently mentioned)
        top_entities = entity_counts.most_common(5)

        # Calculate coherence metric
        # More consistent entities = higher coherence
        if len(entities) > 0:
            unique_ratio = len(entity_counts) / len(entities)
            coherence = 1.0 - unique_ratio  # Higher = more coherent
        else:
            coherence = 0.0

        return {
            "count": len(entities),
            "unique": len(entity_counts),
            "coherence": round(coherence, 2),
            "types": dict(entity_types),
            "topEntities": [[ent, count] for ent, count in top_entities],
        }

    except Exception as e:
        return {
            "error": str(e),
            "count": 0,
            "unique": 0,
            "coherence": 0.0,
            "types": {},
            "topEntities": [],
        }


def detect_signals(
    hedging_per_1000: float,
    cliche_count: int,
    superlative_per_1000: float,
    filler_count: int,
    entity_coherence: float,
    context: Dict,
) -> List[str]:
    """
    Detect AI and human signals based on content analysis.

    Args:
        hedging_per_1000: Hedge words per 1000 words
        cliche_count: Number of clichés found
        superlative_per_1000: Superlatives per 1000 words
        filler_count: Number of filler phrases
        entity_coherence: Topic coherence score (0-1)
        context: Context information for threshold resolution

    Returns:
        List of detected signals
    """
    signals = []

    # Hedge word signals using context-aware thresholds
    if CONTEXT_AVAILABLE:
        hedge_check = check_threshold("content", "hedging", hedging_per_1000, context, "above")
        if hedge_check and hedge_check["shouldFlag"]:
            signals.append(f"High hedging ({hedging_per_1000:.1f}/1000): {hedge_check['reason']}")
        elif hedging_per_1000 < 5:
            signals.append(f"Low hedging ({hedging_per_1000:.1f}/1000): direct assertions (human signal)")
    else:
        # Fallback thresholds
        if hedging_per_1000 > 15:
            signals.append(f"High hedging ({hedging_per_1000:.1f}/1000): excessive qualifications (AI-like)")
        elif hedging_per_1000 < 5:
            signals.append(f"Low hedging ({hedging_per_1000:.1f}/1000): direct assertions (human signal)")

    # Cliché signals using context-aware thresholds
    if CONTEXT_AVAILABLE:
        cliche_check = check_threshold("content", "cliche", cliche_count, context, "above")
        if cliche_check and cliche_check["shouldFlag"]:
            signals.append(f"Clichés detected ({cliche_count}): {cliche_check['reason']}")
    else:
        # Fallback thresholds
        if cliche_count >= 3:
            signals.append(f"Multiple clichés ({cliche_count}): formulaic language (AI-like)")
        elif cliche_count > 0:
            signals.append(f"Some clichés ({cliche_count}): common expressions (potential AI signal)")

    # Superlative signals using context-aware thresholds
    if CONTEXT_AVAILABLE:
        super_check = check_threshold("content", "superlative", superlative_per_1000, context, "above")
        if super_check and super_check["shouldFlag"]:
            signals.append(f"High superlatives ({superlative_per_1000:.1f}/1000): {super_check['reason']}")
        elif superlative_per_1000 < 8:
            signals.append(f"Low superlatives ({superlative_per_1000:.1f}/1000): restrained tone (human signal)")
    else:
        # Fallback thresholds
        if superlative_per_1000 > 20:
            signals.append(f"High superlatives ({superlative_per_1000:.1f}/1000): excessive intensifiers (AI-like)")
        elif superlative_per_1000 < 8:
            signals.append(f"Low superlatives ({superlative_per_1000:.1f}/1000): restrained tone (human signal)")

    # Filler phrase signals using context-aware thresholds
    if CONTEXT_AVAILABLE:
        filler_check = check_threshold("content", "filler", filler_count, context, "above")
        if filler_check and filler_check["shouldFlag"]:
            signals.append(f"Filler phrases detected ({filler_count}): {filler_check['reason']}")
    else:
        # Fallback thresholds
        if filler_count >= 3:
            signals.append(f"Multiple filler phrases ({filler_count}): padding language (AI-like)")
        elif filler_count > 0:
            signals.append(f"Filler phrases detected ({filler_count}): transitional markers (AI signal)")

    # Entity coherence signals
    if entity_coherence > 0.7:
        signals.append(f"High topic coherence ({entity_coherence:.2f}): consistent focus (can be AI or human)")
    elif entity_coherence < 0.3:
        signals.append(f"Low topic coherence ({entity_coherence:.2f}): scattered topics (human signal)")

    return signals


def classify_content(
    hedging_per_1000: float,
    cliche_count: int,
    superlative_per_1000: float,
    filler_count: int,
    signals: List[str],
    context: Dict,
) -> Tuple[str, float, str]:
    """
    Classify text as AI or human based on content analysis.

    Args:
        hedging_per_1000: Hedge words per 1000 words
        cliche_count: Number of clichés
        superlative_per_1000: Superlatives per 1000 words
        filler_count: Number of filler phrases
        signals: List of detected signals
        context: Context information for threshold resolution

    Returns:
        Tuple of (classification, confidence, summary)
    """
    score = 0

    # Get context-aware thresholds or use fallbacks
    if CONTEXT_AVAILABLE:
        hedge_threshold = get_threshold("content", "hedging", context)
        cliche_threshold = get_threshold("content", "cliche", context)
        super_threshold = get_threshold("content", "superlative", context)
        filler_threshold = get_threshold("content", "filler", context)

        hedge_high = hedge_threshold.get("ai_threshold", 15) if hedge_threshold else 15
        hedge_low = hedge_threshold.get("human_baseline", 5) if hedge_threshold else 5
        cliche_high = cliche_threshold.get("ai_threshold", 3) if cliche_threshold else 3
        super_high = super_threshold.get("ai_threshold", 20) if super_threshold else 20
        super_low = super_threshold.get("human_baseline", 8) if super_threshold else 8
        filler_high = filler_threshold.get("ai_threshold", 3) if filler_threshold else 3
    else:
        # Fallback thresholds
        hedge_high = 15
        hedge_low = 5
        cliche_high = 3
        super_high = 20
        super_low = 8
        filler_high = 3

    # Hedging contribution
    if hedging_per_1000 > hedge_high:
        score -= 3
    elif hedging_per_1000 < hedge_low:
        score += 2

    # Cliché contribution
    if cliche_count >= cliche_high:
        score -= 3
    elif cliche_count > 0:
        score -= 1

    # Superlative contribution
    if superlative_per_1000 > super_high:
        score -= 2
    elif superlative_per_1000 < super_low:
        score += 1

    # Filler phrase contribution
    if filler_count >= filler_high:
        score -= 2
    elif filler_count > 0:
        score -= 1

    # Determine classification and confidence
    if score <= -5:
        classification = "likely_ai"
        confidence = 0.85
        summary = "Strong AI indicators: multiple pattern matches (hedging, clichés, superlatives)"
    elif score <= -2:
        classification = "likely_ai"
        confidence = 0.65
        summary = "Some AI signals present: hedging and fillers detected"
    elif score >= 3:
        classification = "likely_human"
        confidence = 0.75
        summary = "Multiple human signals: natural language patterns"
    elif score >= 1:
        classification = "likely_human"
        confidence = 0.60
        summary = "Some human signals present: authentic voice"
    else:
        classification = "uncertain"
        confidence = 0.50
        summary = "Mixed signals; inconclusive classification"

    return classification, confidence, summary


def analyze_content(text: str) -> Dict:
    """
    Analyze content patterns for AI detection.

    Args:
        text: Input text to analyze

    Returns:
        Dictionary with all analyses, signals, and classification
    """
    # Get context
    context = get_config_from_env()
    
    if not text or not text.strip():
        return {
            "error": "Empty text provided",
            "context": context,
            "wordCount": 0,
            "hedging": {"count": 0, "per1000": 0, "found": []},
            "cliches": {"count": 0, "found": []},
            "superlatives": {"count": 0, "per1000": 0, "found": []},
            "fillerPhrases": {"count": 0, "found": []},
            "entities": {
                "count": 0,
                "unique": 0,
                "coherence": 0.0,
                "types": {},
                "topEntities": [],
            },
            "signals": [],
            "classification": "error",
            "confidence": 0.0,
            "summary": "Cannot analyze empty text",
        }

    try:
        # Count words
        word_count = count_words(text)

        if word_count < 20:
            return {
                "error": f"Text too short ({word_count} words); need at least 20",
                "context": context,
                "wordCount": word_count,
                "hedging": {"count": 0, "per1000": 0, "found": []},
                "cliches": {"count": 0, "found": []},
                "superlatives": {"count": 0, "per1000": 0, "found": []},
                "fillerPhrases": {"count": 0, "found": []},
                "entities": {
                    "count": 0,
                    "unique": 0,
                    "coherence": 0.0,
                    "types": {},
                    "topEntities": [],
                },
                "signals": [],
                "classification": "error",
                "confidence": 0.0,
                "summary": "Insufficient text for meaningful analysis",
            }

        # Detect patterns
        hedge_count, hedge_words = detect_hedge_words(text)
        cliche_count, cliches = detect_cliches(text)
        super_count, superlatives = detect_superlatives(text)
        filler_count, fillers = detect_filler_phrases(text)

        # Calculate per-1000 metrics
        hedging_per_1000 = (hedge_count / word_count) * 1000 if word_count > 0 else 0
        superlative_per_1000 = (super_count / word_count) * 1000 if word_count > 0 else 0

        # Analyze entities
        entity_analysis = analyze_topic_coherence(text)

        # Detect signals
        signals = detect_signals(
            hedging_per_1000,
            cliche_count,
            superlative_per_1000,
            filler_count,
            entity_analysis.get("coherence", 0.0),
            context,
        )

        # Classify
        classification, confidence, summary = classify_content(
            hedging_per_1000,
            cliche_count,
            superlative_per_1000,
            filler_count,
            signals,
            context,
        )

        # Remove duplicates from found lists while preserving order
        unique_hedge_words = []
        for word in hedge_words:
            if word not in unique_hedge_words:
                unique_hedge_words.append(word)

        unique_cliches = []
        for cliche in cliches:
            if cliche not in unique_cliches:
                unique_cliches.append(cliche)

        unique_superlatives = []
        for word in superlatives:
            if word not in unique_superlatives:
                unique_superlatives.append(word)

        unique_fillers = []
        for filler in fillers:
            if filler not in unique_fillers:
                unique_fillers.append(filler)

        return {
            "context": context,
            "wordCount": word_count,
            "hedging": {
                "count": hedge_count,
                "per1000": round(hedging_per_1000, 2),
                "found": unique_hedge_words,
            },
            "cliches": {"count": cliche_count, "found": unique_cliches},
            "superlatives": {
                "count": super_count,
                "per1000": round(superlative_per_1000, 2),
                "found": unique_superlatives,
            },
            "fillerPhrases": {"count": filler_count, "found": unique_fillers},
            "entities": entity_analysis,
            "signals": signals,
            "classification": classification,
            "confidence": round(confidence, 2),
            "summary": summary,
        }

    except Exception as e:
        return {
            "error": f"Analysis error: {str(e)}",
            "context": context,
            "wordCount": 0,
            "hedging": {"count": 0, "per1000": 0, "found": []},
            "cliches": {"count": 0, "found": []},
            "superlatives": {"count": 0, "per1000": 0, "found": []},
            "fillerPhrases": {"count": 0, "found": []},
            "entities": {
                "count": 0,
                "unique": 0,
                "coherence": 0.0,
                "types": {},
                "topEntities": [],
            },
            "signals": [],
            "classification": "error",
            "confidence": 0.0,
            "summary": f"Error during analysis: {str(e)}",
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
                        "error": "No text provided. Usage: content-analyzer.py 'text' or echo 'text' | content-analyzer.py"
                    }
                )
            )
            sys.exit(1)

    # Analyze and output JSON
    result = analyze_content(text)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
