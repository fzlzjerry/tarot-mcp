import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VISUAL_APP_RESOURCE_URI } from "./tool-definitions.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const HTML_CANDIDATES = [
  // Production build: dist/mcp -> dist/ui.
  join(moduleDirectory, "..", "ui", "mcp-app.html"),
  // Development processes run source modules but still embed the built,
  // single-file MCP app. The raw source entry imports external modules and is
  // therefore not a valid sandbox resource.
  join(process.cwd(), "dist", "ui", "mcp-app.html"),
];

export function getVisualAppResourceDefinition() {
  return {
    uri: VISUAL_APP_RESOURCE_URI,
    name: "Visual tarot reading",
    description:
      "Interactive dark Art Nouveau tarot deck for choosing and revealing cards",
    mimeType: RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: false,
        csp: {
          connectDomains: [],
          resourceDomains: [],
          frameDomains: [],
          baseUriDomains: [],
        },
      },
      "openai/widgetDescription":
        "Choose card backs from an interactive tarot deck, then reveal the confirmed reading.",
    },
  };
}

export async function readVisualAppResource(uri: string) {
  for (const candidate of HTML_CANDIDATES) {
    try {
      const html = await readFile(candidate, "utf8");
      return {
        contents: [
          {
            uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: getVisualAppResourceDefinition()._meta,
          },
        ],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new McpError(
    ErrorCode.InternalError,
    "Visual tarot UI build is missing. Run npm run build before starting the server.",
  );
}
