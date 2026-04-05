/**
 * case-converter.ts
 *
 * Utilities for converting between snake_case (YAML/JSON configs) and
 * camelCase (TypeScript code). Handles deep conversion of nested objects and arrays.
 */

/**
 * Convert a snake_case string to camelCase.
 *
 * @param str - The snake_case string to convert
 * @returns The camelCase version of the string
 *
 * @example
 * ```ts
 * snakeToCamel("ai_threshold"); // "aiThreshold"
 * snakeToCamel("six_gram_ttr"); // "sixGramTtr"
 * snakeToCamel("already_camelCase"); // "alreadyCamelcase" (note: handles mixed)
 * ```
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case.
 *
 * @param str - The camelCase string to convert
 * @returns The snake_case version of the string
 *
 * @example
 * ```ts
 * camelToSnake("aiThreshold"); // "ai_threshold"
 * camelToSnake("sixGramTTR"); // "six_gram_ttr"
 * camelToSnake("already_snake_case"); // "already_snake_case"
 * ```
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Check if a value is a plain object (not null, array, Date, etc.).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Recursively convert all keys in an object from snake_case to camelCase.
 *
 * @param obj - The object with snake_case keys
 * @returns A new object with camelCase keys
 *
 * @example
 * ```ts
 * const input = {
 *   ai_threshold: 15,
 *   writing_style: {
 *     tone: "formal",
 *     period_quote: { expected: "american" }
 *   }
 * };
 * const output = snakeToCamelDeep(input);
 * // {
 * //   aiThreshold: 15,
 * //   writingStyle: {
 * //     tone: "formal",
 * //     periodQuote: { expected: "american" }
 * //   }
 * // }
 * ```
 */
export function snakeToCamelDeep<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamelDeep(item)) as T;
  }

  if (isPlainObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = snakeToCamelDeep(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Recursively convert all keys in an object from camelCase to snake_case.
 *
 * @param obj - The object with camelCase keys
 * @returns A new object with snake_case keys
 *
 * @example
 * ```ts
 * const input = {
 *   aiThreshold: 15,
 *   writingStyle: {
 *     tone: "formal",
 *     periodQuote: { expected: "american" }
 *   }
 * };
 * const output = camelToSnakeDeep(input);
 * // {
 * //   ai_threshold: 15,
 * //   writing_style: {
 * //     tone: "formal",
 * //     period_quote: { expected: "american" }
 * //   }
 * // }
 * ```
 */
export function camelToSnakeDeep<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnakeDeep(item)) as T;
  }

  if (isPlainObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = camelToSnakeDeep(value);
    }
    return result as T;
  }

  return obj;
}
