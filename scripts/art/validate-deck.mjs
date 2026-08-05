#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(root, "assets/cards/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const canonical = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;
const provenance = JSON.parse(
  await readFile(resolve(root, "assets/artwork/prompt-provenance.json"), "utf8"),
);
const manualReview = JSON.parse(
  await readFile(resolve(root, "assets/cards/qa/manual-review.json"), "utf8"),
);
const ocrAudit = JSON.parse(
  await readFile(resolve(root, "assets/cards/qa/ocr-audit.json"), "utf8"),
);

const expectedIds = canonical.map((card) => card.id);
const provenanceById = new Map(
  (provenance.cards ?? []).map((card) => [card.id, card]),
);
const rankLabels = {
  1: "A",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "P",
  12: "N",
  13: "Q",
  14: "K",
};
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
      const oppositeX = info.width - 1 - x;
      const oppositeY = info.height - 1 - y;
      const index = (y * info.width + x) * info.channels;
      const opposite = (oppositeY * info.width + oppositeX) * info.channels;
      for (let channel = 0; channel < info.channels; channel += 1) {
        if (data[index + channel] !== data[opposite + channel]) mismatch += 1;
      }
    }
  }
  return mismatch;
}

check(manifest.schemaVersion === 1, "manifest schemaVersion must be 1");
check(
  manifest.deckId === "midnight-art-nouveau-v1",
  "manifest deckId mismatch",
);
check(manifest.cards.length === 78, "manifest must contain exactly 78 cards");
check(
  JSON.stringify(manifest.cards.map((card) => card.id)) ===
    JSON.stringify(expectedIds),
  "manifest card ids/order must match canonical card-data.json",
);
check(
  provenance.cards?.length === 78,
  "prompt provenance must contain exactly 78 cards",
);
check(
  provenance.generator === "OpenAI built-in image_gen",
  "prompt provenance must identify the built-in image generator",
);
check(
  provenance.thirdPartyDownloads === false,
  "prompt provenance must state that no third-party images were downloaded",
);
check(
  manifest.styleReferenceSha256 === provenance.styleBoard.sha256,
  "manifest style reference hash must match provenance",
);
check(
  manifest.stylePromptSha256 === provenance.styleBoard.promptSha256,
  "manifest style prompt hash must match provenance",
);
check(
  manifest.cardBackPromptSha256 === provenance.cardBack.promptSha256,
  "manifest card-back prompt hash must match provenance",
);
check(
  manualReview.deckId === manifest.deckId && manualReview.cardsReviewed === 78,
  "manual visual review must cover all 78 cards",
);
for (const field of [
  "noReadableText",
  "noLogosOrWatermarks",
  "pipCountsVerified",
  "styleConsistencyVerified",
  "anatomyAndCroppingVerified",
]) {
  check(manualReview[field] === true, `manual review field ${field} must be true`);
}
check(
  manualReview.cardBackExactDecodedSymmetryVerified === true,
  "manual review must include the exact-symmetry card-back sheet",
);
check(
  manualReview.contactSheetArtifacts?.length === 7,
  "manual review must record seven hashed QA sheets",
);
for (const artifact of manualReview.contactSheetArtifacts ?? []) {
  const path = resolve(root, artifact.path);
  check((await stat(path)).size === artifact.bytes, `${artifact.path}: QA byte mismatch`);
  check(
    (await sha256(path)) === artifact.sha256,
    `${artifact.path}: QA hash mismatch`,
  );
}
check(
  ocrAudit.deckId === manifest.deckId && ocrAudit.entries?.length === 78,
  "OCR audit report must contain all 78 generated sources",
);
check(
  ocrAudit.disposition === "manual-review-completed",
  "OCR audit false positives must be resolved by manual review",
);

const sourceHashes = new Set();
const webHashes = new Set();
const mcpHashes = new Set();
let totalWebBytes = 0;
let totalMcpBytes = 0;

