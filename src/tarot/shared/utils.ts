// Use global crypto in Node.js >= 18 and browsers
declare const crypto: any;

const UINT32_RANGE = 0x100000000;

function getSecureRandomUint32(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
  }
  throw new Error('A secure random number generator (crypto.getRandomValues) is not available in this environment.');
}

/**
 * Generate a cryptographically secure random number between 0 and 1.
 * @throws {Error} If crypto.getRandomValues is not available.
 */
export function getSecureRandom(): number {
  return getSecureRandomUint32() / UINT32_RANGE;
}

/**
 * Generate a cryptographically secure unbiased integer in [0, maxExclusive).
 * @throws {Error} If maxExclusive is not a positive integer or crypto is unavailable.
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

  while (true) {
    const value = getSecureRandomUint32();
    if (value < unbiasedLimit) {
      return value % maxExclusive;
    }
  }
}
