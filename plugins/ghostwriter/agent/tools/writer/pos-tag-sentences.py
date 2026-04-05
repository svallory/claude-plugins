#!/usr/bin/env python3
"""
POS Tag Sentences - Per-sentence pronoun analysis via spaCy.

Returns pronoun locations, types, counts, and noun chunks per sentence.
Designed to feed into analyze-pronouns.ts for sentence grouping.

Usage:
    python3 pos-tag-sentences.py <file.md>
    cat file.md | python3 pos-tag-sentences.py

Output: JSON with per-sentence pronoun data + document-level stats.
"""

import json
import sys
from pathlib import Path

try:
    import spacy
except ImportError:
    print(
        json.dumps({"error": "spacy not installed. Install with: pip install spacy"}),
        file=sys.stderr,
    )
    sys.exit(1)

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(
        json.dumps(
            {
                "error": "spacy model 'en_core_web_sm' not found. "
                "Install with: python -m spacy download en_core_web_sm"
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)


# Increase max length for longer documents
nlp.max_length = 2_000_000


INDEFINITE_LEMMAS = {
    "anyone", "anyone", "anything", "everybody", "everyone", "everything",
    "nobody", "nothing", "somebody", "someone", "something",
    "one", "none", "all", "any", "each", "either", "neither",
    "both", "few", "many", "several", "some",
}


def classify_pronoun_type(token) -> str:
    """Classify a pronoun token by its fine-grained tag."""
    tag = token.tag_
    if tag == "PRP":
        return "personal"
    elif tag == "PRP$":
        return "possessive"
    elif tag in ("WP", "WP$", "WDT"):
        return "relative"
    # Indefinite pronouns (spaCy tags them as NN but pos_ == PRON)
    if token.lemma_.lower() in INDEFINITE_LEMMAS:
        return "indefinite"
    return "personal"  # fallback


def is_demonstrative_pronoun(token) -> bool:
    """
    Detect demonstrative determiners functioning as pronouns.
    e.g. "This is important" (pronoun) vs "This book is important" (determiner).
    """
    if token.pos_ != "DET":
        return False
    if token.lemma_ not in {"this", "that", "these", "those"}:
        return False
    # Functioning as pronoun if it's a subject without a noun child
    if token.dep_ in ("nsubj", "nsubjpass", "dobj", "pobj", "attr"):
        has_noun_child = any(
            c.pos_ in ("NOUN", "PROPN") for c in token.children
        )
        return not has_noun_child
    return False


def count_words(text: str) -> int:
    """Count words in text (split on whitespace)."""
    return len(text.split())


def analyze_sentences(text: str) -> dict:
    """Analyze text and return per-sentence pronoun data."""
    doc = nlp(text)

    sentences = []
    total_pronouns = 0
    total_words = 0
    by_type = {"personal": 0, "possessive": 0, "demonstrative": 0, "relative": 0, "indefinite": 0}

    for idx, sent in enumerate(doc.sents):
        sent_text = sent.text.strip()
        if not sent_text:
            continue

        word_count = count_words(sent_text)
        total_words += word_count

        pronouns = []

        for token in sent:
            pronoun_type = None

            if token.pos_ == "PRON":
                pronoun_type = classify_pronoun_type(token)
            elif is_demonstrative_pronoun(token):
                pronoun_type = "demonstrative"

            if pronoun_type:
                pronouns.append(
                    {
                        "text": token.text,
                        "lemma": token.lemma_,
                        "charPos": token.idx - sent.start_char,
                        "type": pronoun_type,
                        "tag": token.tag_,
                    }
                )
                by_type[pronoun_type] = by_type.get(pronoun_type, 0) + 1

        pronoun_count = len(pronouns)
        total_pronouns += pronoun_count

        # Extract noun chunks that overlap this sentence
        noun_chunks = []
        for chunk in doc.noun_chunks:
            if chunk.start >= sent.start and chunk.end <= sent.end:
                noun_chunks.append(chunk.text)

        # Count NOUN + PROPN tokens for noun density
        noun_propn_count = sum(
            1 for t in sent if t.pos_ in ("NOUN", "PROPN")
        )

        sentences.append(
            {
                "index": idx,
                "text": sent_text,
                "start": sent.start_char,
                "end": sent.end_char,
                "wordCount": word_count,
                "pronouns": pronouns,
                "pronounCount": pronoun_count,
                "pronounDensity": round(
                    (pronoun_count / word_count * 100) if word_count > 0 else 0.0, 2
                ),
                "nounChunks": noun_chunks,
                "nounPropnCount": noun_propn_count,
            }
        )

    return {
        "sentences": sentences,
        "documentStats": {
            "totalWords": total_words,
            "totalPronouns": total_pronouns,
            "pronounDensity": round(
                (total_pronouns / total_words * 100) if total_words > 0 else 0.0, 2
            ),
            "pronounsByType": by_type,
        },
    }


def get_text() -> str:
    """Get text from file argument or stdin."""
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        if path.is_file():
            return path.read_text(encoding="utf-8")
        else:
            print(
                json.dumps({"error": f"File not found: {sys.argv[1]}"}),
                file=sys.stderr,
            )
            sys.exit(1)
    elif not sys.stdin.isatty():
        return sys.stdin.read()
    else:
        print(
            json.dumps(
                {"error": "No input. Provide a file path as argument or pipe text via stdin."}
            ),
            file=sys.stderr,
        )
        sys.exit(1)


def main():
    text = get_text()
    if not text.strip():
        print(
            json.dumps({"error": "Empty text provided"}),
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        result = analyze_sentences(text)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(
            json.dumps({"error": f"Analysis failed: {str(e)}", "type": type(e).__name__}),
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
