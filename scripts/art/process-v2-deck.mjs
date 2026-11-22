#!/usr/bin/env node

/**
 * Process all 78 Luminous Midnight Art Nouveau v2 card masters + card back
 * directly from lossless 1024x1536 PNG masters (zero double-lossy re-encoding!)
 * into:
 *   - assets/cards/v2/<id>.webp       (640x960 Retina Web card, <= 180 KB)
 *   - assets/cards/v2/mcp/<id>.webp   (192x288 direct-from-master MCP card, <= 7.3 KB avg)
 *   - assets/cards/v2/back.webp       (640x960 exact 180° pixel-symmetric lossless WebP)
 *   - assets/cards/v2/mcp/back.webp   (192x288 exact 180° pixel-symmetric lossless WebP)
 *   - assets/cards/v2/foil-mask.svg   (shared gilded arch foil mask)
 *   - assets/cards/v2/manifest.json   (hashes, dimensions, luminance & symmetry metrics)
 *
 * Also writes 6 full-deck visual QA contact sheets + comparison sheets under
 * <MASTER_DIR>/qa/ for thorough human/visual verification of every single card.
 */

import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  buildV2BackFrameSvg,
  buildV2CardFrameSvg,
  buildV2FoilMaskSvg,
} from "./frames-v2.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MASTER_DIR = resolve(
  process.env.TAROT_V2_MASTER_DIR ??
    process.env.TAROT_V2_MASTERS_DIR ??
    resolve(homedir(), ".capy/work/tarot-v2-masters-2.5"),
);
const OUT_DIR = resolve(root, "assets/cards/v2");
const PROV_PATH = resolve(root, "assets/artwork/v2/provenance.json");
const DECK_ID = "midnight-art-nouveau-v2";
const ASSET_REVISION = "r2";
const ASSET_BASE = `/assets/cards/${DECK_ID}-${ASSET_REVISION}`;

const cardData = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;
const provenance = JSON.parse(await readFile(PROV_PATH, "utf8"));

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function luminanceMetrics(filePath) {
  const { data, info } = await sharp(filePath)
    .removeAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const ys = new Float32Array(n);
  let sum = 0;
  let dark = 0;
  for (let i = 0; i < n; i += 1) {
    const y =
      0.2126 * data[i * 3] +
      0.7152 * data[i * 3 + 1] +
      0.0722 * data[i * 3 + 2];
    ys[i] = y;
    sum += y;
    if (y < 52) dark += 1;
  }
  ys.sort();
  return {
    meanLuma: Number((sum / n).toFixed(1)),
    p10Luma: Number(ys[Math.floor(n * 0.1)].toFixed(1)),
    p50Luma: Number(ys[Math.floor(n * 0.5)].toFixed(1)),
    p90Luma: Number(ys[Math.floor(n * 0.9)].toFixed(1)),
    p98Luma: Number(ys[Math.floor(n * 0.98)].toFixed(1)),
    darkPixelPct: Number(((dark / n) * 100).toFixed(1)),
  };
}

async function decodedRotationalMismatch(filePath) {
  const { data, info } = await sharp(filePath)
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

async function encodeWithinLimit(makeBuf, outPath, startQ, minQ, maxBytes, step = 4) {
  let q = startQ;
  let lastBuf = null;
  let lastQ = q;
  while (q >= minQ) {
    const buf = await makeBuf(q);
    lastBuf = buf;
    lastQ = q;
    if (buf.length <= maxBytes) {
      await writeFile(outPath, buf);
      return { quality: q, bytes: buf.length };
    }
    q -= step;
  }
  if (lastBuf && lastBuf.length <= maxBytes * 1.15) {
    await writeFile(outPath, lastBuf);
    return { quality: lastQ, bytes: lastBuf.length };
  }
  throw new Error(`${outPath} could not be encoded below ${maxBytes} bytes (got ${lastBuf?.length})`);
}

async function make180SymmetricRaw(sourcePath, width, height, frameSvgBuf) {
  const framed = await sharp(sourcePath)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .composite([{ input: frameSvgBuf, top: 0, left: 0 }])
    .ensureAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = framed;
  const symmetric = Buffer.allocUnsafe(data.length);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const ox = info.width - 1 - x;
      const oy = info.height - 1 - y;
      const idx = (y * info.width + x) * info.channels;
      const oidx = (oy * info.width + ox) * info.channels;
      for (let c = 0; c < info.channels; c += 1) {
        symmetric[idx + c] = Math.round((data[idx + c] + data[oidx + c]) / 2);
      }
    }
  }
  return { data: symmetric, info };
}

