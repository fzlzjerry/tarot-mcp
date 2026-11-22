#!/usr/bin/env node

/**
 * Generate the full 78-card + card-back Luminous Midnight Art Nouveau v2 deck
 * using OpenAI's official Images API (`gpt-image-2.5-sunburst` by default).
 *
 * Usage:
 *   node scripts/art/generate-v2-deck.mjs --stage style
 *   node scripts/art/generate-v2-deck.mjs --stage back
 *   node scripts/art/generate-v2-deck.mjs --stage cards [--quality xhigh|high] [--concurrency 5] [--only id1,id2] [--force]
 *   node scripts/art/generate-v2-deck.mjs --stage all
 */

import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cardDataPath = resolve(root, "src/tarot/cards/card-data.json");
const canonDataDir = resolve(root, "src/tarot/canon/data");
const canonFiles = [
  "major.json",
  "wands.json",
  "cups.json",
  "swords.json",
  "pentacles.json",
];
const masterRoot = resolve(
  process.env.TAROT_V2_MASTER_DIR ??
    resolve(homedir(), ".capy/work/tarot-v2-masters-2.5"),
);
const masterFolderLabel = basename(masterRoot);
const provenancePath = resolve(root, "assets/artwork/v2/provenance.json");

const API_BASE = "https://api.openai.com/v1/images";
const DEFAULT_MODEL = process.env.TAROT_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
const SIZE = "1024x1536";

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

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOpenAiImages(endpoint, payload, maxAttempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const started = Date.now();
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(480_000),
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
        const retryable =
          res.status === 429 ||
          res.status === 500 ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504;
        const err = new Error(`OpenAI ${endpoint} HTTP ${res.status}: ${msg}`);
        if (retryable && attempt < maxAttempts) {
          const delayMs = Math.min(45_000, 3000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 1500));
          console.warn(`[retry ${attempt}/${maxAttempts}] ${err.message} — waiting ${delayMs}ms`);
          await sleep(delayMs);
          lastError = err;
          continue;
        }
        throw err;
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
    } catch (err) {
      lastError = err;
      const isTimeoutOrNetwork =
        err?.name === "TimeoutError" ||
        err?.name === "AbortError" ||
        /fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(String(err?.message));
      if (isTimeoutOrNetwork && attempt < maxAttempts) {
        const delayMs = Math.min(30_000, 3000 * 2 ** (attempt - 1));
        console.warn(`[retry ${attempt}/${maxAttempts}] transient error (${err.message}) — waiting ${delayMs}ms`);
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
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
    "Create a museum-grade master visual style board for an original Luminous Midnight Art Nouveau tarot deck (portrait 2:3), channeling Alphonse Mucha sinuous calligraphic ink linework, Gustav Klimt luminous antique gold-leaf gilding, and classical European illuminated woodblock-and-gouache bookplates.",
    "Show a clean editorial grid containing: (1) a rich color palette swatch strip featuring deep velvety midnight-indigo shadows, warm moonlit ivory skin and silk highlight tones, molten antique-gold leaf specular highlights, and four distinct jewel suit accents (luminous sapphire-cerulean & moonstone amethyst for Cups, warm sunlit amber-vermilion & burnished bronze for Wands, crisp frost-silver & slate-cyan for Swords, verdant emerald & warm parchment gold for Pentacles); (2) four ornate embossed suit medallions clearly depicting a gleaming golden chalice, a straight engraved silver-gold sword, a blossoming bronze wand, and a detailed golden pentacle coin; (3) four luminous Art Nouveau portrait vignettes showing expressive classical faces, graceful hands, flowing draped silk, and radiant chiaroscuro lighting with crisp dark-ink contours and brilliant gold-ivory highlights against deep indigo negative space—never muddy, never airbrushed plastic, never flat dark.",
    "Strictly zero readable words, letters, numerals, labels, or watermarks. Fine editorial ink linework, rich painterly gouache texture, luminous gold-leaf contrast, unmistakable figure-ground separation.",
  ].join("\n");
}

