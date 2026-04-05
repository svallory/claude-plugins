"""
config_loader.py

Python equivalent of config-loader.ts for Python tools.
Loads writing configuration from YAML files, resolves preset chains,
and returns fully resolved configurations.

Uses snake_case throughout for consistency with YAML configs.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict, Literal, Union

# Type definitions
MediaType = Literal[
    "blog", "book", "technical", "academic", "casual", "student", "business", "unknown"
]
FormalityLevel = Literal["formal", "informal", "mixed"]
WritingTone = Literal["formal", "conversational", "casual", "academic", "technical"]
NarrativeVoice = Literal["first-person", "first-person-plural", "second-person", "third-person"]
PrimaryTense = Literal["past", "present", "mixed"]
AudienceLevel = Literal["general", "expert", "beginner", "mixed"]
LengthCategory = Literal["short_form", "medium_form", "long_form"]
Platform = Literal["self_published", "traditional", "web", "academic_journal", "blog_platform", "social_media"]
EditorialLevel = Literal["unedited", "self_edited", "copy_edited", "professionally_edited", "peer_reviewed"]
Era = Literal["contemporary", "modern", "classic", "historical"]


class PublisherInfo(TypedDict, total=False):
    name: str


class Publication(TypedDict, total=False):
    """Publication metadata - context about the content being analyzed."""
    media: MediaType
    publisher: PublisherInfo
    audience: AudienceLevel
    domain: str
    genre: str
    genres: List[str]
    content_type: str
    length_category: LengthCategory
    platform: Platform
    editorial_level: EditorialLevel
    era: Union[Era, int]
    subjects: List[str]
    source_language: str
    is_translation: bool


class WritingStyle(TypedDict, total=False):
    tone: WritingTone
    formality: FormalityLevel
    voice: NarrativeVoice
    tense: PrimaryTense


class AuthorBackground(TypedDict, total=False):
    profession: str
    years_experience: int
    education: str
    industry: str


class WritingBackground(TypedDict, total=False):
    native_language: str
    other_languages: List[str]
    published_works: bool
    technical_writer: bool
    academic_writer: bool


class AuthorProfile(TypedDict, total=False):
    name: str
    gender: Literal["male", "female", "non-binary", "other"]
    age: Union[int, str]
    personality: List[str]
    background: AuthorBackground
    writing_background: WritingBackground


class ThresholdConfig(TypedDict, total=False):
    ai_threshold: Optional[float]
    human_baseline: float
    disabled: bool
    weight: float
    expected: str  # For convention thresholds


class CategoryRules(TypedDict, total=False):
    """Rules within a category (e.g., punctuation.period_quote)."""
    period_quote: ThresholdConfig
    oxford_comma: ThresholdConfig
    em_dash: ThresholdConfig
    semicolon_to_em_dash_ratio: ThresholdConfig
    parenthesis_to_em_dash_ratio: ThresholdConfig
    paragraph_fano_factor: ThresholdConfig
    bullet_density: ThresholdConfig
    transition_density: ThresholdConfig
    ai_vocab_density: ThresholdConfig
    coefficient_of_variation: ThresholdConfig
    fano_factor: ThresholdConfig
    length_range: ThresholdConfig
    six_gram_repetition_rate: ThresholdConfig
    six_gram_ttr: ThresholdConfig
    ai_pattern_count: ThresholdConfig
    hedging: ThresholdConfig
    cliche: ThresholdConfig
    superlative: ThresholdConfig
    filler: ThresholdConfig
    avg_dependency_depth: ThresholdConfig
    sentence_type_uniformity: ThresholdConfig
    perplexity: ThresholdConfig
    d_score: ThresholdConfig
    probability: ThresholdConfig
    score: ThresholdConfig


class RuleConfigs(TypedDict, total=False):
    """Nested rules structure organized by category."""
    punctuation: CategoryRules
    structure: CategoryRules
    vocabulary: CategoryRules
    burstiness: CategoryRules
    ngram: CategoryRules
    content: CategoryRules
    syntactic: CategoryRules
    perplexity: CategoryRules
    detectgpt: CategoryRules
    fast_detectgpt: CategoryRules
    binoculars: CategoryRules


class ResolvedWritingConfig(TypedDict, total=False):
    author: AuthorProfile
    publication: Publication
    writing_style: WritingStyle
    rules: RuleConfigs


# Deprecated alias
ResolvedDetectionConfig = ResolvedWritingConfig


# Default rules in nested structure (matches defaults.ts)
DEFAULT_RULES: RuleConfigs = {
    "punctuation": {
        "period_quote": {"ai_threshold": 97, "human_baseline": 85},
        "oxford_comma": {"ai_threshold": 95, "human_baseline": 75},
        "em_dash": {"ai_threshold": 2.5, "human_baseline": 1.5},
        "semicolon_to_em_dash_ratio": {"ai_threshold": 0.5, "human_baseline": 1.5},
        "parenthesis_to_em_dash_ratio": {"ai_threshold": 1.0, "human_baseline": 2.0},
    },
    "structure": {
        "paragraph_fano_factor": {"ai_threshold": 0.5, "human_baseline": 1.2},
        "bullet_density": {"ai_threshold": 3, "human_baseline": 1},
        "transition_density": {"ai_threshold": 20, "human_baseline": 10},
    },
    "vocabulary": {
        "ai_vocab_density": {"ai_threshold": 15, "human_baseline": 3},
    },
    "burstiness": {
        "coefficient_of_variation": {"ai_threshold": 30, "human_baseline": 50},
        "fano_factor": {"ai_threshold": 0.8, "human_baseline": 1.5},
        "length_range": {"ai_threshold": 10, "human_baseline": 25},
    },
    "ngram": {
        "six_gram_repetition_rate": {"ai_threshold": 0.3, "human_baseline": 0.1},
        "six_gram_ttr": {"ai_threshold": 0.3, "human_baseline": 0.8},
        "ai_pattern_count": {"ai_threshold": 2, "human_baseline": 0},
    },
    "content": {
        "hedging": {"ai_threshold": 10, "human_baseline": 5},
        "cliche": {"ai_threshold": 2, "human_baseline": 0},
        "superlative": {"ai_threshold": 8, "human_baseline": 4},
        "filler": {"ai_threshold": 2, "human_baseline": 0},
    },
    "syntactic": {
        "avg_dependency_depth": {"ai_threshold": 3.5, "human_baseline": 6.0},
        "sentence_type_uniformity": {"ai_threshold": 0.7, "human_baseline": 0.5},
    },
    "perplexity": {
        "perplexity": {"ai_threshold": 20, "human_baseline": 80},
    },
    "detectgpt": {
        "d_score": {"ai_threshold": 2.0, "human_baseline": 0.5},
    },
    "fast_detectgpt": {
        "probability": {"ai_threshold": 0.70, "human_baseline": 0.30},
    },
    "binoculars": {
        "score": {"ai_threshold": 0.8536, "human_baseline": 1.2},
    },
}

MEDIA_TYPES = [
    "blog", "book", "technical", "academic", "casual", "student", "business", "unknown"
]

BUILTIN_PRESETS = [
    "blog", "book", "technical-book", "technical-docs",
    "academic", "casual", "student", "business"
]


def _is_media_type(value: str) -> bool:
    """Check if a string is a valid media type."""
    return value in MEDIA_TYPES


def _is_builtin_preset(name: str) -> bool:
    """Check if a preset name is a built-in preset."""
    return name in BUILTIN_PRESETS


def _parse_yaml(content: str) -> Dict[str, Any]:
    """
    Simple YAML parser for our specific format.
    Handles nested objects, arrays, and primitive values.
    """
    lines = content.split("\n")
    result: Dict[str, Any] = {}
    stack = [{"obj": result, "indent": -2, "key": None}]

    for i, line in enumerate(lines):
        # Skip empty lines and comments
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Calculate indentation
        indent = len(line) - len(line.lstrip())

        # Handle array items
        if stripped.startswith("- "):
            value = stripped[2:].strip()

            # Pop stack until we find the right parent (array parent level)
            while len(stack) > 1 and stack[-1]["indent"] >= indent:
                stack.pop()

            parent = stack[-1]
            parent_obj = parent["obj"]
            array_key = parent.get("key")

            if array_key:
                if not isinstance(parent_obj[array_key], list):
                    parent_obj[array_key] = []
                parent_obj[array_key].append(_parse_value(value))
            continue

        # Handle key: value pairs
        if ":" not in stripped:
            continue

        colon_idx = stripped.index(":")
        key = stripped[:colon_idx].strip()
        value_str = stripped[colon_idx + 1:].strip()

        # Pop stack until we find the right parent
        while len(stack) > 1 and stack[-1]["indent"] >= indent:
            stack.pop()

        current = stack[-1]["obj"]

        if value_str == "" or value_str == "|" or value_str == ">":
            # Check if next non-empty line is an array item
            next_stripped = None
            for j in range(i + 1, len(lines)):
                next_line = lines[j].strip()
                if next_line and not next_line.startswith("#"):
                    next_stripped = next_line
                    break

            if next_stripped and next_stripped.startswith("- "):
                # This key will hold an array
                current[key] = []
                stack.append({"obj": current, "indent": indent, "key": key})
            else:
                # Nested object
                new_obj: Dict[str, Any] = {}
                current[key] = new_obj
                stack.append({"obj": new_obj, "indent": indent, "key": None})
        else:
            # Simple value
            current[key] = _parse_value(value_str)

    return result


def _parse_value(value: str) -> Any:
    """Parse a YAML value to its Python equivalent."""
    # Strip inline comments (but not from quoted strings)
    clean_value = value
    if not value.startswith('"') and not value.startswith("'"):
        comment_idx = value.find(" #")
        if comment_idx > 0:
            clean_value = value[:comment_idx].strip()

    if clean_value == "null" or clean_value == "~":
        return None
    if clean_value == "true":
        return True
    if clean_value == "false":
        return False
    if clean_value.startswith('"') and clean_value.endswith('"'):
        return clean_value[1:-1]
    if clean_value.startswith("'") and clean_value.endswith("'"):
        return clean_value[1:-1]
    try:
        return int(clean_value)
    except ValueError:
        try:
            return float(clean_value)
        except ValueError:
            return clean_value


def _get_preset_path(preset: str, base_path: Optional[str] = None) -> Path:
    """Get the path to a preset file."""
    # Built-in preset
    if _is_builtin_preset(preset):
        presets_dir = Path(__file__).parent.parent / "config" / "presets"
        return presets_dir / f"{preset}.yaml"

    # File path (relative or absolute)
    if preset.endswith(".yaml") or preset.endswith(".yml"):
        preset_path = Path(preset)
        if preset_path.is_absolute():
            return preset_path
        # Relative to base config path or cwd
        base = Path(base_path).parent if base_path else Path.cwd()
        return base / preset

    # Try as built-in preset name with .yaml extension
    presets_dir = Path(__file__).parent.parent / "config" / "presets"
    with_yaml = presets_dir / f"{preset}.yaml"
    if with_yaml.exists():
        return with_yaml

    raise ValueError(f"Unknown preset: {preset}")


def _load_yaml_file(file_path: Path) -> Dict[str, Any]:
    """Load a YAML config file."""
    if not file_path.exists():
        raise FileNotFoundError(f"Config file not found: {file_path}")

    content = file_path.read_text(encoding="utf-8")
    return _parse_yaml(content)


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge two dicts. Later values override earlier ones."""
    result = dict(base)

    for key, override_value in override.items():
        if override_value is None:
            continue

        if (
            isinstance(override_value, dict) and
            not isinstance(override_value, list) and
            key in result and
            isinstance(result[key], dict) and
            not isinstance(result[key], list)
        ):
            # Recursively merge dicts
            result[key] = _deep_merge(result[key], override_value)
        else:
            # Override value (including arrays and primitives)
            result[key] = override_value

    return result


