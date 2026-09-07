/** Minimal provider surface from the WebMCP 2026-09-04 Community Group draft.
 * https://webmachinelearning.github.io/webmcp/#modelcontext-interface
 * Kept local until this experimental API is included in TypeScript's DOM library.
 */
export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
    consequentialHint?: boolean;
  };
  // Chrome 152 omits options; newer implementations pass the draft's signal.
  execute(
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

export interface ModelContextProvider {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

export function getModelContext(): ModelContextProvider | undefined {
  if (typeof document === "undefined" || globalThis.isSecureContext === false)
    return undefined;
  const context = (
    document as Document & { modelContext?: ModelContextProvider }
  ).modelContext;
  return typeof context?.registerTool === "function" ? context : undefined;
}

/** Aborting the registration signal removes only the tools owned by this mount. */
export function registerWebMcpTools(
  context: ModelContextProvider,
  tools: WebMcpTool[],
) {
  const controller = new AbortController();
  const ready = (async () => {
    // React StrictMode can clean up its first mount before any registration begins.
    await Promise.resolve();
    try {
      for (const tool of tools) {
        if (controller.signal.aborted) return;
        await context.registerTool(tool, { signal: controller.signal });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      controller.abort(); // Roll back a partially registered tool set.
      throw error;
    }
  })();
  return { ready, dispose: () => controller.abort() };
}
