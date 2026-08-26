import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import express, { type Express, type Response } from "express";
import { HTTP_ENDPOINTS } from "./public-api.js";

export function firstExistingDirectory(
  candidates: string[],
): string | undefined {
  return candidates.find((candidate) => existsSync(candidate));
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function resolveVisualAssetDirectories(moduleDirectory: string): {
  webDirectory: string | undefined;
  cardDirectory: string | undefined;
} {
  return {
    webDirectory: firstExistingDirectory([
      join(moduleDirectory, "..", "ui", "web"),
      join(process.cwd(), "dist", "ui", "web"),
    ]),
    cardDirectory: firstExistingDirectory([
      join(moduleDirectory, "..", "assets", "cards"),
      join(process.cwd(), "dist", "assets", "cards"),
      join(process.cwd(), "assets", "cards"),
    ]),
  };
}

export interface VisualWebAssetOptions {
  setDocumentHeaders(res: Response): void;
  htmlCacheControl: string;
  missingBuildMessage: string;
}

/** Mount `/draw` and versioned card assets. Callers keep their own CSP/cache. */
export function mountVisualWebAssets(
  app: Express,
  moduleDirectory: string,
  options: VisualWebAssetOptions,
): void {
  const { webDirectory, cardDirectory } =
    resolveVisualAssetDirectories(moduleDirectory);

  if (webDirectory) {
    const indexPath = join(webDirectory, "index.html");
    app.get(
      [HTTP_ENDPOINTS.draw, `${HTTP_ENDPOINTS.draw}/`],
      (_req, res, next) => {
        options.setDocumentHeaders(res);
        res.sendFile(indexPath, (error) => {
          if (error && !res.headersSent) next(error);
        });
      },
    );
    app.use(
      HTTP_ENDPOINTS.draw,
      express.static(webDirectory, {
        index: false,
        fallthrough: true,
        setHeaders: (res, filePath) => {
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader(
            "Cache-Control",
            filePath.endsWith(".html")
              ? options.htmlCacheControl
              : "public, max-age=31536000, immutable",
          );
        },
      }),
    );
  } else {
    app.get(
      [HTTP_ENDPOINTS.draw, `${HTTP_ENDPOINTS.draw}/`],
      (_req, res) => {
        options.setDocumentHeaders(res);
        res.status(503).type("text/plain").send(options.missingBuildMessage);
      },
    );
  }

  if (cardDirectory) {
    app.use(
      HTTP_ENDPOINTS.visualCardAssets,
      express.static(cardDirectory, {
        index: false,
        fallthrough: true,
        immutable: true,
        maxAge: "1y",
        setHeaders: (res) => {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
          res.setHeader("X-Content-Type-Options", "nosniff");
        },
      }),
    );
  }
}
