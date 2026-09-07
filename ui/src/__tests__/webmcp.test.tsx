import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DrawApp } from "../DrawApp.js";
import {
  getModelContext,
  registerWebMcpTools,
  type ModelContextProvider,
  type WebMcpTool,
} from "../webmcp/registration.js";
import type { BeginReadingPayload, DrawClient } from "../types.js";

function registry() {
  const tools = new Map<string, WebMcpTool>();
  const context: ModelContextProvider = {
    registerTool: vi.fn(async (tool, options) => {
      if (options?.signal?.aborted) return;
      if (tools.has(tool.name)) throw new Error("Duplicate tool");
      tools.set(tool.name, tool);
      options?.signal?.addEventListener(
        "abort",
        () => tools.delete(tool.name),
        { once: true },
      );
    }),
  };
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: context,
  });
  return { context, tools };
}

const draw: BeginReadingPayload = {
  drawId: "private-draw",
  readingKind: "spread",
  spreadType: "three_card",
  spreadName: "Three Card Spread",
  question: "What next?",
  language: "en",
  requiredCount: 3,
  deckBackImageUri: "data:image/webp;base64,YmFjaw==",
  slots: Array.from({ length: 78 }, (_, index) => ({
    slotId: `private-slot-${index}`,
    index,
  })),
};

function client(): DrawClient {
  return {
    target: "web",
    beginReading: vi.fn(async () => draw),
    confirmReading: vi.fn(async () => ({
      spreadType: "three_card",
      spreadName: "Three Card Spread",
      question: draw.question,
      language: "en" as const,
      cards: ["fool", "magician", "world"].map((name) => ({
        id: name,
        name,
        displayName: name,
        orientation: "upright" as const,
        imageUri: "private-image",
      })),
    })),
  };
}

afterEach(() => {
  Reflect.deleteProperty(document, "modelContext");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WebMCP registration lifecycle", () => {
  it("leaves unsupported and insecure browsers untouched", () => {
    expect(getModelContext()).toBeUndefined();
    const { context } = registry();
    expect(getModelContext()).toBe(context);
    vi.stubGlobal("isSecureContext", false);
    expect(getModelContext()).toBeUndefined();
  });

  it("skips an already disposed mount and rolls back partial registration failures", async () => {
    const { context, tools } = registry();
    const tool: WebMcpTool = {
      name: "test",
      description: "Test",
      inputSchema: { type: "object" },
      execute: async () => ({}),
    };
    const disposed = registerWebMcpTools(context, [tool]);
    disposed.dispose();
    await disposed.ready;
    expect(context.registerTool).not.toHaveBeenCalled();

    const denied = new DOMException(
      "Tools permission denied",
      "NotAllowedError",
    );
    vi.mocked(context.registerTool)
      .mockImplementationOnce(async (entry, options) => {
        tools.set(entry.name, entry);
        options?.signal?.addEventListener(
          "abort",
          () => tools.delete(entry.name),
          { once: true },
        );
      })
      .mockRejectedValueOnce(denied);
    const partial = registerWebMcpTools(context, [
      tool,
      { ...tool, name: "second" },
    ]);
    await expect(partial.ready).rejects.toBe(denied);
    expect(tools.size).toBe(0);
  });

  it("registers once through StrictMode and removes its tools on unmount", async () => {
    const { tools, context } = registry();
    const view = render(
      <StrictMode>
        <DrawApp client={client()} />
      </StrictMode>,
    );
    await waitFor(() => expect(tools.size).toBe(3));
    expect(context.registerTool).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(tools.size).toBe(0);
  });

  it("keeps the manual interface usable when registration is denied", async () => {
    const { context } = registry();
    vi.mocked(context.registerTool).mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    render(<DrawApp client={client()} />);
    await waitFor(() => expect(warning).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Lay out the deck" }),
    ).not.toBeNull();
  });

  it("does not register browser tools in the MCP App", async () => {
    const { context } = registry();
    render(<DrawApp client={{ ...client(), target: "mcp" }} />);
    await act(async () => undefined);
    expect(context.registerTool).not.toHaveBeenCalled();
  });
});

describe("WebMCP uses the visible reading", () => {
  it("supports Chrome 152 callbacks and returns results only after manual confirmation", async () => {
    const user = userEvent.setup();
    const { tools } = registry();
    const drawClient = client();
    render(<DrawApp client={drawClient} />);
    await waitFor(() => expect(tools.size).toBe(3));
    const invoke = (name: string, input = {}) =>
      tools.get(name)!.execute(input);

    const catalog = (await invoke("list_available_spreads", {
      language: "zh",
    })) as { spreads: unknown[] };
    expect(catalog.spreads).toHaveLength(25);
    await expect(
      invoke("list_available_spreads", { language: "invalid" }),
    ).rejects.toThrow("Language");
    await act(async () => {
      await invoke("begin_visual_reading", {
        readingKind: "spread",
        spreadType: "three_card",
        question: draw.question,
        language: "en" as const,
      });
    });
    expect(
      screen.getByRole("heading", { name: "Shuffle and cut" }),
    ).not.toBeNull();
    const pending = await invoke("get_visual_reading_state");
    expect(pending).toMatchObject({
      stage: "ritual",
      requiredCount: 3,
      selectedCount: 0,
    });
    expect(JSON.stringify(pending)).not.toMatch(/private-|cards|token|slots/);
    await expect(
      invoke("begin_visual_reading", { readingKind: "daily", language: "en" }),
    ).rejects.toThrow("already in progress");

    await user.click(screen.getByRole("button", { name: "Skip and deal" }));
    for (const index of [1, 2, 3])
      await user.click(
        screen.getByRole("button", { name: `Card back ${index}` }),
      );
    expect(await invoke("get_visual_reading_state")).toMatchObject({
      stage: "selecting",
      selectedCount: 3,
    });
    await user.click(screen.getByRole("button", { name: "Confirm selection" }));
    await screen.findByRole("heading", { name: "Your reading" });
    const result = await invoke("get_visual_reading_state");
    expect(result).toMatchObject({
      stage: "reading",
      reading: {
        cards: [{ name: "fool" }, { name: "magician" }, { name: "world" }],
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/private-|imageUri|token|slots/);
    await user.click(screen.getByRole("button", { name: "New reading" }));
    expect(await invoke("get_visual_reading_state")).toEqual({
      stage: "setup",
      language: "en" as const,
    });
  });

  it("forwards cancellation and rejects stale responses without changing the page", async () => {
    const { tools } = registry();
    const drawClient = client();
    let resolve!: (value: BeginReadingPayload) => void;
    vi.mocked(drawClient.beginReading).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<DrawApp client={drawClient} />);
    await waitFor(() => expect(tools.size).toBe(3));
    const controller = new AbortController();
    let invocation!: Promise<unknown>;
    act(() => {
      invocation = tools
        .get("begin_visual_reading")!
        .execute(
          { readingKind: "daily", language: "en" },
          { signal: controller.signal },
        );
    });
    const rejection = expect(invocation).rejects.toMatchObject({
      name: "AbortError",
    });
    await act(async () => {
      controller.abort();
      resolve(draw);
      await rejection;
    });
    expect(
      vi.mocked(drawClient.beginReading).mock.calls[0][1]?.signal?.aborted,
    ).toBe(true);
    expect(await tools.get("get_visual_reading_state")!.execute({})).toEqual({
      stage: "setup",
      language: "en" as const,
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