function buildCardBackPrompt() {
  return [
    "Create a breathtaking, museum-grade luxury tarot card back design (portrait 2:3) matching the attached Luminous Midnight Art Nouveau style board (Alphonse Mucha calligraphic ink linework & Gustav Klimt antique gold-leaf bookplate texture).",
    "STRICT 180-DEGREE ROTATIONAL SYMMETRY (identical upside-down and right-side-up) AND bilateral left-right symmetry: centered eight-pointed celestial compass star mandala blooming inside an ornate gilded Art Nouveau botanical rosette; mirrored twin luminous ivory-gold crescent moons and celestial astrolabe rings near top and bottom; intricate burnished antique-gold acanthus vines, moonflowers, and delicate starlight filigree framing deep velvety midnight-indigo lacquer negative space; subtle sapphire and emerald jewel enamel accents inside the floral medallions.",
    "Full-bleed artwork with crisp, refined ornamental border structure and 4% outer safe margin. Luminous metallic antique-gold highlights against deep midnight-indigo velvet—rich contrast, painterly lithograph finesse, never muddy. Strictly no text, letters, numbers, signatures, logos, mockups, or drop shadows.",
  ].join("\n");
}

const SAFE_AVOID_STRIP = /\b(blood|gore|graphic|violence|violent|corpse|dead|death|wound|wounds|stabbed|impaled|naked|nude|nudity|explicit|sexual|bound|bondage|chain|chains|chained|whip|weapon|weapons|horror|torture|kill|killing|suicide|self-harm|struggle)\b/i;

