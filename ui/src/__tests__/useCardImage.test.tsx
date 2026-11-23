import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { DrawClient, ReadingCard } from "../types.js";
import { useCardImage } from "../useCardImage.js";

const fool: ReadingCard = {
  id: "fool",
  name: "The Fool",
  displayName: "The Fool",
  orientation: "upright",
};
const world: ReadingCard = {
  id: "world",
  name: "The World",
  displayName: "The World",
  orientation: "upright",
};

function createClient(
  resolveSharpImage: NonNullable<DrawClient["resolveSharpImage"]>,
): DrawClient {
  return {
    target: "mcp",
    beginReading: vi.fn<DrawClient["beginReading"]>(),
    confirmReading: vi.fn<DrawClient["confirmReading"]>(),
    resolveImage: async (card) => `small:${card.id}`,
    resolveSharpImage,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("useCardImage", () => {
  it("shows the immediate face, then the sharper one once it has arrived", async () => {
    let deliver!: (source: string) => void;
    const client = createClient(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        }),
    );
    const { result } = renderHook(() => useCardImage(client, fool));

    await waitFor(() => expect(result.current[0]).toBe("small:fool"));
    deliver("sharp:fool");
    await waitFor(() => expect(result.current[0]).toBe("sharp:fool"));
    expect(result.current[1]).toBe(false);
  });

  it("asks for nothing sharper while the card is face down", async () => {
    const resolveSharpImage = vi.fn(
      async (card: ReadingCard) => `sharp:${card.id}`,
    );
    const client = createClient(resolveSharpImage);
    const { result, rerender } = renderHook(
      ({ sharp }) => useCardImage(client, fool, sharp),
      { initialProps: { sharp: false } },
    );

    await waitFor(() => expect(result.current[0]).toBe("small:fool"));
    expect(resolveSharpImage).not.toHaveBeenCalled();

    rerender({ sharp: true });
    await waitFor(() => expect(result.current[0]).toBe("sharp:fool"));
    expect(resolveSharpImage).toHaveBeenCalledTimes(1);
  });

  it.each<[string, NonNullable<DrawClient["resolveSharpImage"]>]>([
    ["is missing", async () => undefined],
    ["fails", () => Promise.reject(new Error("Request timed out"))],
  ])(
    "keeps the immediate face when the sharper one %s",
    async (_case, resolveSharpImage) => {
      const client = createClient(resolveSharpImage);
      const { result } = renderHook(() => useCardImage(client, fool));

      await waitFor(() => expect(result.current[0]).toBe("small:fool"));
      await act(async () => {});
      expect(result.current).toEqual(["small:fool", false]);
    },
  );

  it("keeps the immediate face when the sharper one will not decode", async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, "decode")
      .mockRejectedValue(new DOMException("Invalid image", "EncodingError"));
    const client = createClient(async () => "sharp:fool");
    const { result } = renderHook(() => useCardImage(client, fool));

    await waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(result.current).toEqual(["small:fool", false]);
  });

  it("never shows one card's sharper face on the next card", async () => {
    const client = createClient((card) =>
      card.id === "fool"
        ? Promise.resolve("sharp:fool")
        : new Promise(() => {}),
    );
    const { result, rerender } = renderHook(
      ({ card }) => useCardImage(client, card),
      { initialProps: { card: fool } },
    );
    await waitFor(() => expect(result.current[0]).toBe("sharp:fool"));

    rerender({ card: world });
    expect(result.current[0]).not.toBe("sharp:fool");
    await waitFor(() => expect(result.current[0]).toBe("small:world"));
  });
});