def _resolve_presets(
    presets: List[str],
    base_path: Optional[str] = None,
    visited: Optional[set] = None
) -> Dict[str, Any]:
    """Resolve presets recursively and merge into a single config."""
    if visited is None:
        visited = set()

    merged: Dict[str, Any] = {}

    for preset in presets:
        # Check for cycles
        preset_path = _get_preset_path(preset, base_path)
        preset_key = str(preset_path.resolve())
        if preset_key in visited:
            raise ValueError(f"Circular preset dependency detected: {preset}")
        visited.add(preset_key)

        # Load the preset
        preset_config = _load_yaml_file(preset_path)

        # Recursively resolve nested presets
        if preset_config.get("presets"):
            nested_resolved = _resolve_presets(
                preset_config["presets"],
                str(preset_path),
                visited.copy()
            )
            merged = _deep_merge(merged, nested_resolved)

        # Merge this preset (excluding the presets array)
        config_without_presets = {k: v for k, v in preset_config.items() if k != "presets"}
        merged = _deep_merge(merged, config_without_presets)

    return merged


def _resolve_to_full(partial: Dict[str, Any]) -> ResolvedWritingConfig:
    """Resolve a partial config to a fully resolved config."""
    # Start with defaults
    rules = _deep_merge(dict(DEFAULT_RULES), partial.get("rules", {}))

    # Resolve publication with defaults
    partial_pub = partial.get("publication", {})
    publication: Publication = {
        "media": partial_pub.get("media", "unknown"),
    }
    if "publisher" in partial_pub:
        publication["publisher"] = partial_pub["publisher"]
    if "audience" in partial_pub:
        publication["audience"] = partial_pub["audience"]
    if "domain" in partial_pub:
        publication["domain"] = partial_pub["domain"]
    if "genre" in partial_pub:
        publication["genre"] = partial_pub["genre"]
    if "genres" in partial_pub:
        publication["genres"] = partial_pub["genres"]
    if "content_type" in partial_pub:
        publication["content_type"] = partial_pub["content_type"]
    if "length_category" in partial_pub:
        publication["length_category"] = partial_pub["length_category"]
    if "platform" in partial_pub:
        publication["platform"] = partial_pub["platform"]
    if "editorial_level" in partial_pub:
        publication["editorial_level"] = partial_pub["editorial_level"]
    if "era" in partial_pub:
        publication["era"] = partial_pub["era"]
    if "subjects" in partial_pub:
        publication["subjects"] = partial_pub["subjects"]
    if "source_language" in partial_pub:
        publication["source_language"] = partial_pub["source_language"]
    if "is_translation" in partial_pub:
        publication["is_translation"] = partial_pub["is_translation"]

    # Resolve writing_style (all optional)
    partial_style = partial.get("writing_style", {})
    writing_style: WritingStyle = {}
    if "tone" in partial_style:
        writing_style["tone"] = partial_style["tone"]
    if "formality" in partial_style:
        writing_style["formality"] = partial_style["formality"]
    if "voice" in partial_style:
        writing_style["voice"] = partial_style["voice"]
    if "tense" in partial_style:
        writing_style["tense"] = partial_style["tense"]

    result: ResolvedWritingConfig = {
        "publication": publication,
        "writing_style": writing_style,
        "rules": rules,
    }

    if "author" in partial:
        result["author"] = partial["author"]

    return result


