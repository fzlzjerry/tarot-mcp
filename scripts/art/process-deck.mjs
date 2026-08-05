#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDir = resolve(root, "assets/artwork/source");
const outputDir = resolve(root, "assets/cards");
const mcpDir = resolve(outputDir, "mcp");
const allowMissing = process.argv.includes("--allow-missing");
const plan = JSON.parse(
  await readFile(resolve(root, "assets/artwork/prompt-plan.json"), "utf8"),
);
const promptOverrides = JSON.parse(
  await readFile(resolve(root, "assets/artwork/prompt-overrides.json"), "utf8"),
);
let provenance = null;
try {
  provenance = JSON.parse(
    await readFile(
      resolve(root, "assets/artwork/prompt-provenance.json"),
      "utf8",
    ),
  );
} catch (error) {
  if (!allowMissing) throw error;
}
const cardData = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;

const DECK_ID = "midnight-art-nouveau-v1";
const WEB = { width: 512, height: 768, quality: 82, hardMaxBytes: 180_000 };
const MCP = { width: 192, height: 288, quality: 68, hardMaxBytes: 24_000 };
const GOLD = "#c6a15b";
const IVORY = "#e2d2aa";
const RANK_LABELS = {
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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pipShape(suit) {
  switch (suit) {
    case "wands":
      return `<path d="M0,-14 C3,-10 3,10 0,14 C-3,10 -3,-10 0,-14 Z" fill="${GOLD}"/><path d="M0,-7 C7,-10 9,-5 3,-2 M0,5 C-7,2 -9,7 -3,9" fill="none" stroke="${IVORY}" stroke-width="1.4" stroke-linecap="round"/>`;
    case "cups":
      return `<path d="M-9,-12 H9 C9,-2 5,4 0,5 C-5,4 -9,-2 -9,-12 Z M-1,5 H1 V11 H7 V14 H-7 V11 H-1 Z" fill="${GOLD}"/><path d="M-6,-9 H6" stroke="${IVORY}" stroke-width="1.3"/>`;
    case "swords":
      return `<path d="M0,-15 L3,-10 L2,7 H-2 L-3,-10 Z" fill="${IVORY}"/><path d="M-8,7 H8 L6,10 H1 V15 H-1 V10 H-6 Z" fill="${GOLD}"/>`;
    case "pentacles":
      return `<circle r="14" fill="${GOLD}"/><path d="M0,-10 L2.35,-3.24 L9.51,-3.09 L3.8,1.24 L5.88,8.09 L0,4 L-5.88,8.09 L-3.8,1.24 L-9.51,-3.09 L-2.35,-3.24 Z" fill="none" stroke="#111827" stroke-width="2" stroke-linejoin="round"/>`;
    default:
      return "";
  }
}

function pipPositions(count, width, height) {
  if (!count) return [];
  const sx = width / 512;
  const sy = height / 768;
  if (count === 1) return [{ x: width / 2, y: height - 42 * sy, scale: sx }];
  const pairCount = Math.floor(count / 2);
  const top = 126 * sy;
  const bottom = 635 * sy;
  const ys = Array.from({ length: pairCount }, (_, index) =>
    pairCount === 1 ? (top + bottom) / 2 : top + ((bottom - top) * index) / (pairCount - 1),
  );
  const points = ys.flatMap((y) => [
    { x: 39 * sx, y, scale: 0.72 * sx },
    { x: width - 39 * sx, y, scale: 0.72 * sx },
  ]);
  if (count % 2 === 1) {
    points.push({ x: width / 2, y: height - 42 * sy, scale: sx });
  }
  return points;
}

function overlaySvg(card, width, height) {
  const sx = width / 512;
  const sy = height / 768;
  const pipCount =
    card.arcana === "minor" ? (card.number <= 10 ? card.number : 1) : null;
  const pips = pipPositions(pipCount, width, height)
    .map(
      ({ x, y, scale }) =>
        `<g transform="translate(${x} ${y}) scale(${scale})">${pipShape(card.suit)}</g>`,
    )
    .join("");
  const rankMarkup =
    card.arcana === "minor"
      ? `<text x="${width / 2}" y="${34 * sy}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${22 * sx}" fill="${IVORY}" stroke="#070c16" stroke-width="${0.8 * sx}" paint-order="stroke">${RANK_LABELS[card.number]}</text>`
      : `<circle cx="${width / 2}" cy="${23 * sy}" r="${4.5 * sx}" fill="${GOLD}"/><path d="M${width / 2 - 15 * sx},${23 * sy} H${width / 2 + 15 * sx}" stroke="${GOLD}" stroke-width="${1.2 * sx}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${46 * sy}" fill="#070c16" fill-opacity="0.76"/>
  <rect y="${height - 58 * sy}" width="${width}" height="${58 * sy}" fill="#070c16" fill-opacity="0.76"/>
  <rect width="${24 * sx}" height="${height}" fill="#070c16" fill-opacity="0.68"/>
  <rect x="${width - 24 * sx}" width="${24 * sx}" height="${height}" fill="#070c16" fill-opacity="0.68"/>
  <rect x="${10 * sx}" y="${10 * sy}" width="${width - 20 * sx}" height="${height - 20 * sy}" rx="${10 * sx}" fill="none" stroke="${GOLD}" stroke-width="${2 * sx}"/>
  <rect x="${17 * sx}" y="${17 * sy}" width="${width - 34 * sx}" height="${height - 34 * sy}" rx="${7 * sx}" fill="none" stroke="${IVORY}" stroke-opacity="0.72" stroke-width="${0.9 * sx}"/>
  <path d="M${17 * sx},${72 * sy} C${52 * sx},${52 * sy} ${52 * sx},${17 * sy} ${88 * sx},${17 * sy} M${width - 17 * sx},${72 * sy} C${width - 52 * sx},${52 * sy} ${width - 52 * sx},${17 * sy} ${width - 88 * sx},${17 * sy}" fill="none" stroke="${GOLD}" stroke-width="${1.5 * sx}"/>
  <path d="M${17 * sx},${height - 72 * sy} C${52 * sx},${height - 52 * sy} ${52 * sx},${height - 17 * sy} ${88 * sx},${height - 17 * sy} M${width - 17 * sx},${height - 72 * sy} C${width - 52 * sx},${height - 52 * sy} ${width - 52 * sx},${height - 17 * sy} ${width - 88 * sx},${height - 17 * sy}" fill="none" stroke="${GOLD}" stroke-width="${1.5 * sx}"/>
  ${rankMarkup}
  ${pips}
  <title>${escapeXml(card.name)}</title>
</svg>`;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function encodeWithinLimit(factory, outputPath, startQuality, hardMax) {
  let quality = startQuality;
  while (quality >= 42) {
    const encoded = await factory(quality);
    if (encoded.length <= hardMax) {
      await writeFile(outputPath, encoded);
      return quality;
    }
    quality -= 4;
  }
  throw new Error(`${outputPath} could not be encoded below ${hardMax} bytes`);
}

async function rotationallySymmetricRaw(path) {
  const { data, info } = await sharp(path)
    .rotate()
    .ensureAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const symmetric = Buffer.allocUnsafe(data.length);
  const { width, height, channels } = info;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const oppositeX = width - 1 - x;
      const oppositeY = height - 1 - y;
      const index = (y * width + x) * channels;
      const opposite = (oppositeY * width + oppositeX) * channels;
      for (let channel = 0; channel < channels; channel += 1) {
        symmetric[index + channel] = Math.round(
          (data[index + channel] + data[opposite + channel]) / 2,
        );
      }
    }
  }
  return { data: symmetric, info };
}

