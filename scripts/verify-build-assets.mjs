#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function requireMatchingFile(sourcePath, distPath, label) {
  const [source, dist] = await Promise.all([
    readFile(sourcePath),
    readFile(distPath),
  ]);
  if (sha256(source) !== sha256(dist)) {
    throw new Error(`${label} in dist does not match its source.`);
  }
  return dist;
}

const sourceCardDataPath = join(
  rootDir,
  "src",
  "tarot",
  "cards",
  "card-data.json",
);
const distCardDataPath = join(
  rootDir,
  "dist",
  "tarot",
  "cards",
  "card-data.json",
);
const cardData = JSON.parse(
  (
    await requireMatchingFile(
      sourceCardDataPath,
      distCardDataPath,
      "Canonical card data",
    )
  ).toString("utf8"),
);
if (!Array.isArray(cardData.cards) || cardData.cards.length !== 78) {
  throw new Error("dist tarot card data must contain exactly 78 cards.");
}
const expectedIds = cardData.cards.map((card) => card.id);

// Verify all 5 modular 78-card Canon data files match dist
const canonFiles = [
  "major.json",
  "wands.json",
  "cups.json",
  "swords.json",
  "pentacles.json",
];
let canonCardCount = 0;
for (const file of canonFiles) {
  const buf = await requireMatchingFile(
    join(rootDir, "src", "tarot", "canon", "data", file),
    join(rootDir, "dist", "tarot", "canon", "data", file),
    `Card Canon (${file})`,
  );
  canonCardCount += Object.keys(JSON.parse(buf.toString("utf8"))).length;
}
if (canonCardCount !== 78) {
  throw new Error(`dist Card Canon must contain 78 cards; found ${canonCardCount}.`);
}

await Promise.all([
  requireMatchingFile(
    join(rootDir, "assets", "ASSET_LICENSE.md"),
    join(rootDir, "dist", "assets", "ASSET_LICENSE.md"),
    "Artwork license",
  ),
  requireMatchingFile(
    join(rootDir, "assets", "artwork", "v2", "provenance.json"),
    join(rootDir, "dist", "assets", "artwork", "v2", "provenance.json"),
    "v2 prompt provenance",
  ),
  requireMatchingFile(
    join(rootDir, "assets", "cards", "v2", "foil-mask.svg"),
    join(rootDir, "dist", "assets", "cards", "v2", "foil-mask.svg"),
    "v2 foil mask",
  ),
]);

// Verify primary production v2 deck in dist/assets/cards/v2
const v2Manifest = JSON.parse(
  (
    await requireMatchingFile(
      join(rootDir, "assets", "cards", "v2", "manifest.json"),
      join(rootDir, "dist", "assets", "cards", "v2", "manifest.json"),
      "v2 artwork manifest",
    )
  ).toString("utf8"),
);
if (
  v2Manifest.deckId !== "midnight-art-nouveau-v2" ||
  v2Manifest.assetBase !== "/assets/cards/midnight-art-nouveau-v2-r2" ||
  !Array.isArray(v2Manifest.cards) ||
  v2Manifest.cards.length !== 78
) {
  throw new Error("dist v2 artwork manifest is incomplete or has the wrong deck id/asset base.");
}
const v2ManifestIds = v2Manifest.cards.map((card) => card.id);
if (JSON.stringify(expectedIds) !== JSON.stringify(v2ManifestIds)) {
  throw new Error("dist v2 artwork manifest IDs/order differ from card-data.json.");
}

const sourceV2Dir = join(rootDir, "assets", "cards", "v2");
const distV2Dir = join(rootDir, "dist", "assets", "cards", "v2");
let webBytes = 0;
let mcpBytes = 0;
const mcpSizes = [];