def load_config(config_path: Optional[str] = None) -> ResolvedWritingConfig:
    """
    Load and resolve a detection configuration.

    Args:
        config_path: Path to the config YAML file, or None for defaults

    Returns:
        Fully resolved configuration
    """
    if not config_path:
        # Return defaults only
        return _resolve_to_full({})

    # Load the main config
    config = _load_yaml_file(Path(config_path))

    # Resolve presets
    merged: Dict[str, Any] = {}

    if config.get("presets"):
        merged = _resolve_presets(config["presets"], config_path)

    # Merge main config on top of resolved presets
    config_without_presets = {k: v for k, v in config.items() if k != "presets"}
    merged = _deep_merge(merged, config_without_presets)

    # Resolve to full config
    return _resolve_to_full(merged)


def load_preset(preset_name: str) -> ResolvedWritingConfig:
    """
    Load config from a preset name only (no file).
    Useful for quick CLI usage.
    """
    # Check if it's a media type
    if _is_media_type(preset_name):
        return load_config(str(_get_preset_path(preset_name)))

    # Check if it's a built-in preset
    if _is_builtin_preset(preset_name):
        return load_config(str(_get_preset_path(preset_name)))

    raise ValueError(f"Unknown preset: {preset_name}")


def load_from_media_type(media: MediaType) -> ResolvedWritingConfig:
    """
    Create a resolved config from just a media type.
    Useful for backward compatibility with the old context system.
    """
    # Try to load the corresponding preset if it exists
    preset_path = Path(__file__).parent.parent / "config" / "presets" / f"{media}.yaml"
    if preset_path.exists():
        return load_config(str(preset_path))

    # Otherwise, just set the media type with defaults
    return _resolve_to_full({"publication": {"media": media}})


def get_config_from_env() -> ResolvedWritingConfig:
    """
    Get resolved config from WRITING_CONFIG environment variable.
    Falls back to defaults if not set or invalid.
    """
    env_value = os.environ.get("WRITING_CONFIG", "")

    if not env_value:
        return _resolve_to_full({})

    try:
        return json.loads(env_value)
    except json.JSONDecodeError:
        return _resolve_to_full({})


def get_builtin_presets() -> List[str]:
    """Get list of available built-in presets."""
    return list(BUILTIN_PRESETS)


def get_media_types() -> List[str]:
    """Get list of available media types."""
    return list(MEDIA_TYPES)


def serialize_config_for_env(config: ResolvedWritingConfig) -> str:
    """Serialize resolved config for environment variable."""
    return json.dumps(config)