async function encodeExactSymmetricBack(rawImage, width, height, hardMaxBytes) {
  // Palette quantization is performed before lossless WebP encoding. Because
  // every raw pixel already equals its 180-degree counterpart, the decoded
  // output remains pixel-exact symmetric while staying below transport limits.
  const palettePng = await sharp(rawImage.data, { raw: rawImage.info })
    .resize(width, height, { fit: "fill" })
    .toColorspace("srgb")
    .png({ palette: true, colours: 128, dither: 0 })
    .toBuffer();
  const encoded = await sharp(palettePng)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  if (encoded.length > hardMaxBytes) {
    throw new Error(
      `Exact-symmetric card back exceeds ${hardMaxBytes} bytes (${encoded.length})`,
    );
  }
  return encoded;
}

await mkdir(outputDir, { recursive: true });
await mkdir(mcpDir, { recursive: true });
const manifestCards = [];
const promptById = new Map(plan.cards.map((card) => [card.id, card]));
const provenanceById = new Map(
  (provenance?.cards ?? []).map((card) => [card.id, card]),
);

for (const card of cardData) {
    const sourcePath = resolve(sourceDir, `${card.id}.png`);
    try {
      await access(sourcePath);
    } catch {
      if (allowMissing) continue;
      throw new Error(`Missing generated source artwork: ${sourcePath}`);
    }

    const overlay = Buffer.from(overlaySvg(card, WEB.width, WEB.height));
    const webPath = resolve(outputDir, `${card.id}.webp`);
    const webQuality = await encodeWithinLimit(
      (quality) =>
        sharp(sourcePath)
          .rotate()
          .resize(WEB.width, WEB.height, { fit: "cover", position: "centre" })
          .composite([{ input: overlay }])
          .toColorspace("srgb")
          .webp({ quality, effort: 6, smartSubsample: true })
          .toBuffer(),
      webPath,
      WEB.quality,
      WEB.hardMaxBytes,
    );

    const mcpPath = resolve(mcpDir, `${card.id}.webp`);
    const mcpQuality = await encodeWithinLimit(
      (quality) =>
        sharp(webPath)
          .resize(MCP.width, MCP.height, { fit: "fill" })
          .toColorspace("srgb")
          .webp({ quality, effort: 6, smartSubsample: true })
          .toBuffer(),
      mcpPath,
      MCP.quality,
      MCP.hardMaxBytes,
    );

    const planCard = promptById.get(card.id);
    const actualPrompt = promptOverrides[card.id] ?? planCard?.prompt;
    const actualPromptHash = createHash("sha256")
      .update(actualPrompt.replace(/\s+/g, " ").trim())
      .digest("hex");
    const provenanceCard = provenanceById.get(card.id);
    const webStat = await stat(webPath);
    const mcpStat = await stat(mcpPath);
    manifestCards.push({
      id: card.id,
      name: card.name,
      arcana: card.arcana,
      suit: card.suit ?? null,
      rank: card.number,
      pipCount:
        card.arcana === "minor" ? (card.number <= 10 ? card.number : 1) : null,
      rankLabel: card.arcana === "minor" ? RANK_LABELS[card.number] : null,
      sourceSha256: await sha256(sourcePath),
      promptSha256: provenanceCard?.promptSha256 ?? actualPromptHash,
      web: {
        path: `/assets/cards/${DECK_ID}/${card.id}.webp`,
        physicalPath: `assets/cards/${card.id}.webp`,
        width: WEB.width,
        height: WEB.height,
        bytes: webStat.size,
        sha256: await sha256(webPath),
        quality: webQuality,
      },
      mcp: {
        path: `/assets/cards/${DECK_ID}/mcp/${card.id}.webp`,
        physicalPath: `assets/cards/mcp/${card.id}.webp`,
        width: MCP.width,
        height: MCP.height,
        bytes: mcpStat.size,
        sha256: await sha256(mcpPath),
        quality: mcpQuality,
      },
      alt: {
        en: `${card.name} tarot artwork`,
        zh: `${card.zh?.name ?? card.name}塔罗牌面`,
      },
    });
}