for (const card of v2Manifest.cards) {
  for (const variant of ["web", "mcp"]) {
    const relativePath =
      variant === "web" ? `${card.id}.webp` : join("mcp", `${card.id}.webp`);
    const bytes = await requireMatchingFile(
      join(sourceV2Dir, relativePath),
      join(distV2Dir, relativePath),
      `${card.id} v2 ${variant} artwork`,
    );
    const metadata = await sharp(bytes).metadata();
    const expected = variant === "web" ? [640, 960, 180_000] : [192, 288, 24_000];
    if (metadata.width !== expected[0] || metadata.height !== expected[1]) {
      throw new Error(`${card.id} v2 ${variant} artwork has wrong dimensions.`);
    }
    if (bytes.length > expected[2]) {
      throw new Error(`${card.id} v2 ${variant} artwork exceeds its hard size limit.`);
    }
    if (variant === "web") webBytes += bytes.length;
    else {
      mcpBytes += bytes.length;
      mcpSizes.push(bytes.length);
    }
  }
}

for (const variant of ["web", "mcp"]) {
  const relativePath = variant === "web" ? "back.webp" : join("mcp", "back.webp");
  const bytes = await requireMatchingFile(
    join(sourceV2Dir, relativePath),
    join(distV2Dir, relativePath),
    `v2 ${variant} card back`,
  );
  if (variant === "web") webBytes += bytes.length;
  else {
    mcpBytes += bytes.length;
    mcpSizes.push(bytes.length);
  }
}

const directWebpNames = (await readdir(distV2Dir))
  .filter((name) => name.endsWith(".webp"))
  .sort();
const directMcpWebpNames = (await readdir(join(distV2Dir, "mcp")))
  .filter((name) => name.endsWith(".webp"))
  .sort();
const expectedWebpNames = [...expectedIds.map((id) => `${id}.webp`), "back.webp"].sort();
if (
  JSON.stringify(directWebpNames) !== JSON.stringify(expectedWebpNames) ||
  JSON.stringify(directMcpWebpNames) !== JSON.stringify(expectedWebpNames)
) {
  throw new Error("dist v2 artwork contains missing or orphaned WebP files.");
}

const bundledMcpBase64Bytes = mcpSizes.reduce(
  (total, bytes) => total + 4 * Math.ceil(bytes / 3),
  0,
);
if (mcpBytes > 600_000 || bundledMcpBase64Bytes > 800_000) {
  throw new Error(
    `Bundled v2 MCP artwork budget exceeded (${mcpBytes} raw, ${bundledMcpBase64Bytes} base64 bytes).`,
  );
}

const webHtmlPath = join(rootDir, "dist", "ui", "web", "index.html");
const mcpHtmlPath = join(rootDir, "dist", "ui", "mcp-app.html");
const [webHtml, mcpHtml] = await Promise.all([
  readFile(webHtmlPath, "utf8"),
  readFile(mcpHtmlPath, "utf8"),
]);
if (!webHtml.includes('<div id="root"></div>') || !webHtml.includes("/draw/assets/")) {
  throw new Error("dist Web visual-reading entry is not a valid /draw build.");
}
if (
  !mcpHtml.includes('<div id="root"></div>') ||
  !mcpHtml.includes("begin_visual_reading") ||
  /<script\b[^>]*\bsrc\s*=/i.test(mcpHtml) ||
  /<link\b[^>]*\brel=["']?stylesheet["']?[^>]*\bhref\s*=/i.test(mcpHtml)
) {
  throw new Error("dist MCP App must be a self-contained single HTML file.");
}
const bundledMcpImageCount =
  mcpHtml.match(/data:image\/webp;base64,/g)?.length ?? 0;
if (bundledMcpImageCount !== 79) {
  throw new Error(
    `dist MCP App must bundle exactly 78 card faces and one back; found ${bundledMcpImageCount}.`,
  );
}
if ((await stat(mcpHtmlPath)).size > 1_500_000) {
  throw new Error("dist MCP App exceeds the 1.5 MB resource budget.");
}

console.log(
  `Verified build: 78 v2 cards + symmetric back + 78-card Canon, Web ${webBytes} bytes, MCP ${mcpBytes} bytes, single-file App ${(
    await stat(mcpHtmlPath)
  ).size} bytes.`,
);
