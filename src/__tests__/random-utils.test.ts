import { jest } from "@jest/globals";
import { webcrypto } from "node:crypto";
import { getSecureRandomInt } from "../tarot/shared/utils.js";

describe("secure random utilities", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects out-of-range uint32 values to avoid modulo bias", () => {
    const values = [0xffffffff, 4];
    const getRandomValues = jest
      .spyOn(webcrypto, "getRandomValues")
      .mockImplementation(((array: Uint32Array) => {
        const value = values.shift();
        if (value === undefined) {
          throw new Error("Unexpected random draw");
        }
        array[0] = value;
        return array;
      }) as typeof webcrypto.getRandomValues);

    expect(getSecureRandomInt(3)).toBe(1);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid exclusive upper bounds", () => {
    expect(() => getSecureRandomInt(0)).toThrow("positive integer");
    expect(() => getSecureRandomInt(1.5)).toThrow("positive integer");
  });

  it("returns values uniformly within [0, maxExclusive)", () => {
    for (let i = 0; i < 200; i++) {
      const value = getSecureRandomInt(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