for (const card of manifest.cards) {
  const canonicalCard = canonical.find((entry) => entry.id === card.id);
  const expectedPips =
    canonicalCard.arcana === "minor"
      ? canonicalCard.number <= 10
        ? canonicalCard.number
        : 1
      : null;
  const expectedRankLabel =
    canonicalCard.arcana === "minor" ? rankLabels[canonicalCard.number] : null;
  check(card.pipCount === expectedPips, `${card.id}: incorrect pipCount`);
  check(
    card.rankLabel === expectedRankLabel,
    `${card.id}: incorrect deterministic rank label`,
  );
  const provenanceCard = provenanceById.get(card.id);
  check(provenanceCard, `${card.id}: missing prompt provenance entry`);
  check(
    card.promptSha256 === provenanceCard?.promptSha256,
    `${card.id}: manifest prompt hash differs from actual prompt provenance`,
  );
  check(
    card.web.path ===
      `/assets/cards/midnight-art-nouveau-v1/${card.id}.webp`,
    `${card.id}: incorrect versioned Web URL`,
  );
  check(
    card.mcp.path ===
      `/assets/cards/midnight-art-nouveau-v1/mcp/${card.id}.webp`,
    `${card.id}: incorrect versioned MCP URL`,
  );

  const sourcePath = resolve(root, `assets/artwork/source/${card.id}.png`);
  const webPath = resolve(root, card.web.physicalPath);
  const mcpPath = resolve(root, card.mcp.physicalPath);
  const [sourceStat, webStat, mcpStat] = await Promise.all([
    stat(sourcePath),
    stat(webPath),
    stat(mcpPath),
  ]);
  check(sourceStat.size >= 300_000, `${card.id}: source looks like a placeholder`);
  check(
    (await dimensions(sourcePath)) === "1024x1536",
    `${card.id}: source must be 1024x1536`,
  );
  check(
    (await dimensions(webPath)) === "512x768",
    `${card.id}: Web image must be 512x768`,
  );
  check(
    (await dimensions(mcpPath)) === "192x288",
    `${card.id}: MCP image must be 192x288`,
  );
  check(webStat.size === card.web.bytes, `${card.id}: Web byte count mismatch`);
  check(mcpStat.size === card.mcp.bytes, `${card.id}: MCP byte count mismatch`);
  check(webStat.size <= 180_000, `${card.id}: Web image exceeds 180 KB`);
  check(mcpStat.size <= 24_000, `${card.id}: MCP image exceeds 24 KB`);
  check(webStat.size >= 15_000, `${card.id}: Web output looks like a placeholder`);
  check(mcpStat.size >= 1_500, `${card.id}: MCP output looks like a placeholder`);

  const [sourceHash, webHash, mcpHash] = await Promise.all([
    sha256(sourcePath),
    sha256(webPath),
    sha256(mcpPath),
  ]);
  check(sourceHash === card.sourceSha256, `${card.id}: source hash mismatch`);
  check(
    sourceHash === provenanceCard?.sha256,
    `${card.id}: source hash differs from provenance`,
  );
  check(webHash === card.web.sha256, `${card.id}: Web hash mismatch`);
  check(mcpHash === card.mcp.sha256, `${card.id}: MCP hash mismatch`);
  check(!sourceHashes.has(sourceHash), `${card.id}: duplicate source artwork hash`);
  check(!webHashes.has(webHash), `${card.id}: duplicate Web artwork hash`);
  check(!mcpHashes.has(mcpHash), `${card.id}: duplicate MCP artwork hash`);
  sourceHashes.add(sourceHash);
  webHashes.add(webHash);
  mcpHashes.add(mcpHash);
  totalWebBytes += webStat.size;
  totalMcpBytes += mcpStat.size;
}

check(totalWebBytes <= 14_040_000, "Web deck exceeds 78 x 180 KB budget");
check(totalMcpBytes <= 1_872_000, "MCP deck exceeds 78 x 24 KB budget");
const bundledMcpRawBytes = totalMcpBytes + manifest.cardBack.mcp.bytes;
const bundledMcpBase64Bytes = [...manifest.cards, manifest.cardBack].reduce(
  (total, card) => total + 4 * Math.ceil(card.mcp.bytes / 3),
  0,
);
check(
  bundledMcpRawBytes <= 600_000,
  `bundled MCP artwork uses ${bundledMcpRawBytes} raw bytes; budget is 600000`,
);
check(
  bundledMcpBase64Bytes <= 800_000,
  `bundled MCP artwork uses ${bundledMcpBase64Bytes} base64 bytes; budget is 800000`,
);

