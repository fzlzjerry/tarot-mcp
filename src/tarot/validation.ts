/**
 * Input validation utilities for the Tarot MCP Server
 */

import { TarotCard, CardOrientation, CardCategory, SpreadType } from "./types.js";
import { ValidationError } from "./errors.js";

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

/**
 * Generic validator function type
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>;

/**
 * Creates a successful validation result
 */
function success<T>(data: T): ValidationResult<T> {
  return { success: true, data, errors: [] };
}

/**
 * Creates a failed validation result
 */
function failure<T>(errors: string[]): ValidationResult<T> {
  return { success: false, errors };
}

/**
 * Validates that a value is a non-empty string
 */
export const validateString: Validator<string> = (value: unknown) => {
  if (typeof value !== "string") {
    return failure([`Expected string, got ${typeof value}`]);
  }
  if (value.trim().length === 0) {
    return failure(["String cannot be empty"]);
  }
  return success(value.trim());
};

/**
 * Validates that a value is a positive integer
 */
export const validatePositiveInteger: Validator<number> = (value: unknown) => {
  if (typeof value !== "number") {
    return failure([`Expected number, got ${typeof value}`]);
  }
  if (!Number.isInteger(value)) {
    return failure(["Expected integer"]);
  }
  if (value <= 0) {
    return failure(["Expected positive number"]);
  }
  return success(value);
};

/**
 * Validates that a value is within a specific range
 */
export function validateRange(min: number, max: number): Validator<number> {
  return (value: unknown) => {
    const numberResult = validatePositiveInteger(value);
    if (!numberResult.success) {
      return numberResult;
    }

    const num = numberResult.data!;
    if (num < min || num > max) {
      return failure([`Expected number between ${min} and ${max}, got ${num}`]);
    }
    return success(num);
  };
}

/**
 * Validates that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  allowedValues: readonly T[],
  enumName: string
): Validator<T> {
  return (value: unknown) => {
    const stringResult = validateString(value);
    if (!stringResult.success) {
      return failure(stringResult.errors);
    }

    const str = stringResult.data!;
    if (!allowedValues.includes(str as T)) {
      return failure([
        `Invalid ${enumName}: "${str}". Allowed values: ${allowedValues.join(", ")}`
      ]);
    }
    return success(str as T);
  };
}

/**
 * Validates card orientation
 */
export const validateCardOrientation = validateEnum(
  ["upright", "reversed"] as const,
  "card orientation"
);

/**
 * Validates card category
 */
export const validateCardCategory = validateEnum(
  ["all", "major_arcana", "minor_arcana", "wands", "cups", "swords", "pentacles"] as const,
  "card category"
);

/**
 * Validates spread type
 */
export const validateSpreadType = validateEnum([
  "single_card",
  "three_card",
  "celtic_cross",
  "horseshoe",
  "relationship_cross",
  "career_path",
  "decision_making",
  "spiritual_guidance",
  "year_ahead",
  "chakra_alignment",
  "shadow_work",
  "venus_love",
  "tree_of_life",
  "astrological_houses",
  "mandala",
  "pentagram",
  "mirror_of_truth",
  "daily_guidance",
  "yes_no",
  "weekly_forecast",
  "new_moon_intentions",
  "full_moon_release",
  "elemental_balance",
  "past_life_karma",
  "compatibility"
] as const, "spread type");

/**
 * Validates that a value is an optional string (can be undefined)
 */
export const validateOptionalString: Validator<string | undefined> = (value: unknown) => {
  if (value === undefined || value === null) {
    return success(undefined);
  }
  return validateString(value);
};

/**
 * Validates card name with fuzzy matching support
 */
export const validateCardName: Validator<string> = (value: unknown) => {
  const stringResult = validateString(value);
  if (!stringResult.success) {
    return stringResult;
  }

  const cardName = stringResult.data!;

  // Basic validation - card names should be reasonable length
  if (cardName.length > 50) {
    return failure(["Card name too long (max 50 characters)"]);
  }

  // Check for potentially harmful characters
  if (/[<>{}\\]/.test(cardName)) {
    return failure(["Card name contains invalid characters"]);
  }

  return success(cardName);
};

/**
 * Validates search query parameters
 */
export interface SearchParams {
  keyword?: string;
  suit?: string;
  arcana?: "major" | "minor";
  element?: "fire" | "water" | "air" | "earth";
  number?: number;
  limit?: number;
}

