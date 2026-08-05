#!/usr/bin/env node

import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cards = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;
const qaDir = resolve(root, "assets/cards/qa");

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function build(kind, sourceDir, output, thumbWidth, thumbHeight) {
  const paths = cards.map((card) => resolve(root, sourceDir, `${card.id}.webp`));
  await Promise.all(paths.map((path) => access(path)));
  const columns = 13;
  const rows = 6;
  const gap = 8;
  const labelHeight = 22;
  const cellWidth = thumbWidth + gap * 2;
  const cellHeight = thumbHeight + labelHeight + gap * 2;
  const composites = [];

  for (let index = 0; index < cards.length; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const left = column * cellWidth + gap;
    const top = row * cellHeight + gap;
    const image = await sharp(paths[index])
      .resize(thumbWidth, thumbHeight, { fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${labelHeight}">
      <text x="${thumbWidth / 2}" y="14" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#e2d2aa">${escapeXml(cards[index].id)}</text>
    </svg>`);
    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + thumbHeight + 2 });
  }

  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: "#070c16",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(qaDir, output));
  console.log(`Built ${kind} contact sheet: assets/cards/qa/${output}`);
}

async function buildDetailChunk(chunk, chunkIndex) {
  const columns = 7;
  const rows = Math.ceil(chunk.length / columns);
  const thumbWidth = 220;
  const thumbHeight = 330;
  const gap = 10;
  const labelHeight = 24;
  const cellWidth = thumbWidth + gap * 2;
  const cellHeight = thumbHeight + labelHeight + gap * 2;
  const composites = [];

  for (let index = 0; index < chunk.length; index += 1) {
    const card = chunk[index];
    const source = resolve(root, `assets/cards/${card.id}.webp`);
    await access(source);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const left = column * cellWidth + gap;
    const top = row * cellHeight + gap;
    const image = await sharp(source)
      .resize(thumbWidth, thumbHeight, { fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${labelHeight}">
      <text x="${thumbWidth / 2}" y="16" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#e2d2aa">${escapeXml(card.id)}</text>
    </svg>`);
    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + thumbHeight + 2 });
  }

  const output = `contact-sheet-detail-${chunkIndex + 1}.png`;
  await sharp({
    create: {
      width: columns * cellWidth,
      height: rows * cellHeight,
      channels: 4,
      background: "#070c16",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(qaDir, output));
  console.log(`Built detail contact sheet: assets/cards/qa/${output}`);
}

async function buildBackSymmetrySheet() {
  const webPath = resolve(root, "assets/cards/back.webp");
  const mcpPath = resolve(root, "assets/cards/mcp/back.webp");
  await Promise.all([access(webPath), access(mcpPath)]);
  const width = 256;
  const height = 384;
  const gap = 16;
  const labelHeight = 28;
  const variants = [
    { path: webPath, label: "Web back" },
    { path: webPath, label: "Web back rotated 180°", rotate: true },
    { path: mcpPath, label: "MCP back enlarged" },
    { path: mcpPath, label: "MCP back rotated 180°", rotate: true },
  ];
  const composites = [];
  for (let index = 0; index < variants.length; index += 1) {
    let pipeline = sharp(variants[index].path);
    if (variants[index].rotate) pipeline = pipeline.rotate(180);
    const image = await pipeline
      .resize(width, height, { fit: "fill", kernel: sharp.kernel.nearest })
      .png()
      .toBuffer();
    const left = gap + index * (width + gap);
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${labelHeight}">
      <text x="${width / 2}" y="18" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#e2d2aa">${escapeXml(variants[index].label)}</text>
    </svg>`);
    composites.push({ input: image, left, top: gap });
    composites.push({ input: label, left, top: gap + height + 4 });
  }
  await sharp({
    create: {
      width: gap + variants.length * (width + gap),
      height: gap * 2 + height + labelHeight,
      channels: 4,
      background: "#070c16",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(qaDir, "card-back-symmetry.png"));
  console.log("Built card-back symmetry sheet: assets/cards/qa/card-back-symmetry.png");
}

async function buildRepresentativeSamples() {
  const ids = [
    "fool",
    "high_priestess",
    "tower",
    "sun",
    "ace_of_wands",
    "seven_of_cups",
    "ten_of_swords",
    "queen_of_pentacles",
  ];
  const columns = 4;
  const rows = 2;
  const width = 256;
  const height = 384;
  const gap = 12;
  const labelHeight = 26;
  const composites = [];
  for (let index = 0; index < ids.length; index += 1) {
    const left = gap + (index % columns) * (width + gap);
    const top = gap + Math.floor(index / columns) * (height + labelHeight + gap);
    const image = await sharp(resolve(root, `assets/cards/${ids[index]}.webp`))
      .resize(width, height, { fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${labelHeight}">
      <text x="${width / 2}" y="17" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#e2d2aa">${ids[index]}</text>
    </svg>`);
    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + height + 2 });
  }
  await sharp({
    create: {
      width: gap + columns * (width + gap),
      height: gap + rows * (height + labelHeight + gap),
      channels: 4,
      background: "#070c16",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(qaDir, "representative-samples.png"));
  console.log("Built representative samples: assets/cards/qa/representative-samples.png");
}

await mkdir(qaDir, { recursive: true });
await build(
  "Web",
  "assets/cards",
  "contact-sheet-web.png",
  112,
  168,
);
await build(
  "MCP",
  "assets/cards/mcp",
  "contact-sheet-mcp.png",
  72,
  108,
);
for (let index = 0; index < 3; index += 1) {
  await buildDetailChunk(cards.slice(index * 26, index * 26 + 26), index);
}
await buildBackSymmetrySheet();
await buildRepresentativeSamples();
