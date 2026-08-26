/**
 * Uniform result of a tool execution. `structured` is reserved for MCP
 * structuredContent payloads. Error text keeps its historical "Error: ..."
 * form so transport output stays byte-compatible.
 */
export type ToolResult =
  | { ok: true; text: string; structured?: object }
  | { ok: false; error: string; code?: string; httpStatus?: number };

export function toolOk(text: string, structured?: object): ToolResult {
  return structured === undefined
    ? { ok: true, text }
    : { ok: true, text, structured };
}

export function toolError(
  error: string,
  code?: string,
  httpStatus?: number,
): ToolResult {
  return {
    ok: false,
    error,
    ...(code ? { code } : {}),
    ...(httpStatus ? { httpStatus } : {}),
  };
}
