#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cardDataPath = resolve(root, "src/tarot/cards/card-data.json");
const outputPath = resolve(root, "assets/artwork/prompt-plan.json");

const STYLE_REFERENCE =
  "assets/artwork/style/dark-art-nouveau-style-board.png";

const suitDirection = {
  wands: {
    theme:
      "creative will, courage, ambition, movement, warmth and living energy",
    palette: "restrained amber-red accents",
    forbidden:
      "No physical wand, staff, rod, branch used as a staff, or decorative wand symbol",
  },
  cups: {
    theme:
      "emotion, relationship, intuition, reflection and the flow of the heart",
    palette: "restrained moon-blue and violet accents",
    forbidden:
      "No cup, goblet, chalice, bowl, drinking vessel, or decorative cup symbol",
  },
  swords: {
    theme:
      "thought, truth, tension, communication, discernment and decisive clarity",
    palette: "restrained silver-blue accents",
    forbidden:
      "No sword, blade, knife, dagger, weapon, or decorative sword symbol",
  },
  pentacles: {
    theme:
      "work, resources, body, stewardship, craft and practical reality",
    palette: "restrained moss-green and warm-ivory accents",
    forbidden:
      "No coin, pentacle, disk, medallion, five-pointed star, or decorative pentacle symbol",
  },
};

const rankScene = {
  1: "a solitary figure at a luminous threshold as a new path begins",
  2: "two figures or two paths held in careful equilibrium",
  3: "a small circle of collaborators shaping something that can grow",
  4: "a sheltered garden or quiet chamber holding a deliberate pause",
  5: "figures meeting friction, hardship or exclusion without graphic violence",
  6: "a graceful passage toward recognition, help, memory or calmer ground",
  7: "a lone figure testing choices, boundaries and disciplined judgment",
  8: "focused motion, skilled repetition or a path tightening around the subject",
  9: "a solitary figure at a late-night threshold of resilience or fulfillment",
  10: "a group or lone bearer meeting culmination, legacy or the weight of completion",
  11: "a curious youthful messenger studying a newly discovered sign",
  12: "a determined traveler moving through wind and changing terrain",
  13: "a mature sovereign woman embodying inward mastery and care",
  14: "a mature sovereign man embodying outward mastery and responsibility",
};

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function majorPrompt(card) {
  const visualCues = card.symbolism
    .map((entry) => entry.replace(/\s*\([^)]*\)\s*/g, ""))
    .join(", ");
  const themes = card.keywords.upright.slice(0, 3).join(", ");
  return `Create a brand-new original central illustration for the tarot archetype ${card.name}, using the attached style board only as visual style reference.
Portrait 2:3. Build an original narrative composition around these traditional symbolic cues: ${visualCues}. Express ${themes} through gesture, landscape, weather and architecture rather than copying an existing deck. Elegant Belle Époque-inspired garments where people appear, balanced anatomy, midnight indigo and near-black, antique-gold sinuous Art Nouveau ink linework, moonlit ivory highlights, restrained jewel accents, flat illustrative finish, clear focal silhouette, generous 8% safe margin.
This is CENTER ART only. No tarot border, frame or decorative pips. No readable text, letters, numbers, title, logo, signature, watermark, mockup, card shadow, copied deck artwork, gore or modern objects.`;
}

function minorPrompt(card) {
  const suit = suitDirection[card.suit];
  const themes = card.keywords.upright.slice(0, 3).join(", ");
  return `Create a brand-new original central illustration for a symbolic tarot scene, using the attached style board only as visual style reference.
Portrait 2:3. Show ${rankScene[card.number]}. Express ${themes} through human gesture, landscape, weather, architecture and botanical motifs, with an emotional undercurrent of ${suit.theme}. Do not imitate a known tarot composition. Elegant Belle Époque-inspired garments where people appear, balanced anatomy, midnight indigo and near-black, antique-gold sinuous Art Nouveau ink linework, moonlit ivory highlights, ${suit.palette}, flat illustrative finish, clear focal silhouette, generous 8% safe margin.
${suit.forbidden}; exact suit pips will be added later by deterministic post-processing. This is CENTER ART only. No tarot border, frame, decorative pips or suit symbols. No readable text, letters, numbers, title, logo, signature, watermark, mockup, card shadow, copied deck artwork, gore or modern objects.`;
}

const parsed = JSON.parse(await readFile(cardDataPath, "utf8"));
const cards = parsed.cards.map((card) => {
  const prompt = card.arcana === "major" ? majorPrompt(card) : minorPrompt(card);
  return {
    id: card.id,
    name: card.name,
    arcana: card.arcana,
    suit: card.suit ?? null,
    rank: card.number,
    pipCount:
      card.arcana === "minor" ? (card.number <= 10 ? card.number : 1) : null,
    sourcePath: `assets/artwork/source/${card.id}.png`,
    prompt,
    promptSha256: sha256(normalize(prompt)),
  };
});

const plan = {
  schemaVersion: 1,
  deckId: "midnight-art-nouveau-v1",
  generator: "OpenAI built-in image_gen",
  styleReference: STYLE_REFERENCE,
  styleReferenceSha256: sha256(
    await readFile(resolve(root, STYLE_REFERENCE)),
  ),
  constraints: {
    aspectRatio: "2:3",
    centerArtOnly: true,
    generatedTextAllowed: false,
    generatedSuitPipsAllowed: false,
  },
  cards,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(`Wrote ${cards.length} prompts to ${outputPath}`);