async function encodeExactSymmetricBack(symRaw, outPath, maxBytes, paletteOptions) {
  for (const colours of paletteOptions) {
    const palettePng = await sharp(symRaw.data, { raw: symRaw.info })
      .toColorspace("srgb")
      .png({ palette: true, colours, dither: 0 })
      .toBuffer();
    const encoded = await sharp(palettePng)
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    if (encoded.length <= maxBytes) {
      await writeFile(outPath, encoded);
      return { bytes: encoded.length, colours };
    }
  }
  throw new Error(`Exact-symmetric card back ${outPath} exceeds ${maxBytes} bytes`);
}

// Clean obsolete milestone-1 multi-resolution directories so assets/cards/v2 stays lean
for (const oldDir of ["w320", "w640", "w1024"]) {
  await rm(resolve(OUT_DIR, oldDir), { recursive: true, force: true });
}
await mkdir(resolve(OUT_DIR, "mcp"), { recursive: true });

// Write shared foil mask SVG
await writeFile(resolve(OUT_DIR, "foil-mask.svg"), buildV2FoilMaskSvg());

// Verify all 78 masters + back exist before processing
const missing = [];
for (const card of cardData) {
  if (!(await fileExists(resolve(MASTER_DIR, `${card.id}.png`)))) {
    missing.push(card.id);
  }
}
if (!(await fileExists(resolve(MASTER_DIR, "back.png")))) {
  missing.push("back");
}
if (missing.length > 0) {
  throw new Error(`Missing ${missing.length} master PNG(s) in ${MASTER_DIR}: ${missing.join(", ")}`);
}

// First process exact 180-degree symmetric card back so we know exact MCP budget remaining for 78 faces
const backMaster = resolve(MASTER_DIR, "back.png");
const backFrameWeb = Buffer.from(buildV2BackFrameSvg(640, 960, "web"));
const backFrameMcp = Buffer.from(buildV2BackFrameSvg(192, 288, "mcp"));
const backWebPath = resolve(OUT_DIR, "back.webp");
const backMcpPath = resolve(OUT_DIR, "mcp", "back.webp");

const [backWeb, backMcp] = await Promise.all([
  encodeExactSymmetricBack(
    await make180SymmetricRaw(backMaster, 640, 960, backFrameWeb),
    backWebPath,
    260_000,
    [128, 96, 80, 64, 48, 40, 32],
  ),
  encodeExactSymmetricBack(
    await make180SymmetricRaw(backMaster, 192, 288, backFrameMcp),
    backMcpPath,
    22_000,
    [96, 80, 64, 48, 40, 32],
  ),
]);

const [mWeb, mMcp] = await Promise.all([
  decodedRotationalMismatch(backWebPath),
  decodedRotationalMismatch(backMcpPath),
]);
if (mWeb !== 0 || mMcp !== 0) {
  throw new Error(`Card back rotational symmetry mismatch: web=${mWeb}, mcp=${mMcp}`);
}
console.log(
  `[v2] back (180° EXACT) | 640w=${(backWeb.bytes / 1024).toFixed(1)}KB (${backWeb.colours}c) | mcp192=${(backMcp.bytes / 1024).toFixed(1)}KB (${backMcp.colours}c) | mismatch=0`,
);

// Allocate exact per-face MCP byte budget so total bundled MCP artwork (78 faces + back)
// stays safely under 585,000 raw bytes (<= 600,000 raw / <= 800,000 base64 / <= 1.5 MB HTML)
const targetTotalMcpRaw = 582_000;
const perCardMcpSoftMax = Math.floor((targetTotalMcpRaw - backMcp.bytes) / cardData.length);
console.log(`[v2] per-card MCP target budget: <= ${perCardMcpSoftMax} bytes (back=${backMcp.bytes} bytes)`);

const manifestCards = new Array(cardData.length);
let totalWebBytes = backWeb.bytes;
let totalMcpBytes = backMcp.bytes;