export const validateSearchParams: Validator<SearchParams> = (value: unknown) => {
  if (typeof value !== "object" || value === null) {
    return failure(["Expected object for search parameters"]);
  }

  const params = value as Record<string, unknown>;
  const result: SearchParams = {};
  const errors: string[] = [];

  // Validate optional keyword
  if (params.keyword !== undefined) {
    const keywordResult = validateString(params.keyword);
    if (!keywordResult.success) {
      errors.push(`keyword: ${keywordResult.errors.join(", ")}`);
    } else {
      result.keyword = keywordResult.data;
    }
  }

  // Validate optional suit
  if (params.suit !== undefined) {
    const suitResult = validateEnum(
      ["wands", "cups", "swords", "pentacles"] as const,
      "suit"
    )(params.suit);
    if (!suitResult.success) {
      errors.push(`suit: ${suitResult.errors.join(", ")}`);
    } else {
      result.suit = suitResult.data;
    }
  }

  // Validate optional arcana
  if (params.arcana !== undefined) {
    const arcanaResult = validateEnum(
      ["major", "minor"] as const,
      "arcana"
    )(params.arcana);
    if (!arcanaResult.success) {
      errors.push(`arcana: ${arcanaResult.errors.join(", ")}`);
    } else {
      result.arcana = arcanaResult.data;
    }
  }

  // Validate optional element
  if (params.element !== undefined) {
    const elementResult = validateEnum(
      ["fire", "water", "air", "earth"] as const,
      "element"
    )(params.element);
    if (!elementResult.success) {
      errors.push(`element: ${elementResult.errors.join(", ")}`);
    } else {
      result.element = elementResult.data;
    }
  }

  // Validate optional number
  if (params.number !== undefined) {
    const numberResult = validateRange(0, 21)(params.number);
    if (!numberResult.success) {
      errors.push(`number: ${numberResult.errors.join(", ")}`);
    } else {
      result.number = numberResult.data;
    }
  }

  // Validate optional limit
  if (params.limit !== undefined) {
    const limitResult = validateRange(1, 100)(params.limit);
    if (!limitResult.success) {
      errors.push(`limit: ${limitResult.errors.join(", ")}`);
    } else {
      result.limit = limitResult.data;
    }
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success(result);
};

/**
 * Validates custom spread creation parameters
 */
export interface CustomSpreadParams {
  name: string;
  description: string;
  positions: Array<{
    name: string;
    meaning: string;
  }>;
}

export const validateCustomSpreadParams: Validator<CustomSpreadParams> = (value: unknown) => {
  if (typeof value !== "object" || value === null) {
    return failure(["Expected object for custom spread parameters"]);
  }

  const params = value as Record<string, unknown>;
  const errors: string[] = [];

  // Validate name
  const nameResult = validateString(params.name);
  if (!nameResult.success) {
    errors.push(`name: ${nameResult.errors.join(", ")}`);
  }

  // Validate description
  const descriptionResult = validateString(params.description);
  if (!descriptionResult.success) {
    errors.push(`description: ${descriptionResult.errors.join(", ")}`);
  }

  // Validate positions array
  if (!Array.isArray(params.positions)) {
    errors.push("positions: Expected array");
  } else {
    const positions = params.positions;

    if (positions.length === 0) {
      errors.push("positions: Array cannot be empty");
    } else if (positions.length > 15) {
      errors.push("positions: Maximum 15 positions allowed");
    } else {
      // Validate each position
      positions.forEach((position, index) => {
        if (typeof position !== "object" || position === null) {
          errors.push(`positions[${index}]: Expected object`);
          return;
        }

        const pos = position as Record<string, unknown>;

        const posNameResult = validateString(pos.name);
        if (!posNameResult.success) {
          errors.push(`positions[${index}].name: ${posNameResult.errors.join(", ")}`);
        }

        const posMeaningResult = validateString(pos.meaning);
        if (!posMeaningResult.success) {
          errors.push(`positions[${index}].meaning: ${posMeaningResult.errors.join(", ")}`);
        }
      });
    }
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success({
    name: nameResult.data!,
    description: descriptionResult.data!,
    positions: (params.positions as any[]).map(pos => ({
      name: pos.name,
      meaning: pos.meaning
    }))
  });
};

/**
 * Sanitizes input strings to prevent XSS and other attacks
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocols
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Validates and throws if validation fails
 */
export function validateOrThrow<T>(
  validator: Validator<T>,
  value: unknown,
  fieldName: string
): T {
  const result = validator(value);
  if (!result.success) {
    throw new ValidationError(fieldName, value, undefined, {
      errors: result.errors
    });
  }
  return result.data!;
}

/**
 * Combines multiple validators with AND logic
 */
export function combineValidators<T>(...validators: Validator<T>[]): Validator<T> {
  return (value: unknown) => {
    const allErrors: string[] = [];

    for (const validator of validators) {
      const result = validator(value);
      if (!result.success) {
        allErrors.push(...result.errors);
      }
    }

    if (allErrors.length > 0) {
      return failure(allErrors);
    }

    // If all validators pass, return success with the value from the last validator
    const lastResult = validators[validators.length - 1](value);
    return lastResult;
  };
}
