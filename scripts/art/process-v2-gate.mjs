#!/usr/bin/env node

/**
 * Process the 6 Luminous Midnight Art Nouveau v2 gate master PNGs directly from
 * lossless 1024x1536 masters (zero double-lossy re-encoding!) into:
 *   - assets/cards/v2/<id>.webp       (640x960 default retina web card)
 *   - assets/cards/v2/w320/<id>.webp  (320x480 compact grid card)
 *   - assets/cards/v2/w1024/<id>.webp (1024x1536 spotlight / zoom card)
 *   - assets/cards/v2/w640/<id>.avif  (640x960 AVIF comparison deliverable)
 *   - assets/cards/v2/mcp/<id>.webp   (192x288 direct-from-master MCP card with bold-line frame)
 *   - assets/cards/v2/back.*          (exact 180-degree decoded pixel-symmetric back)
 *   - assets/cards/v2/foil-mask.svg   (shared gilded arch foil mask for UI)
 *   - assets/cards/v2/manifest.json   (full hashes, sizes, luminance & symmetry metrics)
 *
 * Also writes visual QA sheets to ~/.capy/work/tarot-v2-masters/:
 *   - v1-vs-v2-comparison.png         (side-by-side v1 vs v2 framed cards for all 6 assets)
 *   - v2-thumbnails-64x96.png         (64x96 thumbnail readability audit sheet)
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  buildV2BackFrameSvg,
  buildV2CardFrameSvg,
  buildV2FoilMaskSvg,
} from "./frames-v2.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MASTER_DIR =
  process.env.TAROT_V2_MASTERS_DIR ??
  "/home/user/.capy/work/tarot-v2-masters";
const OUT_DIR = resolve(root, "assets/cards/v2");
const PROV_PATH = resolve(root, "assets/artwork/v2/provenance.json");
const DECK_ID = "midnight-art-nouveau-v2";

const GATE_CARD_IDS = [
  "fool",
  "three_of_cups",
  "three_of_pentacles",
  "queen_of_swords",
  "ten_of_wands",
];

const cardData = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;
const cardById = new Map(cardData.map((c) => [c.id, c]));

const provenance = JSON.parse(await readFile(PROV_PATH, "utf8"));
// Ensure queen_of_swords (copied from blindTest.xhigh) is mirrored in provenance.cards
if (!provenance.cards.queen_of_swords && provenance.blindTest?.xhigh) {
  provenance.cards.queen_of_swords = {
    id: "queen_of_swords",
    ...provenance.blindTest.xhigh,
    masterFile: resolve(MASTER_DIR, "queen_of_swords.png"),
    selectedFromBlindTest: "xhigh",
  };
  await writeFile(PROV_PATH, `${JSON.stringify(provenance, null, 2)}\n`);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
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
    mean: Number((sum / n).toFixed(1)),
    darkPct: Number(((dark / n) * 100).toFixed(1)),
    p50: Number(ys[Math.floor(n * 0.5)].toFixed(1)),
    p95: Number(ys[Math.floor(n * 0.95)].toFixed(1)),
  };
}

async function encodeWithinLimit(factory, outputPath, startQuality, hardMax) {
  let quality = startQuality;
  while (quality >= 42) {
    const buf = await factory(quality);
    if (buf.length <= hardMax) {
      await writeFile(outputPath, buf);
      return { quality, bytes: buf.length };
    }
    quality -= 4;
  }
  throw new Error(`${outputPath} exceeded ${hardMax} bytes even at q=42`);
}

async function make180SymmetricRaw(sourcePath, width, height, frameSvgBuffer) {
  const rendered = await sharp(sourcePath)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .ensureAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build a razor-sharp 180-degree symmetric art plate by taking the upper half
  // and mapping it 180° onto the lower half with a smooth cosine blend strictly
  // across a narrow central seam band, avoiding ghosting/double-exposure.
  const { data, info } = rendered;
  const { width: w, height: h, channels } = info;
  const symArt = Buffer.allocUnsafe(data.length);
  const midY = h / 2;
  const seamHalf = Math.max(4, Math.round(h * 0.025));

  for (let y = 0; y < midY; y += 1) {
    const distFromMid = midY - 0.5 - y;
    const t = distFromMid >= seamHalf ? 1 : 0.5 + 0.5 * Math.sin((distFromMid / seamHalf) * (Math.PI / 2));
    for (let x = 0; x < w; x += 1) {
      const ox = w - 1 - x;
      const oy = h - 1 - y;
      const idx = (y * w + x) * channels;
      const opp = (oy * w + ox) * channels;
      for (let c = 0; c < channels; c += 1) {
        const val = Math.round(data[idx + c] * t + data[opp + c] * (1 - t));
        symArt[idx + c] = val;
        symArt[opp + c] = val;
      }
    }
  }

  // Composite the 180°-symmetric perimeter hairline frame, then enforce strict
  // pixel-exact equality between (x,y) and (w-1-x, h-1-y) for any subpixel AA.
  const framed = await sharp(symArt, { raw: info })
    .composite([{ input: frameSvgBuffer }])
    .ensureAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(framed.data);
  for (let y = 0; y < h / 2; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const ox = w - 1 - x;
      const oy = h - 1 - y;
      const idx = (y * w + x) * channels;
      const opp = (oy * w + ox) * channels;
      for (let c = 0; c < channels; c += 1) {
        const avg = Math.round((out[idx + c] + out[opp + c]) / 2);
        out[idx + c] = avg;
        out[opp + c] = avg;
      }
    }
  }
  return { data: out, info: framed.info };
}

async function encodeExactSymmetricBack(symRaw, outPath, hardMaxBytes) {
  let colours = 192;
  while (colours >= 64) {
    const png = await sharp(symRaw.data, { raw: symRaw.info })
      .toColorspace("srgb")
      .png({ palette: true, colours, dither: 0 })
      .toBuffer();
    const webp = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
    if (webp.length <= hardMaxBytes) {
      await writeFile(outPath, webp);
      return { bytes: webp.length, colours };
    }
    colours -= 32;
  }
  throw new Error(`${outPath} could not be losslessly encoded below ${hardMaxBytes}`);
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
      const opp = (oy * info.width + ox) * info.channels;
      for (let c = 0; c < info.channels; c += 1) {
        if (data[idx + c] !== data[opp + c]) mismatch += 1;
      }
    }
  }
  return mismatch;
}

await Promise.all([
  mkdir(OUT_DIR, { recursive: true }),
  mkdir(resolve(OUT_DIR, "w320"), { recursive: true }),
  mkdir(resolve(OUT_DIR, "w640"), { recursive: true }),
  mkdir(resolve(OUT_DIR, "w1024"), { recursive: true }),
  mkdir(resolve(OUT_DIR, "mcp"), { recursive: true }),
]);

// Save shared gilded foil mask SVG
const foilMaskPath = resolve(OUT_DIR, "foil-mask.svg");
await writeFile(foilMaskPath, `${buildV2FoilMaskSvg()}\n`);

const manifestCards = [];

for (const cardId of GATE_CARD_IDS) {
  const card = cardById.get(cardId);
  if (!card) throw new Error(`Unknown card id: ${cardId}`);
  const masterPath = resolve(MASTER_DIR, `${cardId}.png`);

  // Render framed master directly from 1024x1536 PNG (zero lossy hops!)
  const renderFramed = (w, h, variant) => {
    const svg = Buffer.from(buildV2CardFrameSvg(card, w, h, variant));
    return sharp(masterPath)
      .rotate()
      .resize(w, h, { fit: "cover", position: "centre", kernel: "lanczos3" })
      .composite([{ input: svg }])
      .toColorspace("srgb");
  };

  // 1. Default Retina web deliverable: 640x960 WebP at assets/cards/v2/<id>.webp
  const web640Path = resolve(OUT_DIR, `${cardId}.webp`);
  const web640 = await encodeWithinLimit(
    (q) => renderFramed(640, 960, "web").webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer(),
    web640Path,
    84,
    220_000,
  );

  // 2. Compact 320x480 WebP
  const web320Path = resolve(OUT_DIR, "w320", `${cardId}.webp`);
  const web320 = await encodeWithinLimit(
    (q) => renderFramed(320, 480, "web").webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer(),
    web320Path,
    82,
    85_000,
  );

  // 3. Full spotlight 1024x1536 WebP
  const web1024Path = resolve(OUT_DIR, "w1024", `${cardId}.webp`);
  const web1024 = await encodeWithinLimit(
    (q) => renderFramed(1024, 1536, "web").webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer(),
    web1024Path,
    84,
    460_000,
  );

  // 4. 640x960 AVIF comparison deliverable
  const avif640Path = resolve(OUT_DIR, "w640", `${cardId}.avif`);
  const avif640 = await encodeWithinLimit(
    (q) => renderFramed(640, 960, "web").avif({ quality: q, effort: 5 }).toBuffer(),
    avif640Path,
    60,
    180_000,
  );

  // 5. Direct-from-master 192x288 MCP WebP with dedicated bold-line frame
  const mcpPath = resolve(OUT_DIR, "mcp", `${cardId}.webp`);
  const mcp = await encodeWithinLimit(
    (q) => renderFramed(192, 288, "mcp").webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer(),
    mcpPath,
    72,
    18_000,
  );

  const metrics = await luminanceMetrics(web640Path);
  const v1Path = resolve(root, "assets/cards", `${cardId}.webp`);
  const v1Metrics = await luminanceMetrics(v1Path);

  console.log(
    `[v2] ${cardId.padEnd(20)} | 640w=${(web640.bytes / 1024).toFixed(1)}KB (q${web640.quality}) | avif=${(avif640.bytes / 1024).toFixed(1)}KB | 320w=${(web320.bytes / 1024).toFixed(1)}KB | 1024w=${(web1024.bytes / 1024).toFixed(1)}KB | mcp192=${(mcp.bytes / 1024).toFixed(1)}KB | mean=${metrics.mean} (v1=${v1Metrics.mean}) dark=${metrics.darkPct}% (v1=${v1Metrics.darkPct}%)`,
  );

  manifestCards.push({
    id: cardId,
    name: card.name,
    arcana: card.arcana,
    suit: card.suit ?? null,
    rank: card.number,
    sourceMasterSha256: await sha256(masterPath),
    luminance: metrics,
    v1BaselineLuminance: v1Metrics,
    web: {
      path: `/assets/cards/${DECK_ID}/${cardId}.webp`,
      physicalPath: `assets/cards/v2/${cardId}.webp`,
      width: 640,
      height: 960,
      bytes: web640.bytes,
      quality: web640.quality,
      sha256: await sha256(web640Path),
    },
    variants: {
      w320: {
        path: `/assets/cards/${DECK_ID}/w320/${cardId}.webp`,
        width: 320,
        height: 480,
        bytes: web320.bytes,
        quality: web320.quality,
      },
      w640Avif: {
        path: `/assets/cards/${DECK_ID}/w640/${cardId}.avif`,
        width: 640,
        height: 960,
        bytes: avif640.bytes,
        quality: avif640.quality,
      },
      w1024: {
        path: `/assets/cards/${DECK_ID}/w1024/${cardId}.webp`,
        width: 1024,
        height: 1536,
        bytes: web1024.bytes,
        quality: web1024.quality,
      },
    },
    mcp: {
      path: `/assets/cards/${DECK_ID}/mcp/${cardId}.webp`,
      physicalPath: `assets/cards/v2/mcp/${cardId}.webp`,
      width: 192,
      height: 288,
      bytes: mcp.bytes,
      quality: mcp.quality,
      sha256: await sha256(mcpPath),
    },
  });
}

// Process 180-degree pixel-exact symmetric card back directly from master
const backMaster = resolve(MASTER_DIR, "back.png");
const backFrameWeb = Buffer.from(buildV2BackFrameSvg(640, 960, "web"));
const backFrame320 = Buffer.from(buildV2BackFrameSvg(320, 480, "web"));
const backFrame1024 = Buffer.from(buildV2BackFrameSvg(1024, 1536, "web"));
const backFrameMcp = Buffer.from(buildV2BackFrameSvg(192, 288, "mcp"));

const backWebPath = resolve(OUT_DIR, "back.webp");
const back320Path = resolve(OUT_DIR, "w320", "back.webp");
const back1024Path = resolve(OUT_DIR, "w1024", "back.webp");
const backMcpPath = resolve(OUT_DIR, "mcp", "back.webp");

const [backWeb, back320, back1024, backMcp] = await Promise.all([
  encodeExactSymmetricBack(await make180SymmetricRaw(backMaster, 640, 960, backFrameWeb), backWebPath, 260_000),
  encodeExactSymmetricBack(await make180SymmetricRaw(backMaster, 320, 480, backFrame320), back320Path, 110_000),
  encodeExactSymmetricBack(await make180SymmetricRaw(backMaster, 1024, 1536, backFrame1024), back1024Path, 550_000),
  encodeExactSymmetricBack(await make180SymmetricRaw(backMaster, 192, 288, backFrameMcp), backMcpPath, 38_000),
]);

const [mWeb, m320, m1024, mMcp] = await Promise.all([
  decodedRotationalMismatch(backWebPath),
  decodedRotationalMismatch(back320Path),
  decodedRotationalMismatch(back1024Path),
  decodedRotationalMismatch(backMcpPath),
]);
if (mWeb !== 0 || m320 !== 0 || m1024 !== 0 || mMcp !== 0) {
  throw new Error(`Card back rotational symmetry mismatch: web=${mWeb}, 320=${m320}, 1024=${m1024}, mcp=${mMcp}`);
}
console.log(
  `[v2] back (180° EXACT)   | 640w=${(backWeb.bytes / 1024).toFixed(1)}KB (${backWeb.colours}c) | 320w=${(back320.bytes / 1024).toFixed(1)}KB | 1024w=${(back1024.bytes / 1024).toFixed(1)}KB | mcp192=${(backMcp.bytes / 1024).toFixed(1)}KB | mismatch=0`,
);

const manifest = {
  schemaVersion: 2,
  deckId: DECK_ID,
  status: "milestone-1-gate-6",
  title: "Luminous Midnight Art Nouveau Tarot (v2 Gate Edition)",
  provider: "openai-official-images-api",
  model: "gpt-image-2.6-sunburst",
  provenancePath: "assets/artwork/v2/provenance.json",
  foilMaskPath: `/assets/cards/${DECK_ID}/foil-mask.svg`,
  cardBack: {
    rotationalSymmetry: "180deg-exact-decoded-pixels",
    decodedRotationalMismatch: 0,
    sourceMasterSha256: await sha256(backMaster),
    web: {
      path: `/assets/cards/${DECK_ID}/back.webp`,
      width: 640,
      height: 960,
      bytes: backWeb.bytes,
      paletteColours: backWeb.colours,
      sha256: await sha256(backWebPath),
    },
    mcp: {
      path: `/assets/cards/${DECK_ID}/mcp/back.webp`,
      width: 192,
      height: 288,
      bytes: backMcp.bytes,
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

// Build visual comparison contact sheet (Row 1 = v1, Row 2 = v2 framed) + 64x96 legibility sheet
const allIds = [...GATE_CARD_IDS, "back"];
const cellW = 280;
const cellH = 420;
const gap = 18;
const labelH = 44;
const margin = 24;
const sheetW = margin * 2 + allIds.length * cellW + (allIds.length - 1) * gap;
const sheetH = margin * 2 + labelH * 2 + cellH * 2 + 28;

const composites = [];
for (let i = 0; i < allIds.length; i += 1) {
  const id = allIds[i];
  const x = margin + i * (cellW + gap);
  const v1Buf = await sharp(resolve(root, "assets/cards", `${id}.webp`))
    .resize(cellW, cellH, { fit: "fill" })
    .png()
    .toBuffer();
  const v2Buf = await sharp(resolve(OUT_DIR, `${id}.webp`))
    .resize(cellW, cellH, { fit: "fill" })
    .png()
    .toBuffer();
  composites.push({ input: v1Buf, left: x, top: margin + labelH });
  composites.push({ input: v2Buf, left: x, top: margin + labelH * 2 + cellH + 20 });
}

const labelsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
  <rect width="${sheetW}" height="${sheetH}" fill="#0a0e18"/>
  <text x="${margin}" y="${margin + 28}" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#c6a15b">ROW 1 — V1 BASELINE (midnight-art-nouveau-v1)</text>
  <text x="${margin}" y="${margin + labelH + cellH + 48}" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#f3e7c8">ROW 2 — V2 GATE (gpt-image-2.6-sunburst + Luminous Midnight Art Nouveau Arch Frames)</text>
</svg>`;

const comparisonPath = resolve(MASTER_DIR, "v1-vs-v2-comparison.png");
await sharp(Buffer.from(labelsSvg))
  .composite(composites)
  .png({ compressionLevel: 8 })
  .toFile(comparisonPath);

// Build 64x96 thumbnail readability audit sheet (2x crisp preview: v1 vs v2 at true 64x96 pixel grid)
const thumbW = 64;
const thumbH = 96;
const tGap = 14;
const tSheetW = margin * 2 + allIds.length * thumbW + (allIds.length - 1) * tGap;
const tSheetH = margin * 2 + 28 + thumbH * 2 + 22;
const tComposites = [];
for (let i = 0; i < allIds.length; i += 1) {
  const id = allIds[i];
  const x = margin + i * (thumbW + tGap);
  const v1T = await sharp(resolve(root, "assets/cards/mcp", `${id}.webp`)).resize(thumbW, thumbH).png().toBuffer();
  const v2T = await sharp(resolve(OUT_DIR, "mcp", `${id}.webp`)).resize(thumbW, thumbH).png().toBuffer();
  tComposites.push({ input: v1T, left: x, top: margin + 24 });
  tComposites.push({ input: v2T, left: x, top: margin + 24 + thumbH + 16 });
}
const thumbBg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tSheetW}" height="${tSheetH}">
  <rect width="${tSheetW}" height="${tSheetH}" fill="#0a0e18"/>
  <text x="${margin}" y="${margin + 14}" font-family="sans-serif" font-size="11" fill="#e8dcc0">64x96 MCP THUMBNAILS (top: v1, bottom: v2)</text>
</svg>`;
const thumbPath = resolve(MASTER_DIR, "v2-thumbnails-64x96.png");
await sharp(Buffer.from(thumbBg)).composite(tComposites).png().toFile(thumbPath);

console.log(`Saved comparison sheet: ${comparisonPath} (${(await stat(comparisonPath)).size} bytes)`);
console.log(`Saved 64x96 audit sheet: ${thumbPath}`);