// Process cards with bounded concurrency (8 parallel Sharp workers)
let nextIdx = 0;
async function worker() {
  while (nextIdx < cardData.length) {
    const idx = nextIdx;
    nextIdx += 1;
    const card = cardData[idx];
    const cardId = card.id;
    const masterPath = resolve(MASTER_DIR, `${cardId}.png`);
    const provCard = provenance.cards?.[cardId];
    if (!provCard) {
      throw new Error(`Missing provenance entry for ${cardId} in ${PROV_PATH}`);
    }

    const frameWeb = Buffer.from(buildV2CardFrameSvg(card, 640, 960, "web"));
    const frameMcp = Buffer.from(buildV2CardFrameSvg(card, 192, 288, "mcp"));

    const webPath = resolve(OUT_DIR, `${cardId}.webp`);
    const mcpPath = resolve(OUT_DIR, "mcp", `${cardId}.webp`);

    const makeWebFramed = () =>
      sharp(masterPath)
        .rotate()
        .resize(640, 960, { fit: "cover", position: "centre", kernel: "lanczos3" })
        .composite([{ input: frameWeb, top: 0, left: 0 }]);

    // Gently pre-smooth high-frequency paper/gouache grain BEFORE compositing
    // the crisp vector frame so 192x288 MCP inline assets keep sharp arch/rank
    // linework while staying well inside the 1.5 MB single-file HTML budget.
    const makeMcpFramed = () =>
      sharp(masterPath)
        .rotate()
        .resize(192, 288, { fit: "cover", position: "centre", kernel: "mitchell" })
        .blur(0.65)
        .composite([{ input: frameMcp, top: 0, left: 0 }]);

    const [web, mcp] = await Promise.all([
      encodeWithinLimit(
        (q) =>
          makeWebFramed()
            .webp({ quality: q, effort: 6, smartSubsample: true })
            .toBuffer(),
        webPath,
        84,
        56,
        145_000,
        4,
      ),
      encodeWithinLimit(
        (q) =>
          makeMcpFramed()
            .webp({ quality: q, effort: 6, smartSubsample: true })
            .toBuffer(),
        mcpPath,
        48,
        20,
        perCardMcpSoftMax,
        2,
      ),
    ]);

    const [metrics, sourceMasterSha, webSha, mcpSha] = await Promise.all([
      luminanceMetrics(webPath),
      sha256(masterPath),
      sha256(webPath),
      sha256(mcpPath),
    ]);

    totalWebBytes += web.bytes;
    totalMcpBytes += mcp.bytes;

    manifestCards[idx] = {
      id: cardId,
      name: card.name,
      arcana: card.arcana,
      suit: card.suit ?? null,
      number: card.number,
      model: provCard.model,
      quality: provCard.quality,
      promptSha256: provCard.promptSha256,
      sourceMasterSha256: sourceMasterSha,
      luminance: metrics,
      web: {
        path: `${ASSET_BASE}/${cardId}.webp`,
        physicalPath: `assets/cards/v2/${cardId}.webp`,
        width: 640,
        height: 960,
        bytes: web.bytes,
        quality: web.quality,
        sha256: webSha,
      },
      mcp: {
        path: `${ASSET_BASE}/mcp/${cardId}.webp`,
        physicalPath: `assets/cards/v2/mcp/${cardId}.webp`,
        width: 192,
        height: 288,
        bytes: mcp.bytes,
        quality: mcp.quality,
        sha256: mcpSha,
      },
    };
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));

const bundledMcpBase64Bytes = [...manifestCards, { mcp: backMcp }].reduce(
  (sum, entry) => sum + 4 * Math.ceil(entry.mcp.bytes / 3),
  0,
);
console.log(
  `[v2] Processed 78 cards + back | Web total ${(totalWebBytes / 1024 / 1024).toFixed(2)} MB | MCP total ${totalMcpBytes} raw / ${bundledMcpBase64Bytes} base64 bytes`,
);

if (totalMcpBytes > 600_000 || bundledMcpBase64Bytes > 800_000) {
  throw new Error(
    `MCP artwork budget exceeded: ${totalMcpBytes} raw (limit 600000), ${bundledMcpBase64Bytes} base64 (limit 800000)`,
  );
}

