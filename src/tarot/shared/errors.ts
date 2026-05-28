/**
 * Custom error classes for the Tarot MCP Server
 */

export abstract class TarotError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Error thrown when a card is not found
 */
export class CardNotFoundError extends TarotError {
  readonly code = "CARD_NOT_FOUND";
  readonly statusCode = 404;

  constructor(cardName: string, context?: Record<string, any>) {
    super(`Card "${cardName}" not found`, { cardName, ...context });
  }
}

/**
 * Error thrown when an invalid spread type is requested
 */
export class InvalidSpreadError extends TarotError {
  readonly code = "INVALID_SPREAD";
  readonly statusCode = 400;

  constructor(spreadType: string, availableSpreads?: string[], context?: Record<string, any>) {
    const message = availableSpreads
      ? `Invalid spread type: ${spreadType}. Available spreads: ${availableSpreads.join(", ")}`
      : `Invalid spread type: ${spreadType}`;

    super(message, { spreadType, availableSpreads, ...context });
  }
}

/**
 * Error thrown when card data initialization fails
 */
export class CardDataError extends TarotError {
  readonly code = "CARD_DATA_ERROR";
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, any>) {
    super(`Card data error: ${message}`, context);
  }
}

/**
 * Error thrown when an invalid card count is requested
 */
export class InvalidCardCountError extends TarotError {
  readonly code = "INVALID_CARD_COUNT";
  readonly statusCode = 400;

  constructor(requested: number, available: number, context?: Record<string, any>) {
    super(
      `Cannot draw ${requested} cards from a deck of ${available} cards`,
      { requested, available, ...context }
    );
  }
}

/**
 * Error thrown when session operations fail
 */
export class SessionError extends TarotError {
  readonly code = "SESSION_ERROR";
  readonly statusCode = 400;

  constructor(message: string, sessionId?: string, context?: Record<string, any>) {
    super(`Session error: ${message}`, { sessionId, ...context });
  }
}

/**
 * Error thrown when search operations fail
 */
export class SearchError extends TarotError {
  readonly code = "SEARCH_ERROR";
  readonly statusCode = 400;

  constructor(message: string, query?: string, context?: Record<string, any>) {
    super(`Search error: ${message}`, { query, ...context });
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends TarotError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;

  constructor(field: string, value: any, expectedType?: string, context?: Record<string, any>) {
    const message = expectedType
      ? `Invalid ${field}: expected ${expectedType}, got ${typeof value}`
      : `Invalid ${field}: ${value}`;

    super(message, { field, value, expectedType, ...context });
  }
}

/**
 * Error thrown when cryptographic operations fail
 */
export class CryptoError extends TarotError {
  readonly code = "CRYPTO_ERROR";
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, any>) {
    super(`Cryptographic error: ${message}`, context);
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends TarotError {
  readonly code = "TOOL_EXECUTION_ERROR";
  readonly statusCode = 500;

  constructor(toolName: string, originalError: Error, context?: Record<string, any>) {
    super(
      `Tool execution failed for "${toolName}": ${originalError.message}`,
      { toolName, originalError: originalError.message, ...context }
    );
  }
}

/**
 * Type guard to check if an error is a TarotError
 */
export function isTarotError(error: unknown): error is TarotError {
  return error instanceof TarotError;
}

/**
 * Type guard to check if an error is a specific TarotError type
 */
export function isErrorType<T extends TarotError>(
  error: unknown,
  ErrorClass: new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass;
}

/**
 * Safely convert any error to a standardized format
 */
export function normalizeError(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
  context?: Record<string, any>;
} {
  if (isTarotError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
      statusCode: 500,
      context: { originalName: error.name },
    };
  }

  return {
    message: String(error),
    code: "UNKNOWN_ERROR",
    statusCode: 500,
    context: { type: typeof error },
  };
}

/**
 * Create a user-friendly error message without exposing sensitive details
 */
export function createSafeErrorMessage(error: unknown): string {
  if (isTarotError(error)) {
    // TarotErrors are designed to be user-safe
    return error.message;
  }

  if (error instanceof Error) {
    // Generic errors should be sanitized
    switch (error.name) {
      case "TypeError":
        return "Invalid input provided";
      case "ReferenceError":
        return "Internal reference error occurred";
      case "SyntaxError":
        return "Invalid syntax in request";
      default:
        return "An unexpected error occurred";
    }
  }

  return "An unknown error occurred";
}
