#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const canonPath = resolve(root, "src/tarot/canon/gate-cards.json");
const masterRoot = resolve(
  process.env.TAROT_V2_MASTER_DIR ?? resolve(homedir(), ".capy/work/tarot-v2-masters"),
);
const provenancePath = resolve(root, "assets/artwork/v2/provenance.json");

const API_BASE = "https://api.openai.com/v1/images";
const DEFAULT_MODEL = process.env.TAROT_IMAGE_MODEL ?? "gpt-image-2.6-sunburst";
const SIZE = "1024x1536";

const GATE_CARD_IDS = [
  "fool",
  "three_of_cups",
  "three_of_pentacles",
  "queen_of_swords",
  "ten_of_wands",
];

function getApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is required in the environment.");
  }
  return key;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function normalizePrompt(text) {
  return text.replace(/\s+/g, " ").trim();
}

function addPngItxt(pngBuffer, entries) {
  const iendIndex = pngBuffer.lastIndexOf(Buffer.from("IEND")) - 4;
  if (iendIndex < 8) return pngBuffer;
  const chunks = [];
  for (const [key, value] of Object.entries(entries)) {
    const keyBuf = Buffer.from(key, "latin1");
    const valBuf = Buffer.from(String(value), "utf8");
    const payload = Buffer.concat([keyBuf, Buffer.from([0, 0, 0, 0, 0]), valBuf]);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(payload.length, 0);
    const typeBuf = Buffer.from("iTXt", "latin1");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, payload])) >>> 0, 0);
    chunks.push(lenBuf, typeBuf, payload, crcBuf);
  }
  return Buffer.concat([
    pngBuffer.subarray(0, iendIndex),
    ...chunks,
    pngBuffer.subarray(iendIndex),
  ]);
}