const manifest = {
  schemaVersion: 2,
  deckId: DECK_ID,
  assetRevision: ASSET_REVISION,
  assetBase: ASSET_BASE,
  status: "complete-78",
  title: "Luminous Midnight Art Nouveau Tarot (v2 Edition)",
  provider: "openai-official-images-api",
  model: provenance.model ?? "gpt-image-2.5-sunburst",
  provenancePath: "assets/artwork/v2/provenance.json",
  foilMaskPath: `${ASSET_BASE}/foil-mask.svg`,
  styleReferenceSha256: provenance.styleBoard?.masterSha256 ?? null,
  cardBack: {
    rotationalSymmetry: "180deg-exact-decoded-pixels",
    decodedRotationalMismatch: 0,
    sourceMasterSha256: await sha256(backMaster),
    web: {
      path: `${ASSET_BASE}/back.webp`,
      physicalPath: "assets/cards/v2/back.webp",
      width: 640,
      height: 960,
      bytes: backWeb.bytes,
      lossless: true,
      paletteColours: backWeb.colours,
      sha256: await sha256(backWebPath),
    },
    mcp: {
      path: `${ASSET_BASE}/mcp/back.webp`,
      physicalPath: "assets/cards/v2/mcp/back.webp",
      width: 192,
      height: 288,
      bytes: backMcp.bytes,
      lossless: true,
      paletteColours: backMcp.colours,
      sha256: await sha256(backMcpPath),
    },
  },
  cards: manifestCards,
};

await writeFile(
  resolve(OUT_DIR, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// Build 6 visual QA contact sheets in <MASTER_DIR>/qa/ covering all 78 cards + back
const qaDir = resolve(MASTER_DIR, "qa");
await mkdir(qaDir, { recursive: true });

const sheets = [
  { name: "sheet-1-major-0-10.png", title: "MAJOR ARCANA 0-X + BACK", ids: [...cardData.slice(0, 11).map((c) => c.id), "back"] },
  { name: "sheet-2-major-11-21.png", title: "MAJOR ARCANA XI-XXI", ids: cardData.slice(11, 22).map((c) => c.id) },
  { name: "sheet-3-wands.png", title: "SUIT OF WANDS (14)", ids: cardData.slice(22, 36).map((c) => c.id) },
  { name: "sheet-4-cups.png", title: "SUIT OF CUPS (14)", ids: cardData.slice(36, 50).map((c) => c.id) },
  { name: "sheet-5-swords.png", title: "SUIT OF SWORDS (14)", ids: cardData.slice(50, 64).map((c) => c.id) },
  { name: "sheet-6-pentacles.png", title: "SUIT OF PENTACLES (14)", ids: cardData.slice(64, 78).map((c) => c.id) },
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

for (const sheet of sheets) {
  const cols = sheet.ids.length <= 12 ? 4 : 5;
  const rows = Math.ceil(sheet.ids.length / cols);
  const cellW = 260;
  const cellH = 390;
  const labelH = 26;
  const gap = 16;
  const margin = 24;
  const headerH = 44;
  const w = margin * 2 + cols * cellW + (cols - 1) * gap;
  const h = margin * 2 + headerH + rows * (cellH + labelH) + (rows - 1) * gap;
  const composites = [];
  const labelTags = [];

  for (let i = 0; i < sheet.ids.length; i += 1) {
    const id = sheet.ids[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cellW + gap);
    const y = margin + headerH + row * (cellH + labelH + gap);
    const buf = await sharp(resolve(OUT_DIR, `${id}.webp`))
      .resize(cellW, cellH, { fit: "fill" })
      .png()
      .toBuffer();
    composites.push({ input: buf, left: x, top: y });
    labelTags.push(
      `<text x="${x + cellW / 2}" y="${y + cellH + 19}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#e8dcc0">${escapeXml(id)}</text>`,
    );
  }

  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#080c16"/>
    <text x="${margin}" y="${margin + 26}" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#e0b86c">V2 FULL DECK (gpt-image-2.5-sunburst) — ${escapeXml(sheet.title)}</text>
    ${labelTags.join("\n")}
  </svg>`;

  const sheetPath = resolve(qaDir, sheet.name);
  await sharp(Buffer.from(bgSvg))
    .composite(composites)
    .png({ compressionLevel: 8 })
    .toFile(sheetPath);
  console.log(`[qa] wrote ${sheetPath} (${((await stat(sheetPath)).size / 1024).toFixed(0)} KB)`);
}
