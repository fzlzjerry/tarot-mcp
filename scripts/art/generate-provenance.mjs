#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const plan = JSON.parse(
  await readFile(resolve(root, "assets/artwork/prompt-plan.json"), "utf8"),
);
const overrides = JSON.parse(
  await readFile(resolve(root, "assets/artwork/prompt-overrides.json"), "utf8"),
);

const stylePrompt = `Use case: stylized-concept
Asset type: visual style board for a complete original 78-card tarot deck
Primary request: Create a cohesive dark-night Art Nouveau style board that will be used as the single visual reference for an original tarot deck. Show only visual samples: midnight-indigo and near-black grounds, antique-gold sinuous linework, moonlit ivory highlights, restrained jewel accents, elegant botanical curves, celestial geometry, balanced human proportions, Belle Époque-inspired garments, ornamental arch motifs, four small abstract suit emblems, and examples of atmospheric landscape, portrait, motion, and quiet mystery.
Composition/framing: portrait 2:3 reference sheet divided into clean visual swatches and illustration vignettes, generous safe margins, no complete tarot cards and no copied existing deck imagery.
Lighting/mood: nocturnal, mystical, calm, refined, luminous but not neon.
Constraints: entirely original; consistent flat illustrative finish with fine ink contours; no readable text, no letters, no numbers, no labels, no logo, no signature, no watermark, no mockup UI, no photorealism, no gradients that obscure linework.`;

const backPrompt = `Create a brand-new tarot card BACK design, using the attached style board only as a visual style reference.
Portrait 2:3 composition. Exact 180-degree rotational symmetry: the design must look identical when turned upside down. Midnight-indigo and near-black ground, antique-gold Art Nouveau linework, restrained moonlit ivory details, mirrored celestial geometry, paired crescent moons, stars, botanical curves, and a centered abstract rosette. Continuous ornamental border with generous safe margin.
Flat illustrative finish, crisp fine ink contours, calm nocturnal mystery, elegant and original.
No front-facing tarot scene. No readable text, no letters, no numbers, no logo, no signature, no watermark, no mockup, no card shadow, no hands holding the card.`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

async function fileRecord(path, prompt, reference = null) {
  const bytes = await readFile(resolve(root, path));
  return {
    path,
    sha256: sha256(bytes),
    prompt,
    promptSha256: sha256(normalize(prompt)),
    reference,
  };
}

const styleBoard = await fileRecord(
  "assets/artwork/style/dark-art-nouveau-style-board.png",
  stylePrompt,
);
const cardBack = await fileRecord(
  "assets/artwork/source/back.png",
  backPrompt,
  styleBoard.path,
);

const cards = [];
for (const card of plan.cards) {
  const prompt = overrides[card.id] ?? card.prompt;
  cards.push({
    id: card.id,
    name: card.name,
    ...(await fileRecord(card.sourcePath, prompt, styleBoard.path)),
  });
}

const provenance = {
  schemaVersion: 1,
  deckId: "midnight-art-nouveau-v1",
  generator: "OpenAI built-in image_gen",
  generationMode: "one independent built-in image_gen call per distinct asset",
  thirdPartyDownloads: false,
  createdDate: "2026-08-05",
  styleBoard,
  cardBack,
  cards,
};

await writeFile(
  resolve(root, "assets/artwork/prompt-provenance.json"),
  `${JSON.stringify(provenance, null, 2)}\n`,
);
console.log(`Recorded provenance for ${cards.length} generated card sources.`);
