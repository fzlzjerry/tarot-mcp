import { webcrypto } from "node:crypto";

const UINT32_RANGE = 0x100000000;

function getSecureRandomUint32(): number {
  const array = new Uint32Array(1);
  webcrypto.getRandomValues(array);
  return array[0];
}

/**
 * Generate a cryptographically secure unbiased integer in [0, maxExclusive).
 * @throws {Error} If maxExclusive is not a positive integer up to 2^32.
 */
export function getSecureRandomInt(maxExclusive: number): number {
  if (
    !Number.isInteger(maxExclusive) ||
    maxExclusive <= 0 ||
    maxExclusive > UINT32_RANGE
  ) {
    throw new Error("maxExclusive must be a positive integer up to 2^32");
  }

  const unbiasedLimit =
    UINT32_RANGE - (UINT32_RANGE % maxExclusive);

  for (;;) {
    const value = getSecureRandomUint32();
    if (value < unbiasedLimit) {
      return value % maxExclusive;
    }
  }
}

/**
 * Fisher-Yates shuffle using cryptographically secure randomness.
 * Returns a new array; the input is not mutated.
 */
export function fisherYatesShuffle<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a unique, hard-to-guess ID like "reading_1700000000000_abc123".
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const randomPart = getSecureRandomInt(1000000000).toString(36);
  return `${prefix}_${timestamp}_${randomPart}`;
}
