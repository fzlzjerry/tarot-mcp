import { jest } from "@jest/globals";
import { getSecureRandomInt } from "../tarot/shared/utils.js";

describe("secure random utilities", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });

  it("rejects out-of-range uint32 values to avoid modulo bias", () => {
    const values = [0xffffffff, 4];
    const getRandomValues = jest.fn((array: Uint32Array) => {
      const value = values.shift();
      if (value === undefined) {
        throw new Error("Unexpected random draw");
      }
      array[0] = value;
      return array;
    });

    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues },
      writable: true,
      configurable: true,
    });

    expect(getSecureRandomInt(3)).toBe(1);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid exclusive upper bounds", () => {
    expect(() => getSecureRandomInt(0)).toThrow("positive integer");
    expect(() => getSecureRandomInt(1.5)).toThrow("positive integer");
  });
});
