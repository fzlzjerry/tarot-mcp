#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(root, "assets/cards/v2/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const canonical = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;
const provenance = JSON.parse(
  await readFile(resolve(root, "assets/artwork/v2/provenance.json"), "utf8"),
);

const expectedIds = canonical.map((c) => c.id);
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function dimensions(path) {
  const { width, height } = await sharp(path).metadata();
  return `${width}x${height}`;
}

async function decodedRotationalMismatch(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mismatch = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const ox = info.width - 1 - x;
      const oy = info.height - 1 - y;
      const idx = (y * info.width + x) * info.channels;
      const oidx = (oy * info.width + ox) * info.channels;
      for (let c = 0; c < info.channels; c += 1) {
        if (data[idx + c] !== data[oidx + c]) mismatch += 1;
      }
    }
  }
  return mismatch;
}

check(manifest.schemaVersion === 2, "v2 manifest schemaVersion must be 2");
check(manifest.deckId === "midnight-art-nouveau-v2", "v2 manifest deckId mismatch");
check(manifest.status === "complete-78", "v2 manifest status must be complete-78");
check(manifest.cards?.length === 78, "v2 manifest must contain exactly 78 cards");
check(
  JSON.stringify((manifest.cards ?? []).map((c) => c.id)) ===
    JSON.stringify(expectedIds),
  "v2 manifest card ids/order must match canonical card-data.json",
);
check(
  Object.keys(provenance.cards ?? {}).length >= 78,
  "v2 provenance must contain at least 78 cards",
);

const webHashes = new Set();
const mcpHashes = new Set();
let totalWebBytes = 0;
let totalMcpBytes = 0;

for (const card of manifest.cards ?? []) {
  const provCard = provenance.cards?.[card.id];
  check(Boolean(provCard), `${card.id}: missing v2 provenance entry`);
  check(
    card.promptSha256 === provCard?.promptSha256,
    `${card.id}: manifest promptSha256 differs from provenance`,
  );
  check(
    card.web.path === `/assets/cards/midnight-art-nouveau-v2/${card.id}.webp`,
    `${card.id}: incorrect v2 Web URL`,
  );
  check(
    card.mcp.path === `/assets/cards/midnight-art-nouveau-v2/mcp/${card.id}.webp`,
    `${card.id}: incorrect v2 MCP URL`,
  );

  const webPath = resolve(root, card.web.physicalPath);
  const mcpPath = resolve(root, card.mcp.physicalPath);
  const [webStat, mcpStat] = await Promise.all([stat(webPath), stat(mcpPath)]);
  check((await dimensions(webPath)) === "640x960", `${card.id}: v2 Web image must be 640x960`);
  check((await dimensions(mcpPath)) === "192x288", `${card.id}: v2 MCP image must be 192x288`);
  check(webStat.size === card.web.bytes, `${card.id}: v2 Web byte mismatch`);
  check(mcpStat.size === card.mcp.bytes, `${card.id}: v2 MCP byte mismatch`);
  check(webStat.size <= 180_000, `${card.id}: v2 Web image exceeds 180 KB`);
  check(mcpStat.size <= 24_000, `${card.id}: v2 MCP image exceeds 24 KB`);
  check(webStat.size >= 20_000, `${card.id}: v2 Web image looks like a placeholder`);
  check(mcpStat.size >= 1_500, `${card.id}: v2 MCP image looks like a placeholder`);

  const [webHash, mcpHash] = await Promise.all([sha256(webPath), sha256(mcpPath)]);
  check(webHash === card.web.sha256, `${card.id}: v2 Web hash mismatch`);
  check(mcpHash === card.mcp.sha256, `${card.id}: v2 MCP hash mismatch`);
  check(!webHashes.has(webHash), `${card.id}: duplicate v2 Web hash`);
  check(!mcpHashes.has(mcpHash), `${card.id}: duplicate v2 MCP hash`);
  webHashes.add(webHash);
  mcpHashes.add(mcpHash);

  totalWebBytes += webStat.size;
  totalMcpBytes += mcpStat.size;
}

const backWebPath = resolve(root, manifest.cardBack.web.physicalPath);
const backMcpPath = resolve(root, manifest.cardBack.mcp.physicalPath);
const [backWebStat, backMcpStat] = await Promise.all([
  stat(backWebPath),
  stat(backMcpPath),
]);
check((await dimensions(backWebPath)) === "640x960", "v2 Web card back must be 640x960");
check((await dimensions(backMcpPath)) === "192x288", "v2 MCP card back must be 192x288");
check(backWebStat.size <= 260_000, "v2 Web card back exceeds 260 KB");
check(backMcpStat.size <= 24_000, "v2 MCP card back exceeds 24 KB");
check(
  manifest.cardBack.rotationalSymmetry === "180deg-exact-decoded-pixels",
  "v2 card back must declare 180deg-exact-decoded-pixels",
);
check(
  (await sha256(backWebPath)) === manifest.cardBack.web.sha256,
  "v2 Web card back hash mismatch",
);
check(
  (await sha256(backMcpPath)) === manifest.cardBack.mcp.sha256,
  "v2 MCP card back hash mismatch",
);
check(
  (await decodedRotationalMismatch(backWebPath)) === 0,
  "v2 decoded Web card back is not pixel-exact under 180° rotation",
);
check(
  (await decodedRotationalMismatch(backMcpPath)) === 0,
  "v2 decoded MCP card back is not pixel-exact under 180° rotation",
);

const bundledMcpRawBytes = totalMcpBytes + backMcpStat.size;
const bundledMcpBase64Bytes = [...manifest.cards, manifest.cardBack].reduce(
  (sum, entry) => sum + 4 * Math.ceil(entry.mcp.bytes / 3),
  0,
);
check(
  bundledMcpRawBytes <= 600_000,
  `v2 bundled MCP artwork uses ${bundledMcpRawBytes} raw bytes; budget is 600000`,
);
check(
  bundledMcpBase64Bytes <= 800_000,
  `v2 bundled MCP artwork uses ${bundledMcpBase64Bytes} base64 bytes; budget is 800000`,
);

if (errors.length > 0) {
  console.error(`v2 deck validation failed with ${errors.length} error(s):`);
  for (const err of errors.slice(0, 30)) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `Validated v2 deck (${manifest.model}): 78 cards + symmetric back; Web ${totalWebBytes + backWebStat.size} bytes, bundled MCP ${bundledMcpRawBytes} raw / ${bundledMcpBase64Bytes} base64 bytes.`,
);