function buildCardPrompt(card) {
  const spec = card.promptSpec;
  if (!spec) {
    throw new Error(`Card "${card.id}" has no promptSpec in canon data`);
  }
  const objectLine = spec.requiredObjects
    .map((item) => `EXACTLY ${item.count} ${item.object}`)
    .join("; ");
  const avoidLine = spec.avoid
    .filter((item) => !SAFE_AVOID_STRIP.test(item))
    .join(", ");
  const cardLabel =
    card.id === "death"
      ? "Arcana XIII: Autumnal Transformation and Dawn Renewal"
      : card.id === "devil"
        ? "Arcana XV: Shadow Sovereignty and Gilded Bonds"
        : card.id === "tower"
          ? "Arcana XVI: Lightning Spire of Revelation"
          : card.id.replace(/_/g, " ");
  const cleanScene = spec.scene
    .replace(/\bAlphonse\s+Mucha(?:'s)?\b/gi, "classical Art Nouveau")
    .replace(/\bMucha(?:-styled|'s)?\b/gi, "Art Nouveau")
    .replace(/\bGustav\s+Klimt(?:'s)?\b/gi, "gilded Viennese Secession")
    .replace(/\bKlimt(?:-styled|'s)?\b/gi, "gilded mosaic");
  return [
    `Create a breathtaking, museum-grade classical European tarot illustration (portrait 2:3) for "${cardLabel}" strictly matching the authentic Belle Epoque Art Nouveau sinuous ink linework, antique gouache-and-lithograph painterly texture, burnished gold-leaf highlights, and refined chiaroscuro of the attached Luminous Midnight Art Nouveau style board.`,
    `Lighting key: ${spec.lightingKey}. Primary palette & accents: ${spec.suitAccent}, anchored against deep velvety midnight-indigo shadows with luminous warm highlights on faces, hands, fabrics, and focal props so the main silhouette reads effortlessly even at 64x96px thumbnail size.`,
    `Scene & narrative action: ${cleanScene}`,
    `Mandatory countable elements (strict visual accuracy): ${objectLine}.`,
    `Composition & silhouette: ${spec.compositionNote}`,
    "CENTER ARTWORK ONLY filling the full 2:3 canvas with a generous 7% safe margin around key faces and props so a separate gilded Art Nouveau arch frame can overlay the outer edges cleanly.",
    `STRICTLY FORBIDDEN: ${avoidLine}, tarot borders, outer frames, corner pips, banners, title plaques, readable text, letters, numbers, Roman numerals, watermarks, signatures, card mockups, glossy plastic 3D look, or muddy flat low-contrast dark lighting.`,
  ].join("\n");
}

const SCAFFOLD_INSTRUCTIONS = {
  ten_of_wands:
    "Use the second attached diagram ONLY as a spatial layout scaffold showing the exact spacing and fan angle of the 10 individual sprouting wooden wands, the traveler's silhouette, and the distant glowing hilltop town; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
  star:
    "Use the second attached diagram ONLY as a spatial layout scaffold showing the EXACT placement of 1 large central eight-pointed gold star surrounded by EXACTLY 7 distinct smaller golden stars (4 on the left arc, 3 on the right arc), all comfortably below the upper margin above the kneeling maiden; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
  eight_of_wands:
    "Use the second attached diagram ONLY as a spatial layout scaffold showing EXACTLY 8 identical solid wooden sprouting wands in a crisp even vertical stack of 8 parallel diagonal shafts flying from upper-left to lower-right (every single one of the 8 gold-brown shafts must be rendered as a solid sprouting wooden wand, with ZERO wind ribbons or stray streaks), cleanly below the top arch margin and above the cypress river valley; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
  two_of_pentacles:
    "Use the second attached diagram ONLY as a spatial layout scaffold keeping both golden pentacle coins and the infinity ribbon comfortably inside the middle-upper frame (well below the top corners) flanking the poised dancer above rolling waves; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
  five_of_pentacles:
    "Use the second attached diagram ONLY as a spatial layout scaffold placing the warm stained-glass cathedral lancet window on the right so ALL 5 golden pentacles fit completely unclipped inside the glowing glass well below the top margin, above the two snow-dusted travelers; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
  six_of_pentacles:
    "Use the second attached diagram ONLY as a spatial layout scaffold placing EXACTLY 6 golden pentacles in two neat vertical columns of 3 well below the upper corners flanking the standing merchant with golden scales and two kneeling figures below (no extra seventh large pentacle coin); paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
  ten_of_pentacles:
    "Use the second attached diagram ONLY as a spatial layout scaffold showing the EXACT placement of all 10 golden pentacles in the balanced Tree of Life arrangement comfortably inside the central canvas (topmost pentacle well below the upper arch, bottom pentacle well above the lower edge) superimposed across the archway, multigenerational family, and two white hounds; paint everything organically in the Luminous Midnight Art Nouveau style of the first image.",
};

function starPolygon(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 16; i += 1) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="#f5d98a" stroke="#fff4cc" stroke-width="3"/>`;
}

function coinCircle(cx, cy, r = 52) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e6be6a" fill-opacity="0.72" stroke="#fff0b8" stroke-width="4"/>`;
}

async function generateCardScaffold(cardId, outputPath) {
  let svg = null;
  if (cardId === "ten_of_wands") {
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
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#0d1324"/>
      <ellipse cx="780" cy="360" rx="220" ry="180" fill="#e9a95c" fill-opacity="0.32"/>
      <path d="M0,1240 Q420,1040 1024,780 L1024,1536 L0,1536 Z" fill="#182038"/>
      <rect x="740" y="640" width="170" height="120" rx="12" fill="#f3ca78" fill-opacity="0.45"/>
      <ellipse cx="430" cy="960" rx="120" ry="230" fill="#7c3d35" fill-opacity="0.65"/>
      <circle cx="465" cy="705" r="58" fill="#efe2c4" fill-opacity="0.72"/>
      ${wands.join("\n")}
    </svg>`;
  } else if (cardId === "star") {
    const smallStars = [
      [255, 275],
      [370, 235],
      [205, 395],
      [325, 465],
      [660, 235],
      [780, 290],
      [745, 420],
    ];
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#0d1428"/>
      ${starPolygon(512, 355, 92, 26)}
      ${smallStars.map(([x, y]) => starPolygon(x, y, 42, 13)).join("\n")}
      <path d="M0,1040 Q512,960 1024,1040 L1024,1536 L0,1536 Z" fill="#162848"/>
      <ellipse cx="520" cy="940" rx="150" ry="250" fill="#3a5ba0" fill-opacity="0.55"/>
      <circle cx="515" cy="675" r="64" fill="#f0e2c6" fill-opacity="0.75"/>
    </svg>`;
  } else if (cardId === "eight_of_wands") {
    const wands = [];
    // Even vertical ladder of 8 solid parallel diagonal staves well inside top arch safe zone
    for (let i = 0; i < 8; i += 1) {
      const x1 = 165;
      const y1 = 275 + i * 80;
      const x2 = 855;
      const y2 = y1 + 185;
      wands.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#12182b" stroke-width="26" stroke-linecap="round"/>`,
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c98e3b" stroke-width="16" stroke-linecap="round"/>`,
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f7dc8d" stroke-width="5" stroke-linecap="round"/>`,
        `<circle cx="${x2}" cy="${y2}" r="14" fill="#6fcf97" stroke="#fff0b8" stroke-width="3"/>`,
      );
    }
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#131a34"/>
      <ellipse cx="760" cy="1160" rx="280" ry="160" fill="#e98a4a" fill-opacity="0.38"/>
      <path d="M0,1220 Q460,1150 1024,1240 L1024,1536 L0,1536 Z" fill="#1c2734"/>
      ${wands.join("\n")}
    </svg>`;
  } else if (cardId === "two_of_pentacles") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#0d152a"/>
      <path d="M0,980 Q320,860 640,980 T1024,960 L1024,1536 L0,1536 Z" fill="#183254"/>
      <path d="M270,450 C430,310 594,710 754,560 C890,430 620,280 512,505 C404,730 134,580 270,450 Z" fill="none" stroke="#f2cf7c" stroke-width="14"/>
      <ellipse cx="512" cy="860" rx="115" ry="260" fill="#2e5e4a" fill-opacity="0.65"/>
      <circle cx="512" cy="495" r="58" fill="#efe2c4" fill-opacity="0.78"/>
      ${coinCircle(265, 450, 64)}
      ${coinCircle(759, 560, 64)}
    </svg>`;
  } else if (cardId === "five_of_pentacles") {
    const coins = [
      [720, 365],
      [648, 495],
      [792, 495],
      [648, 625],
      [792, 625],
    ];
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#0c1222"/>
      <path d="M555,950 L555,390 Q720,220 885,390 L885,950 Z" fill="#3a321c" stroke="#d9b25a" stroke-width="8"/>
      ${coins.map(([x, y]) => coinCircle(x, y, 52)).join("\n")}
      <rect x="0" y="1220" width="1024" height="316" fill="#c8d4e6" fill-opacity="0.35"/>
      <ellipse cx="300" cy="1030" rx="110" ry="240" fill="#263840" fill-opacity="0.72"/>
      <ellipse cx="565" cy="1040" rx="115" ry="245" fill="#2f3542" fill-opacity="0.72"/>
    </svg>`;
  } else if (cardId === "six_of_pentacles") {
    const coins = [
      [210, 345],
      [210, 495],
      [210, 645],
      [814, 345],
      [814, 495],
      [814, 645],
    ];
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#0d1426"/>
      ${coins.map(([x, y]) => coinCircle(x, y, 54)).join("\n")}
      <ellipse cx="512" cy="820" rx="125" ry="310" fill="#215344" fill-opacity="0.65"/>
      <circle cx="512" cy="370" r="62" fill="#efe2c4" fill-opacity="0.78"/>
      <ellipse cx="245" cy="1175" rx="125" ry="175" fill="#524132" fill-opacity="0.65"/>
      <ellipse cx="775" cy="1175" rx="125" ry="175" fill="#5a4538" fill-opacity="0.65"/>
    </svg>`;
  } else if (cardId === "ten_of_pentacles") {
    const coins = [
      [512, 275],
      [315, 415],
      [709, 415],
      [315, 635],
      [709, 635],
      [512, 745],
      [315, 895],
      [709, 895],
      [512, 1085],
      [512, 1275],
    ];
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
      <rect width="1024" height="1536" fill="#101829"/>
      <path d="M135,1420 L135,340 Q512,175 889,340 L889,1420" fill="none" stroke="#857456" stroke-width="18" stroke-opacity="0.55"/>
      <ellipse cx="320" cy="960" rx="120" ry="260" fill="#2f5646" fill-opacity="0.45"/>
      <ellipse cx="745" cy="985" rx="120" ry="225" fill="#465c3a" fill-opacity="0.45"/>
      ${coins.map(([x, y]) => coinCircle(x, y, 52)).join("\n")}
    </svg>`;
  }
  if (!svg) return null;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buf);
  return outputPath;
}

async function loadAllCanonCards() {
  const cards = {};
  for (const file of canonFiles) {
    const filePath = resolve(canonDataDir, file);
    if (!(await fileExists(filePath))) continue;
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    for (const [id, entry] of Object.entries(parsed)) {
      cards[id] = entry;
    }
  }
  return cards;
}

async function loadProvenance(model) {
  try {
    return JSON.parse(await readFile(provenancePath, "utf8"));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return {
        schemaVersion: 2,
        deckId: "midnight-art-nouveau-v2",
        provider: "openai-official-images-api",
        model,
        endpointBase: API_BASE,
        createdDate: new Date().toISOString().slice(0, 10),
        styleBoard: null,
        cardBack: null,
        cards: {},
      };
    }
    throw err;
  }
}

let provenanceWriteQueue = Promise.resolve();
async function saveProvenance(prov) {
  const run = async () => {
    await mkdir(dirname(provenancePath), { recursive: true });
    await writeFile(provenancePath, `${JSON.stringify(prov, null, 2)}\n`);
  };
  provenanceWriteQueue = provenanceWriteQueue.then(run, run);
  return provenanceWriteQueue;
}

function parseArgs(argv) {
  const opts = {
    stage: "cards",
    quality: "high",
    complexity: null,
    model: DEFAULT_MODEL,
    concurrency: 5,
    only: null,
    force: false,
    resetProvenance: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stage") opts.stage = argv[++i];
    else if (arg === "--quality") opts.quality = argv[++i];
    else if (arg === "--complexity") opts.complexity = argv[++i];
    else if (arg === "--model") opts.model = argv[++i];
    else if (arg === "--concurrency") opts.concurrency = Math.max(1, Number(argv[++i]) || 5);
    else if (arg === "--only") opts.only = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--force") opts.force = true;
    else if (arg === "--reset-provenance") opts.resetProvenance = true;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const canonicalOrder = JSON.parse(await readFile(cardDataPath, "utf8")).cards.map((c) => c.id);
const canonCards = await loadAllCanonCards();
await mkdir(masterRoot, { recursive: true });

let prov = opts.resetProvenance
  ? {
      schemaVersion: 2,
      deckId: "midnight-art-nouveau-v2",
      provider: "openai-official-images-api",
      model: opts.model,
      endpointBase: API_BASE,
      createdDate: new Date().toISOString().slice(0, 10),
      styleBoard: null,
      cardBack: null,
      cards: {},
    }
  : await loadProvenance(opts.model);
prov.model = opts.model;
if (!prov.cards) prov.cards = {};

function sameStringArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

const styleBoardFile = resolve(masterRoot, "style-board.png");

if (opts.stage === "style" || opts.stage === "all") {
  const prompt = buildStyleBoardPrompt();
  const promptHash = sha256(normalizePrompt(prompt));
  const prevStyle = prov.styleBoard;
  const canReuseStyle =
    !opts.force &&
    (await fileExists(styleBoardFile)) &&
    Boolean(prevStyle) &&
    prevStyle.model === opts.model &&
    prevStyle.quality === opts.quality &&
    prevStyle.promptSha256 === promptHash &&
    prevStyle.masterSha256 === sha256(await readFile(styleBoardFile));

  if (canReuseStyle) {
    console.log(`[style] skip existing ${styleBoardFile} (inputs & master sha match)`);
  } else {
    console.log(`[style] generating ${opts.model} quality=${opts.quality}...`);
    const payload = {
      model: opts.model,
      prompt,
      size: SIZE,
      quality: opts.quality,
      output_format: "png",
      background: "opaque",
      ...(opts.complexity ? { complexity: opts.complexity } : {}),
    };
    const res = await callOpenAiImages("generations", payload);
    const tagged = addPngItxt(res.buffer, {
      prompt,
      model: opts.model,
      quality: opts.quality,
      asset: "style-board-v2",
    });
    await writeFile(styleBoardFile, tagged);
    prov.styleBoard = {
      masterFile: `${masterFolderLabel}/style-board.png`,
      model: opts.model,
      endpoint: "generations",
      size: res.size ?? SIZE,
      quality: res.quality ?? opts.quality,
      elapsedMs: res.elapsedMs,
      usage: res.usage,
      prompt,
      promptSha256: promptHash,
      masterSha256: sha256(tagged),
    };
    await saveProvenance(prov);
    console.log(`[style] saved ${styleBoardFile} (${(tagged.length / 1024).toFixed(0)} KB, ${res.elapsedMs}ms)`);
  }
}

if (opts.stage === "back" || opts.stage === "all") {
  const backFile = resolve(masterRoot, "back.png");
  const styleRef = await fileToDataUrl(styleBoardFile);
  const prompt = buildCardBackPrompt();
  const promptHash = sha256(normalizePrompt(prompt));
  const expectedBackRefs = [styleRef.sha256];
  const prevBack = prov.cardBack;
  const canReuseBack =
    !opts.force &&
    (await fileExists(backFile)) &&
    Boolean(prevBack) &&
    prevBack.model === opts.model &&
    prevBack.quality === "xhigh" &&
    prevBack.promptSha256 === promptHash &&
    sameStringArray(prevBack.refSha256s, expectedBackRefs) &&
    prevBack.masterSha256 === sha256(await readFile(backFile));

  if (canReuseBack) {
    console.log(`[back] skip existing ${backFile} (inputs, style ref & master sha match)`);
  } else {
    console.log(`[back] generating ${opts.model} quality=xhigh...`);
    const payload = {
      model: opts.model,
      images: [{ image_url: styleRef.dataUrl }],
      prompt,
      size: SIZE,
      quality: "xhigh",
      output_format: "png",
      background: "opaque",
      ...(opts.complexity ? { complexity: opts.complexity } : {}),
    };
    const res = await callOpenAiImages("edits", payload);
    const tagged = addPngItxt(res.buffer, {
      prompt,
      model: opts.model,
      quality: "xhigh",
      cardId: "back",
    });
    await writeFile(backFile, tagged);
    prov.cardBack = {
      masterFile: `${masterFolderLabel}/back.png`,
      model: opts.model,
      endpoint: "edits",
      size: res.size ?? SIZE,
      quality: res.quality ?? "xhigh",
      elapsedMs: res.elapsedMs,
      usage: res.usage,
      refSha256s: expectedBackRefs,
      prompt,
      promptSha256: promptHash,
      masterSha256: sha256(tagged),
    };
    await saveProvenance(prov);
    console.log(`[back] saved ${backFile} (${(tagged.length / 1024).toFixed(0)} KB, ${res.elapsedMs}ms)`);
  }
}

if (opts.stage === "cards" || opts.stage === "all") {
  const styleRef = await fileToDataUrl(styleBoardFile);
  const targets = opts.only ?? canonicalOrder;
  const totalCount = targets.length;
  let completedCount = 0;

  const runOne = async (targetId) => {
    const card = canonCards[targetId];
    if (!card) throw new Error(`Unknown canon card id: ${targetId}`);
    let prompt = buildCardPrompt(card);
    const images = [{ image_url: styleRef.dataUrl }];
    const refSha256s = [styleRef.sha256];

    if (SCAFFOLD_INSTRUCTIONS[targetId]) {
      const scaffoldPath = resolve(masterRoot, `scaffold-${targetId}.png`);
      await generateCardScaffold(targetId, scaffoldPath);
      const scaffoldRef = await fileToDataUrl(scaffoldPath);
      images.push({ image_url: scaffoldRef.dataUrl });
      refSha256s.push(scaffoldRef.sha256);
      prompt += `\n${SCAFFOLD_INSTRUCTIONS[targetId]}`;
    }

    const promptHash = sha256(normalizePrompt(prompt));
    const outPath = resolve(masterRoot, `${targetId}.png`);
    const prev = prov.cards[targetId];

    if (
      !opts.force &&
      (await fileExists(outPath)) &&
      prev &&
      prev.model === opts.model &&
      prev.quality === opts.quality &&
      prev.promptSha256 === promptHash &&
      sameStringArray(prev.refSha256s, refSha256s) &&
      prev.masterSha256 === sha256(await readFile(outPath))
    ) {
      completedCount += 1;
      console.log(`[cards ${completedCount}/${totalCount}] skip existing ${targetId}`);
      return;
    }

    const payload = {
      model: opts.model,
      images,
      prompt,
      size: SIZE,
      quality: opts.quality,
      output_format: "png",
      background: "opaque",
      ...(opts.complexity ? { complexity: opts.complexity } : {}),
    };
    console.log(`[cards] starting ${targetId} (${opts.model}, q=${opts.quality}, refs=${images.length})...`);
    const res = await callOpenAiImages("edits", payload);
    const tagged = addPngItxt(res.buffer, {
      prompt,
      model: opts.model,
      quality: opts.quality,
      cardId: targetId,
    });
    await writeFile(outPath, tagged);
    prov.cards[targetId] = {
      id: targetId,
      masterFile: `${masterFolderLabel}/${targetId}.png`,
      model: opts.model,
      endpoint: "edits",
      size: res.size ?? SIZE,
      quality: res.quality ?? opts.quality,
      elapsedMs: res.elapsedMs,
      usage: res.usage,
      refSha256s,
      prompt,
      promptSha256: promptHash,
      masterSha256: sha256(tagged),
    };
    await saveProvenance(prov);
    completedCount += 1;
    console.log(
      `[cards ${completedCount}/${totalCount}] ${targetId} done (${(tagged.length / 1024).toFixed(0)} KB, ${res.elapsedMs}ms)`,
    );
  };

  const queue = [...targets];
  const failures = [];
  const workers = Array.from(
    { length: Math.min(opts.concurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) continue;
        try {
          await runOne(next);
        } catch (err) {
          console.error(`[cards] FAILED ${next}: ${err.message}`);
          failures.push({ id: next, error: err });
        }
      }
    },
  );
  await Promise.all(workers);
  await saveProvenance(prov);
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} card(s) failed: ${failures.map((f) => `${f.id} (${f.error.message})`).join("; ")}`,
    );
  }
}
