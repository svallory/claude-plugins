"""
context_resolver.py

Python equivalent of context-resolver.ts for Python tools.
This module wraps config_loader.py for backward compatibility
while supporting both the old context format and new config files.

Uses snake_case throughout for consistency.
"""

import json
import os
from typing import Any, Dict, Optional, TypedDict, Literal

from .config_loader import (
    ResolvedWritingConfig,
    ResolvedDetectionConfig,  # deprecated alias
    Publication,
    WritingStyle,
    load_config,
    load_preset,
    load_from_media_type,
    get_config_from_env,
    get_builtin_presets,
    get_media_types,
    serialize_config_for_env,
    MEDIA_TYPES,
)

# Legacy type definitions for backward compatibility
MediaType = Literal[
    "blog", "book", "technical", "academic", "casual", "student", "business", "unknown"
]
FormalityLevel = Literal["formal", "casual", "mixed"]


class StyleOptions(TypedDict, total=False):
    period_quote: Literal["american", "british", "logical"]
    oxford_comma: Literal["always", "never", "flexible"]


class ThresholdConfig(TypedDict, total=False):
    ai_threshold: Optional[float]
    human_baseline: float
    disabled: bool
    weight: float


def _is_media_type(value: str) -> bool:
    """Check if a string is a valid media type."""
    return value in MEDIA_TYPES


def get_config() -> ResolvedWritingConfig:
    """
    Get writing config from WRITING_CONFIG environment variable.

    Returns:
        ResolvedWritingConfig with at minimum { publication: { media: "unknown" } }
    """
    env_value = os.environ.get("WRITING_CONFIG", "")
    if env_value:
        try:
            return json.loads(env_value)
        except json.JSONDecodeError:
            pass

    return load_from_media_type("unknown")


# Deprecated alias
get_context = get_config


def resolve_config(input_value: Optional[str] = None) -> ResolvedWritingConfig:
    """
    Resolve config input to a ResolvedWritingConfig.

    Supports multiple input formats for backward compatibility:
    - None/empty: returns default config
    - Media type string: "blog" -> loads blog preset
    - Preset name: "technical-book" -> loads preset
    - JSON string: '{"media":"blog"}' -> legacy format, converts to config
    - File path: "./config.yml" -> loads full config

    Args:
        input_value: Config input string

    Returns:
        ResolvedWritingConfig
    """
    if input_value is None or input_value == "":
        return get_config()

    input_str = input_value.strip()

    # Check if it's a file path
    if (input_str.endswith(".yaml") or input_str.endswith(".yml") or
            input_str.startswith("./") or input_str.startswith("/")):
        import os.path
        if os.path.exists(input_str):
            return load_config(input_str)

    # Check if it's a media type
    if _is_media_type(input_str):
        return load_from_media_type(input_str)

    # Check if it's JSON (legacy format or new format)
    if input_str.startswith("{"):
        try:
            parsed = json.loads(input_str)

            # Check if it's the new ResolvedWritingConfig format
            if "rules" in parsed and "publication" in parsed:
                return parsed

            # Legacy format - extract media type
            media = parsed.get("media", "unknown")
            return load_from_media_type(media)
        except json.JSONDecodeError:
            pass

    # Check if it's a preset name
    try:
        return load_preset(input_str)
    except (ValueError, FileNotFoundError):
        pass

    # Default to unknown
    return load_from_media_type("unknown")


# Deprecated alias
resolve_context = resolve_config


def get_presets() -> Dict[str, ResolvedWritingConfig]:
    """
    Get all available presets as resolved configs.

    Returns:
        Dict mapping preset name to resolved config
    """
    result = {}
    for name in get_builtin_presets():
        try:
            result[name] = load_preset(name)
        except (ValueError, FileNotFoundError):
            pass
    return result


# Re-export for convenience
__all__ = [
    "ResolvedWritingConfig",
    "ResolvedDetectionConfig",  # deprecated alias
    "ThresholdConfig",
    "Publication",
    "WritingStyle",
    "get_config",
    "get_context",  # deprecated alias
    "resolve_config",
    "resolve_context",  # deprecated alias
    "get_presets",
    "get_media_types",
    "load_config",
    "load_preset",
    "load_from_media_type",
    "serialize_config_for_env",
]