const backWebPath = resolve(root, manifest.cardBack.web.physicalPath);
const backMcpPath = resolve(root, manifest.cardBack.mcp.physicalPath);
check(
  (await dimensions(backWebPath)) === "512x768",
  "Web card back must be 512x768",
);
check(
  (await dimensions(backMcpPath)) === "192x288",
  "MCP card back must be 192x288",
);
check((await stat(backWebPath)).size <= 180_000, "Web card back exceeds budget");
check((await stat(backMcpPath)).size <= 24_000, "MCP card back exceeds budget");
check(
  manifest.cardBack.rotationalSymmetry === "180deg-exact-decoded-pixels",
  "card-back manifest must promise exact decoded-pixel symmetry",
);
check(
  manifest.cardBack.web.lossless === true &&
    manifest.cardBack.mcp.lossless === true,
  "card-back derivatives must use lossless WebP",
);
check(
  (await sha256(backWebPath)) === manifest.cardBack.web.sha256,
  "Web card-back hash mismatch",
);
check(
  (await sha256(backMcpPath)) === manifest.cardBack.mcp.sha256,
  "MCP card-back hash mismatch",
);
check(
  (await decodedRotationalMismatch(backWebPath)) === 0,
  "decoded Web card back is not pixel-exact under 180-degree rotation",
);
check(
  (await decodedRotationalMismatch(backMcpPath)) === 0,
  "decoded MCP card back is not pixel-exact under 180-degree rotation",
);

// Recreate the raw-pixel average used by process-deck and prove that each
// pixel exactly matches its 180-degree counterpart before lossy encoding.
const backSource = resolve(root, "assets/artwork/source/back.png");
const { data: backData, info: backInfo } = await sharp(backSource)
  .rotate()
  .ensureAlpha()
  .toColorspace("srgb")
  .raw()
  .toBuffer({ resolveWithObject: true });
let symmetryMismatch = 0;
const symmetricData = Buffer.allocUnsafe(backData.length);
for (let y = 0; y < backInfo.height; y += 1) {
  for (let x = 0; x < backInfo.width; x += 1) {
    const oppositeX = backInfo.width - 1 - x;
    const oppositeY = backInfo.height - 1 - y;
    const index = (y * backInfo.width + x) * backInfo.channels;
    const opposite =
      (oppositeY * backInfo.width + oppositeX) * backInfo.channels;
    for (let channel = 0; channel < backInfo.channels; channel += 1) {
      symmetricData[index + channel] = Math.round(
        (backData[index + channel] + backData[opposite + channel]) / 2,
      );
    }
  }
}
for (let y = 0; y < backInfo.height; y += 1) {
  for (let x = 0; x < backInfo.width; x += 1) {
    const oppositeX = backInfo.width - 1 - x;
    const oppositeY = backInfo.height - 1 - y;
    const index = (y * backInfo.width + x) * backInfo.channels;
    const opposite =
      (oppositeY * backInfo.width + oppositeX) * backInfo.channels;
    for (let channel = 0; channel < backInfo.channels; channel += 1) {
      if (symmetricData[index + channel] !== symmetricData[opposite + channel]) {
        symmetryMismatch += 1;
      }
    }
  }
}
check(symmetryMismatch === 0, "raw card-back average is not 180-degree symmetric");

await Promise.all([
  readFile(resolve(root, "assets/ASSET_LICENSE.md"), "utf8"),
  readFile(resolve(root, "assets/cards/qa/contact-sheet-web.png")),
  readFile(resolve(root, "assets/cards/qa/contact-sheet-mcp.png")),
]);

if (errors.length > 0) {
  console.error(`Deck validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Validated 78 original cards + symmetric back; Web ${totalWebBytes} bytes, bundled MCP artwork ${bundledMcpRawBytes} raw / ${bundledMcpBase64Bytes} base64 bytes.`,
);
