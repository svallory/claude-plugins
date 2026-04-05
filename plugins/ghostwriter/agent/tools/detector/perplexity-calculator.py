#!/usr/bin/env python3
"""
Perplexity Calculator for AI Text Detection

Calculates document-level and sentence-level perplexity using GPT-2.
Used in adversarial agent system to detect AI-generated text.

Usage:
    python perplexity-calculator.py "text to analyze"
    echo "text to analyze" | python perplexity-calculator.py

Output: JSON to stdout
"""

import sys
import json
import re
import math
import os
from typing import List, Dict, Any, Tuple
from pathlib import Path
import warnings

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

# Suppress transformers warnings
warnings.filterwarnings("ignore")

try:
    import torch
    from transformers import GPT2LMHeadModel, GPT2TokenizerFast
except ImportError:
    print(json.dumps({
        "error": "Missing dependencies. Install with: pip install torch transformers",
        "classification": "error",
        "confidence": 0.0
    }))
    sys.exit(1)


def get_device():
    """Detect best available device (MPS on Mac, CUDA, or CPU)."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")


def split_sentences(text: str) -> List[str]:
    """
    Split text into sentences using simple heuristics.
    Returns list of sentences with at least 3 words.
    """
    # Split on periods, exclamation marks, question marks
    sentences = re.split(r'[.!?]+', text)

    # Filter: remove empty, strip whitespace, require at least 3 words
    valid_sentences = []
    for sent in sentences:
        sent = sent.strip()
        word_count = len(sent.split())
        if word_count >= 3:
            valid_sentences.append(sent)

    return valid_sentences


def calculate_perplexity(
    text: str,
    model: GPT2LMHeadModel,
    tokenizer: GPT2TokenizerFast,
    device: torch.device,
    max_length: int = 1024,
    stride: int = 512
) -> tuple[float, int]:
    """
    Calculate perplexity using sliding window for long texts.

    Returns:
        (perplexity, token_count)
    """
    encodings = tokenizer(text, return_tensors="pt")

    seq_len = encodings.input_ids.size(1)

    nlls = []  # negative log-likelihoods
    prev_end_loc = 0

    for begin_loc in range(0, seq_len, stride):
        end_loc = min(begin_loc + max_length, seq_len)
        trg_len = end_loc - prev_end_loc

        input_ids = encodings.input_ids[:, begin_loc:end_loc].to(device)
        target_ids = input_ids.clone()
        target_ids[:, :-trg_len] = -100  # Ignore tokens we're not predicting

        with torch.no_grad():
            outputs = model(input_ids, labels=target_ids)
            neg_log_likelihood = outputs.loss * trg_len

        nlls.append(neg_log_likelihood)

        prev_end_loc = end_loc
        if end_loc == seq_len:
            break

    # Calculate perplexity
    total_nll = torch.stack(nlls).sum()
    ppl = torch.exp(total_nll / seq_len)

    return ppl.item(), seq_len


def analyze_text(text: str, model_name: str = "gpt2") -> Dict[str, Any]:
    """
    Perform complete perplexity analysis on text.

    Args:
        text: Text to analyze
        model_name: GPT-2 model variant (gpt2, gpt2-medium, gpt2-large, gpt2-xl)

    Returns:
        Complete analysis as dict
    """
    # Get context
    context = get_config_from_env()
    
    # Validation
    if len(text.strip()) < 50:
        return {
            "error": "Text too short (minimum 50 characters)",
            "classification": "error",
            "confidence": 0.0,
            "context": context
        }

    # Initialize model and tokenizer
    device = get_device()
    tokenizer = GPT2TokenizerFast.from_pretrained(model_name)
    model = GPT2LMHeadModel.from_pretrained(model_name).to(device)
    model.eval()

    # Document-level perplexity
    doc_ppl, token_count = calculate_perplexity(text, model, tokenizer, device)

    # Sentence-level analysis
    sentences = split_sentences(text)
    sentence_ppls = []

    for sent in sentences:
        try:
            sent_ppl, _ = calculate_perplexity(sent, model, tokenizer, device)
            sentence_ppls.append(sent_ppl)
        except Exception:
            # Skip problematic sentences
            continue

    # Sentence statistics
    if sentence_ppls:
        sent_mean = sum(sentence_ppls) / len(sentence_ppls)
        sent_variance = sum((x - sent_mean) ** 2 for x in sentence_ppls) / len(sentence_ppls)
        sent_std = math.sqrt(sent_variance)
        sent_min = min(sentence_ppls)
        sent_max = max(sentence_ppls)

        # Coefficient of variation (burstiness measure)
        perplexity_cv = (sent_std / sent_mean) if sent_mean > 0 else 0
        is_flat = perplexity_cv < 0.2
    else:
        sent_mean = doc_ppl
        sent_std = 0.0
        sent_min = doc_ppl
        sent_max = doc_ppl
        perplexity_cv = 0.0
        is_flat = True

    # Detect signals using context-aware thresholds
    signals = []

    # Document perplexity check - using context-aware threshold
    if CONTEXT_AVAILABLE:
        doc_ppl_check = check_threshold("perplexity", "perplexity", doc_ppl, context, "below")
        if doc_ppl_check and doc_ppl_check["shouldFlag"]:
            if doc_ppl < 10:
                signals.append(f"Very low document perplexity: {doc_ppl_check['reason']}")
            else:
                signals.append(f"Low document perplexity: {doc_ppl_check['reason']}")
    else:
        # Fallback thresholds
        if doc_ppl < 10:
            signals.append(f"Very low document perplexity ({doc_ppl:.1f} < 10) - strong AI signal")
        elif doc_ppl < 20:
            signals.append(f"Low document perplexity ({doc_ppl:.1f} < 20) - AI signal")
    
    # Human signals (fallback thresholds)
    if doc_ppl > 85:
        signals.append("Very high document perplexity (> 85) - strong human signal")
    elif doc_ppl > 50:
        signals.append("High document perplexity (> 50) - human signal")

    # Variance signals (fallback thresholds)
    if is_flat:
        signals.append(f"Low perplexity variance (CV={perplexity_cv:.2f}) - AI signal")
    elif perplexity_cv > 0.3:
        signals.append(f"High perplexity variance (CV={perplexity_cv:.2f}) - human signal")

    # Sentence mean signals (fallback thresholds)
    if sent_mean < 15:
        signals.append(f"Low mean sentence perplexity ({sent_mean:.1f}) - AI signal")
    elif sent_mean > 60:
        signals.append(f"High mean sentence perplexity ({sent_mean:.1f}) - human signal")

    # Classification logic with context awareness
    classification = "uncertain"
    confidence = 0.5

    # Check if context-aware threshold is triggered
    ai_signal_triggered = False
    if CONTEXT_AVAILABLE:
        doc_ppl_check = check_threshold("perplexity", "perplexity", doc_ppl, context, "below")
        ai_signal_triggered = doc_ppl_check and doc_ppl_check["shouldFlag"]
    else:
        # Fallback threshold
        ai_signal_triggered = doc_ppl < 20

    # Strong AI signals
    if ai_signal_triggered and (is_flat or sent_mean < 15):
        classification = "likely_ai"
        if doc_ppl < 10:
            confidence = 0.9
        elif doc_ppl < 15:
            confidence = 0.75
        else:
            confidence = 0.6

    # Strong human signals
    elif doc_ppl > 50 and perplexity_cv > 0.3:
        classification = "likely_human"
        if doc_ppl > 85:
            confidence = 0.9
        elif doc_ppl > 70:
            confidence = 0.75
        else:
            confidence = 0.6

    # Ambiguous
    elif not ai_signal_triggered and doc_ppl <= 50:
        classification = "uncertain"
        confidence = 0.5

    # Generate summary
    summary = f"Document perplexity: {doc_ppl:.1f} (token count: {token_count}). "
    summary += f"Sentence mean: {sent_mean:.1f} ± {sent_std:.1f}. "
    summary += f"Burstiness CV: {perplexity_cv:.2f}. "
    summary += f"Classification: {classification} (confidence: {confidence:.0%})."

    return {
        "documentPerplexity": round(doc_ppl, 2),
        "tokenCount": token_count,
        "model": model_name,
        "sentenceAnalysis": {
            "count": len(sentence_ppls),
            "perplexities": [round(p, 2) for p in sentence_ppls],
            "mean": round(sent_mean, 2),
            "stdDev": round(sent_std, 2),
            "min": round(sent_min, 2),
            "max": round(sent_max, 2)
        },
        "burstiness": {
            "perplexityCV": round(perplexity_cv, 3),
            "isFlat": is_flat
        },
        "signals": signals,
        "classification": classification,
        "confidence": round(confidence, 2),
        "summary": summary,
        "context": context
    }


def main():
    """Main entry point."""
    # Read text from command line or stdin
    if len(sys.argv) > 1:
        text = sys.argv[1]
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        print(json.dumps({
            "error": "No input provided. Usage: python perplexity-calculator.py \"text\" or echo \"text\" | python perplexity-calculator.py",
            "classification": "error",
            "confidence": 0.0
        }))
        sys.exit(1)

    # Analyze and output JSON
    try:
        result = analyze_text(text.strip())
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({
            "error": f"Analysis failed: {str(e)}",
            "classification": "error",
            "confidence": 0.0
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