async function callOpenAiImages(endpoint, payload) {
  const started = Date.now();
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(600_000),
  });
  const elapsedMs = Date.now() - started;
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 600);
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // keep raw snippet
    }
    throw new Error(`OpenAI ${endpoint} HTTP ${res.status}: ${msg}`);
  }
  const data = JSON.parse(text);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI ${endpoint} returned no b64_json image.`);
  }
  return {
    buffer: Buffer.from(b64, "base64"),
    usage: data.usage ?? null,
    quality: data.quality ?? payload.quality ?? null,
    size: data.size ?? payload.size ?? null,
    elapsedMs,
  };
}

async function fileToDataUrl(filePath) {
  const bytes = await readFile(filePath);
  const ext = filePath.toLowerCase().endsWith(".webp")
    ? "image/webp"
    : filePath.toLowerCase().endsWith(".jpg") || filePath.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";
  return {
    dataUrl: `data:${ext};base64,${bytes.toString("base64")}`,
    sha256: sha256(bytes),
  };
}

function buildStyleBoardPrompt() {
  return [
    "Create a luxury master visual style board for an original 'Luminous Midnight Art Nouveau' tarot deck (portrait 2:3), inspired by Alphonse Mucha's sinuous ink linework, Gustav Klimt's warm burnished gold-leaf highlights, and fine European illuminated bookplates.",
    "Show a clean editorial grid containing: (1) a rich color palette swatch strip featuring deep midnight-indigo shadows, warm moonlit ivory skin/highlight tones, molten antique-gold metal highlights, and four distinct high-saturation jewel suit accents (cerulean-sapphire & amethyst for Cups, warm amber-vermilion & bronze for Wands, crisp ice-silver & storm-slate for Swords, emerald-verdigris & warm parchment ochre for Pentacles); (2) four ornamental suit medallions clearly illustrating a gleaming ornate golden chalice, a straight engraved silver-gold sword, a flowering bronze wand, and an embossed golden pentacle coin; (3) four luminous vignette portraits demonstrating dramatic chiaroscuro lighting where faces, hands, silk drapery, and gilded metallic props glow with warm ivory and burnished gold against velvety deep indigo negative space—never muddy, never flat, never crushed into uniform darkness.",
    "Zero readable words, letters, labels, or watermarks. Crisp editorial ink linework, refined painterly shading, opulent gold-leaf specular gleam, unmistakable figure-ground separation.",
  ].join("\n");
}

function buildCardBackPrompt() {
  return [
    "Create a breathtaking, museum-grade luxury tarot card back design (portrait 2:3) matching the attached Luminous Midnight Art Nouveau style board.",
    "STRICT 180-DEGREE ROTATIONAL SYMMETRY (identical upside-down and right-side-up) AND bilateral left-right symmetry: centered eight-pointed celestial compass star mandala blooming inside an ornate Klimt-and-Mucha gilded botanical rosette; mirrored twin luminous ivory-gold crescent moons and celestial astrolabe rings near top and bottom; intricate burnished antique-gold Art Nouveau acanthus vines, moonflowers, and delicate starlight filigree framing deep velvety midnight-indigo lacquer negative space; subtle sapphire and emerald jewel enamel accents inside the floral medallions.",
    "Full-bleed artwork with crisp, refined ornamental border structure and 4% outer safe margin. Luminous metallic gold highlights against deep obsidian-indigo velvet—rich contrast, never muddy. Strictly no text, letters, numbers, signatures, logos, mockups, or drop shadows.",
  ].join("\n");
}

function buildCardPrompt(card) {
  const spec = card.promptSpec;
  if (!spec) {
    throw new Error(`Card "${card.id}" has no promptSpec in gate-cards.json`);
  }
  const objectLine = spec.requiredObjects
    .map((item) => `EXACTLY ${item.count} ${item.object}`)
    .join("; ");
  const avoidLine = spec.avoid.join(", ");
  return [
    `Create a breathtaking, original central tarot illustration (portrait 2:3) for "${card.id.replace(/_/g, " ")}" strictly matching the artistic style, ink linework, warm ivory-and-gold illumination, and rich figure-ground contrast of the attached Luminous Midnight Art Nouveau style board.`,
    `Lighting key: ${spec.lightingKey}. Primary palette & accents: ${spec.suitAccent}, anchored against deep velvety midnight-indigo shadows with luminous warm highlights on faces, hands, fabrics, and focal props so the main silhouette reads effortlessly even at 64x96px thumbnail size.`,
    `Scene & narrative action: ${spec.scene}`,
    `Mandatory countable elements (strict accuracy): ${objectLine}.`,
    `Composition & silhouette: ${spec.compositionNote}`,
    "CENTER ARTWORK ONLY filling the full 2:3 canvas with a generous 7% safe margin around key faces and props so a separate gilded Art Nouveau arch frame can overlay the outer edges cleanly.",
    `STRICTLY FORBIDDEN: ${avoidLine}, tarot borders, outer frames, corner pips, banners, title plaques, readable text, letters, numbers, Roman numerals, watermarks, signatures, card mockups, or muddy flat low-contrast dark lighting.`,
  ].join("\n");
}

async function generateTenWandsScaffold(outputPath) {
  // Programmatic 10-wand placement scaffold (1024x1536) to anchor exact wand count & spacing
  const wands = [];
  for (let i = 0; i < 10; i += 1) {
    const t = i / 9;
    const x1 = Math.round(290 + t * 230);
    const y1 = Math.round(1230 - t * 90);
    const x2 = Math.round(200 + t * 470);
    const y2 = Math.round(330 - Math.sin(t * Math.PI) * 90);
    wands.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e7c372" stroke-width="11" stroke-linecap="round"/>`,
      `<circle cx="${x2}" cy="${y2}" r="11" fill="#6fcf97" stroke="#f7e3a8" stroke-width="3"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
    <rect width="1024" height="1536" fill="#0d1324"/>
    <ellipse cx="780" cy="360" rx="220" ry="180" fill="#e9a95c" fill-opacity="0.32"/>
    <path d="M0,1240 Q420,1040 1024,780 L1024,1536 L0,1536 Z" fill="#182038"/>
    <rect x="740" y="640" width="170" height="120" rx="12" fill="#f3ca78" fill-opacity="0.45"/>
    <ellipse cx="430" cy="960" rx="120" ry="230" fill="#7c3d35" fill-opacity="0.65"/>
    <circle cx="465" cy="705" r="58" fill="#efe2c4" fill-opacity="0.72"/>
    ${wands.join("\n")}
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buf);
  return outputPath;
}

async function loadProvenance() {
  try {
    return JSON.parse(await readFile(provenancePath, "utf8"));
  } catch {
    return {
      schemaVersion: 2,
      deckId: "midnight-art-nouveau-v2",
      provider: "openai-official-images-api",
      endpointBase: API_BASE,
      createdDate: new Date().toISOString().slice(0, 10),
      styleBoard: null,
      blindTest: {},
      cardBack: null,
      cards: {},
    };
  }
}

async function saveProvenance(prov) {
  await mkdir(dirname(provenancePath), { recursive: true });
  await writeFile(provenancePath, `${JSON.stringify(prov, null, 2)}\n`);
}

function parseArgs(argv) {
  const opts = {
    stage: "all",
    quality: "high",
    complexity: "high",
    model: DEFAULT_MODEL,
    only: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stage") opts.stage = argv[++i];
    else if (arg === "--quality") opts.quality = argv[++i];
    else if (arg === "--complexity") opts.complexity = argv[++i];
    else if (arg === "--model") opts.model = argv[++i];
    else if (arg === "--only") opts.only = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const canon = JSON.parse(await readFile(canonPath, "utf8"));
await mkdir(masterRoot, { recursive: true });
const prov = await loadProvenance();

const styleBoardFile = resolve(masterRoot, "style-board.png");

if (opts.stage === "style" || opts.stage === "all") {
  const prompt = buildStyleBoardPrompt();
  console.log(`[style] generating ${opts.model} quality=${opts.quality} complexity=${opts.complexity}...`);
  const res = await callOpenAiImages("generations", {
    model: opts.model,
    prompt,
    size: SIZE,
    quality: opts.quality,
    complexity: opts.complexity,
    output_format: "png",
    background: "opaque",
  });
  const tagged = addPngItxt(res.buffer, {
    prompt,
    model: opts.model,
    quality: opts.quality,
    asset: "style-board-v2",
  });
  await writeFile(styleBoardFile, tagged);
  prov.styleBoard = {
    masterFile: styleBoardFile,
    model: opts.model,
    endpoint: "generations",
    size: res.size ?? SIZE,
    quality: res.quality ?? opts.quality,
    complexity: opts.complexity,
    elapsedMs: res.elapsedMs,
    usage: res.usage,
    prompt,
    promptSha256: sha256(normalizePrompt(prompt)),
    masterSha256: sha256(tagged),
  };
  await saveProvenance(prov);
  console.log(`[style] saved ${styleBoardFile} (${(tagged.length / 1024).toFixed(0)} KB, ${res.elapsedMs}ms, usage=${JSON.stringify(res.usage)})`);
}

if (opts.stage === "blind-test") {
  const card = canon.cards.queen_of_swords;
  const prompt = buildCardPrompt(card);
  const styleRef = await fileToDataUrl(styleBoardFile);
  const qualities = ["high", "xhigh"];
  console.log(`[blind-test] running queen_of_swords on ${opts.model} for qualities=${qualities.join(",")}...`);
  const results = await Promise.all(
    qualities.map(async (q) => {
      const res = await callOpenAiImages("edits", {
        model: opts.model,
        images: [{ image_url: styleRef.dataUrl }],
        prompt,
        size: SIZE,
        quality: q,
        complexity: opts.complexity,
        output_format: "png",
        background: "opaque",
      });
      const outPath = resolve(masterRoot, `blind-queen_of_swords-${q}.png`);
      const tagged = addPngItxt(res.buffer, {
        prompt,
        model: opts.model,
        quality: q,
        cardId: "queen_of_swords",
      });
      await writeFile(outPath, tagged);
      return { q, outPath, res, bytes: tagged.length, masterSha256: sha256(tagged) };
    }),
  );
  for (const item of results) {
    prov.blindTest[item.q] = {
      cardId: "queen_of_swords",
      masterFile: item.outPath,
      model: opts.model,
      endpoint: "edits",
      size: item.res.size ?? SIZE,
      quality: item.res.quality ?? item.q,
      complexity: opts.complexity,
      elapsedMs: item.res.elapsedMs,
      usage: item.res.usage,
      refSha256s: [styleRef.sha256],
      promptSha256: sha256(normalizePrompt(prompt)),
      masterSha256: item.masterSha256,
    };
    console.log(
      `[blind-test] queen_of_swords (${item.q}) -> ${item.outPath} (${(item.bytes / 1024).toFixed(0)} KB, ${item.res.elapsedMs}ms, usage=${JSON.stringify(item.res.usage)})`,
    );
  }
  await saveProvenance(prov);
}

if (opts.stage === "cards" || opts.stage === "all") {
  const styleRef = await fileToDataUrl(styleBoardFile);
  const targets = opts.only ?? [...GATE_CARD_IDS, "back"];

  const runOne = async (targetId) => {
    if (targetId === "back") {
      const prompt = buildCardBackPrompt();
      console.log(`[cards] generating back (${opts.model}, q=${opts.quality})...`);
      const res = await callOpenAiImages("edits", {
        model: opts.model,
        images: [{ image_url: styleRef.dataUrl }],
        prompt,
        size: SIZE,
        quality: opts.quality,
        complexity: opts.complexity,
        output_format: "png",
        background: "opaque",
      });
      const outPath = resolve(masterRoot, "back.png");
      const tagged = addPngItxt(res.buffer, {
        prompt,
        model: opts.model,
        quality: opts.quality,
        cardId: "back",
      });
      await writeFile(outPath, tagged);
      prov.cardBack = {
        masterFile: outPath,
        model: opts.model,
        endpoint: "edits",
        size: res.size ?? SIZE,
        quality: res.quality ?? opts.quality,
        complexity: opts.complexity,
        elapsedMs: res.elapsedMs,
        usage: res.usage,
        refSha256s: [styleRef.sha256],
        prompt,
        promptSha256: sha256(normalizePrompt(prompt)),
        masterSha256: sha256(tagged),
      };
      console.log(`[cards] back done (${(tagged.length / 1024).toFixed(0)} KB, ${res.elapsedMs}ms, usage=${JSON.stringify(res.usage)})`);
      return;
    }

    const card = canon.cards[targetId];
    if (!card) throw new Error(`Unknown gate card id: ${targetId}`);
    let prompt = buildCardPrompt(card);
    const images = [{ image_url: styleRef.dataUrl }];
    const refSha256s = [styleRef.sha256];

    if (targetId === "ten_of_wands") {
      const scaffoldPath = resolve(masterRoot, "scaffold-ten_of_wands.png");
      await generateTenWandsScaffold(scaffoldPath);
      const scaffoldRef = await fileToDataUrl(scaffoldPath);
      images.push({ image_url: scaffoldRef.dataUrl });
      refSha256s.push(scaffoldRef.sha256);
      prompt += "\nUse the second attached diagram ONLY as a spatial layout scaffold showing the exact spacing and fan angle of the 10 individual sprouting wooden wands, the traveler's silhouette, and the distant glowing hilltop town; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.";
    }

    console.log(`[cards] generating ${targetId} (${opts.model}, q=${opts.quality}, refs=${images.length})...`);
    const res = await callOpenAiImages("edits", {
      model: opts.model,
      images,
      prompt,
      size: SIZE,
      quality: opts.quality,
      complexity: opts.complexity,
      output_format: "png",
      background: "opaque",
    });
    const outPath = resolve(masterRoot, `${targetId}.png`);
    const tagged = addPngItxt(res.buffer, {
      prompt,
      model: opts.model,
      quality: opts.quality,
      cardId: targetId,
    });
    await writeFile(outPath, tagged);
    prov.cards[targetId] = {
      id: targetId,
      masterFile: outPath,
      model: opts.model,
      endpoint: "edits",
      size: res.size ?? SIZE,
      quality: res.quality ?? opts.quality,
      complexity: opts.complexity,
      elapsedMs: res.elapsedMs,
      usage: res.usage,
      refSha256s,
      prompt,
      promptSha256: sha256(normalizePrompt(prompt)),
      masterSha256: sha256(tagged),
    };
    console.log(`[cards] ${targetId} done (${(tagged.length / 1024).toFixed(0)} KB, ${res.elapsedMs}ms, usage=${JSON.stringify(res.usage)})`);
  };

  // Bounded concurrency of 3 so we finish fast without tripping rate limits
  const queue = [...targets];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) await runOne(next);
    }
  });
  await Promise.all(workers);
  await saveProvenance(prov);
}
