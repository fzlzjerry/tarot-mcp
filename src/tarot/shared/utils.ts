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
