/**
 * author.schema.ts
 *
 * Author profile schema for detection context.
 * Provides rich context about who wrote the text for the Detector agent's final assessment.
 *
 * Uses snake_case for YAML/JSON compatibility.
 */

/**
 * Author's professional background.
 */
export interface AuthorBackground {
  /** Author's profession or job title */
  profession?: string;

  /** Years of experience in their field */
  years_experience?: number;

  /** Highest education level or degree */
  education?: string;

  /** Industry they work in */
  industry?: string;
}

/**
 * Author's writing-specific background.
 */
export interface WritingBackground {
  /** Author's native language */
  native_language?: string;

  /** Other languages the author knows */
  other_languages?: string[];

  /** Whether the author has published works */
  published_works?: boolean;

  /** Whether the author is a technical writer */
  technical_writer?: boolean;

  /** Whether the author is an academic writer */
  academic_writer?: boolean;
}

/**
 * Complete author profile.
 * Used as context for the Detector agent's final assessment.
 */
export interface AuthorProfile {
  /** Author's name */
  name?: string;

  /** Author's gender */
  gender?: "male" | "female" | "non-binary" | "other";

  /** Author's age or age range (e.g., 45 or "40-50") */
  age?: number | string;

  /** Personality traits (free-form for flexibility) */
  personality?: string[];

  /** Professional background */
  background?: AuthorBackground;

  /** Writing-specific background */
  writing_background?: WritingBackground;
}
