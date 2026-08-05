import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VISUAL_APP_RESOURCE_URI } from "./tool-definitions.js";

export const VISUAL_APP_MIME_TYPE = "text/html;profile=mcp-app";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const HTML_CANDIDATES = [
  // Production build: dist/mcp -> dist/ui.
  join(moduleDirectory, "..", "ui", "mcp-app.html"),
  // Development processes run source modules but still embed the built,
  // single-file MCP app. The raw source entry imports external modules and is
  // therefore not a valid sandbox resource.
  join(process.cwd(), "dist", "ui", "mcp-app.html"),
];

const FALLBACK_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual Tarot Reading</title></head>
  <body><main><h1>Visual Tarot Reading</h1><p>The interactive view asset is not present in this build. The reading remains available in the tool response.</p></main></body>
</html>`;

export function getVisualAppResourceDefinition() {
  return {
    uri: VISUAL_APP_RESOURCE_URI,
    name: "Visual tarot reading",
    description:
      "Interactive dark Art Nouveau tarot deck for choosing and revealing cards",
    mimeType: VISUAL_APP_MIME_TYPE,
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
      "openai/widgetPrefersBorder": false,
      "openai/widgetCSP": {
        connect_domains: [],
        resource_domains: [],
      },
    },
  };
}

export async function readVisualAppResource(uri: string) {
  let html = FALLBACK_HTML;
  for (const candidate of HTML_CANDIDATES) {
    try {
      html = await readFile(candidate, "utf8");
      break;
    } catch {
      // Try the next source/build location; text fallback preserves MCP calls.
    }
  }

  return {
    contents: [
      {
        uri,
        mimeType: VISUAL_APP_MIME_TYPE,
        text: html,
        _meta: getVisualAppResourceDefinition()._meta,
      },
    ],
  };
}
