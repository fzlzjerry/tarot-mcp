import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type * as FsPromises from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import { createMcpProtocolServer } from "../mcp/protocol-server.js";
import { TOOL_NAMES } from "../mcp/public-api.js";
import { TarotServer } from "../mcp/tarot-service.js";
import { VISUAL_APP_RESOURCE_URI } from "../mcp/tool-definitions.js";
import { readVisualAppResource } from "../mcp/visual-app-resource.js";

const htmlFiles = vi.hoisted(() => ({
  paths: new Set<string>(),
  read: vi.fn<(path: string) => Promise<string>>(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    readFile: (
      path: Parameters<typeof actual.readFile>[0],
      options: Parameters<typeof actual.readFile>[1],
    ) => {
      if (typeof path === "string" && htmlFiles.paths.has(path)) {
        return htmlFiles.read(path);
      }
      return actual.readFile(path, options);
    },
  };
});

const sourceRelativeHtml = fileURLToPath(
  new URL("../ui/mcp-app.html", import.meta.url),
);
const builtHtml = join(process.cwd(), "dist", "ui", "mcp-app.html");
htmlFiles.paths.add(sourceRelativeHtml);
htmlFiles.paths.add(builtHtml);

function filesystemError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`Cannot read the visual app: ${code}`), {
    code,
  });
}

describe("visual app resource availability", () => {
  beforeEach(() => {
    htmlFiles.read.mockReset();
    htmlFiles.read.mockRejectedValue(filesystemError("ENOENT"));
  });

  it("loads the built app when the module-relative candidate is missing", async () => {
    const html =
      '<!doctype html><html><body><div id="root"></div></body></html>';
    htmlFiles.read.mockImplementation(async (path) => {
      if (path === builtHtml) return html;
      throw filesystemError("ENOENT");
    });

    const result = await readVisualAppResource(VISUAL_APP_RESOURCE_URI);

    expect(result.contents).toEqual([
      expect.objectContaining({
        uri: VISUAL_APP_RESOURCE_URI,
        mimeType: "text/html;profile=mcp-app",
        text: html,
      }),
    ]);
    expect(htmlFiles.read.mock.calls.map(([path]) => path)).toEqual([
      sourceRelativeHtml,
      builtHtml,
    ]);
  });

  it("fails with an MCP internal error when neither HTML candidate exists", async () => {
    const result = readVisualAppResource(VISUAL_APP_RESOURCE_URI);

    await expect(result).rejects.toBeInstanceOf(McpError);
    await expect(result).rejects.toMatchObject({
      code: ErrorCode.InternalError,
    });
  });

  it("preserves a filesystem failure rather than hiding it with another candidate", async () => {
    const denied = filesystemError("EACCES");
    htmlFiles.read
      .mockResolvedValue(
        "<!doctype html><html><body>Another build</body></html>",
      )
      .mockRejectedValueOnce(denied);

    await expect(readVisualAppResource(VISUAL_APP_RESOURCE_URI)).rejects.toBe(
      denied,
    );
    expect(htmlFiles.read).toHaveBeenCalledTimes(1);
  });

  it("rejects resources/read over MCP without disabling the card information tool", async () => {
    const tarotServer = await TarotServer.create();
    const server = createMcpProtocolServer(tarotServer);
    const client = new Client({
      name: "resource-failure-test",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      await expect(
        client.readResource({ uri: VISUAL_APP_RESOURCE_URI }),
      ).rejects.toMatchObject({ code: ErrorCode.InternalError });

      const result = await client.callTool({
        name: TOOL_NAMES.getCardInfo,
        arguments: { cardName: "The Fool", language: "en" },
      });
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            text: expect.stringContaining("The Fool"),
          }),
        ]),
      );
    } finally {
      await client.close();
      await server.close();
    }
  });
});