const backSource = resolve(sourceDir, "back.png");
await access(backSource);
const symmetricBack = await rotationallySymmetricRaw(backSource);
  const backWebPath = resolve(outputDir, "back.webp");
  await writeFile(
    backWebPath,
    await encodeExactSymmetricBack(
      symmetricBack,
      WEB.width,
      WEB.height,
      WEB.hardMaxBytes,
    ),
  );
  const backMcpPath = resolve(mcpDir, "back.webp");
  await writeFile(
    backMcpPath,
    await encodeExactSymmetricBack(
      symmetricBack,
      MCP.width,
      MCP.height,
      MCP.hardMaxBytes,
    ),
  );

const manifest = {
    schemaVersion: 1,
    deckId: DECK_ID,
    title: "Midnight Art Nouveau Tarot",
    source: {
      type: "original-generated-artwork",
      generator: "OpenAI built-in image_gen",
      thirdPartyDownloads: false,
      promptProvenance: "assets/artwork/prompt-provenance.json",
      license: "assets/ASSET_LICENSE.md",
    },
    styleReferenceSha256: plan.styleReferenceSha256,
    stylePromptSha256: provenance?.styleBoard?.promptSha256 ?? null,
    cardBackPromptSha256: provenance?.cardBack?.promptSha256 ?? null,
    webSpec: WEB,
    mcpSpec: MCP,
    cardBack: {
      rotationalSymmetry: "180deg-exact-decoded-pixels",
      encoding: "lossless-webp-from-128-colour-palette",
      sourceSha256: await sha256(backSource),
      web: {
        path: `/assets/cards/${DECK_ID}/back.webp`,
        physicalPath: "assets/cards/back.webp",
        width: WEB.width,
        height: WEB.height,
        bytes: (await stat(backWebPath)).size,
        sha256: await sha256(backWebPath),
        quality: 100,
        lossless: true,
        paletteColours: 128,
      },
      mcp: {
        path: `/assets/cards/${DECK_ID}/mcp/back.webp`,
        physicalPath: "assets/cards/mcp/back.webp",
        width: MCP.width,
        height: MCP.height,
        bytes: (await stat(backMcpPath)).size,
        sha256: await sha256(backMcpPath),
        quality: 100,
        lossless: true,
        paletteColours: 128,
      },
    },
    cards: manifestCards,
  };

await writeFile(
  resolve(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Processed ${manifestCards.length} cards with sharp.`);
