/**
 * publication.schema.ts
 *
 * Publication and writing style schemas for detection configuration.
 * Uses snake_case for YAML/JSON compatibility, camelCase in TypeScript code.
 */

// ============================================
// Strict Typed Enums (pre-determined values)
// ============================================

/**
 * Media types that have different writing conventions.
 */
export type MediaType =
  | "blog"
  | "book"
  | "technical"
  | "academic"
  | "casual"
  | "student"
  | "business"
  | "unknown";

/**
 * All valid media type values.
 */
export const MEDIA_TYPES: MediaType[] = [
  "blog",
  "book",
  "technical",
  "academic",
  "casual",
  "student",
  "business",
  "unknown",
];

/**
 * Check if a string is a valid media type.
 */
export function isMediaType(value: string): value is MediaType {
  return MEDIA_TYPES.includes(value as MediaType);
}

/**
 * Target audience level.
 */
export type AudienceLevel = "general" | "expert" | "beginner" | "mixed";

/**
 * Content length category.
 */
export type LengthCategory = "short_form" | "medium_form" | "long_form";

/**
 * Publishing platform type.
 */
export type Platform =
  | "self_published"
  | "traditional"
  | "web"
  | "academic_journal"
  | "blog_platform"
  | "social_media";

/**
 * Editorial/editing level the content has received.
 */
export type EditorialLevel =
  | "unedited"
  | "self_edited"
  | "copy_edited"
  | "professionally_edited"
  | "peer_reviewed";

/**
 * Time period/era of the writing style.
 */
export type Era = "contemporary" | "modern" | "classic" | "historical";

// ============================================
// Open String Fields (freely extensible)
// ============================================

/**
 * Publisher or brand information.
 */
export interface PublisherInfo {
  /** Publisher or brand name */
  name?: string;
}

// ============================================
// Publication Interface
// ============================================

/**
 * Publication metadata - context about the content being analyzed.
 *
 * Uses a mix of:
 * - **Strict typed fields** for pre-determined, finite values
 * - **Open string fields** for extensible/domain-specific values
 */
export interface Publication {
  // === STRICT TYPED FIELDS ===

  /** Media type (determines baseline thresholds) - Required */
  media: MediaType;

  /** Target audience level */
  audience?: AudienceLevel;

  /** Content length category */
  length_category?: LengthCategory;

  /** Publishing platform type */
  platform?: Platform;

  /** Editorial/editing level received */
  editorial_level?: EditorialLevel;

  /** Time period/era - can be string literal or year number */
  era?: Era | number;

  // === OPEN STRING FIELDS ===

  /** Publisher or brand information */
  publisher?: PublisherInfo;

  /** Content domain (e.g., "technology", "medicine", "finance") */
  domain?: string;

  /** Primary genre (e.g., "mystery", "how-to", "tutorial") */
  genre?: string;

  /** Multiple genres (e.g., ["dystopian", "young-adult"]) */
  genres?: string[];

  /** Content type (e.g., "article", "essay", "novel", "whitepaper") */
  content_type?: string;

  /** Subject tags (e.g., ["machine-learning", "python"]) */
  subjects?: string[];

  /** Source language if translated (ISO code or name) */
  source_language?: string;

  // === BOOLEAN FLAGS ===

  /** Whether content is a translation */
  is_translation?: boolean;
}

// ============================================
// Writing Style Types
// ============================================

/**
 * Tone of the writing.
 */
export type WritingTone =
  | "formal"
  | "conversational"
  | "casual"
  | "academic"
  | "technical";

/**
 * Formality level.
 */
export type FormalityLevel = "formal" | "informal" | "mixed";

/**
 * Narrative voice.
 */
export type NarrativeVoice =
  | "first-person"
  | "first-person-plural"
  | "second-person"
  | "third-person";

/**
 * Primary tense.
 */
export type PrimaryTense = "past" | "present" | "mixed";

/**
 * Quantitative prose targets for humanization.
 *
 * These define what the humanized text should aim for — the measurable
 * characteristics of the desired writing style. Unlike detection `rules`
 * (which define AI/human boundaries), prose targets define the ideal
 * output characteristics.
 *
 * All density values are percentages of total words unless noted otherwise.
 */
export interface ProseTargets {
  /** Target pronoun density (% of words). Academic ~4%, conversational ~7%, blog ~10% */
  pronoun_density?: number;

  /** Target auxiliary verb density (% of words). Default: 3.0% */
  auxiliary_density?: number;

  /** Target noun density (% of words). Default: 20.0% */
  noun_density?: number;

  /** Target em-dash density (per 1000 words). Default: 1.5 */
  em_dash_density?: number;

  /** Minimum em-dash density below which text is flagged as overcorrected (per 1000 words). Default: 1.0 */
  em_dash_min_density?: number;

  /** Maximum acceptable dependency depth for sentences. Default: 5.0 */
  max_dependency_depth?: number;

  /** Maximum acceptable uniformity score. Default: 0.8 */
  max_uniformity?: number;

  /** Compound-complex sentence ratio minimum. Default: 0.05 */
  min_compound_complex_ratio?: number;

  /** Minimum depth variance. Default: 1.0 */
  min_depth_variance?: number;
}

/**
 * Writing style preferences.
 */
export interface WritingStyle {
  /** Tone of the writing */
  tone?: WritingTone;

  /** Formality level */
  formality?: FormalityLevel;

  /** Narrative voice */
  voice?: NarrativeVoice;

  /** Primary tense */
  tense?: PrimaryTense;

  /** Quantitative prose targets for humanization tools */
  prose?: ProseTargets;
}
