#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cards = JSON.parse(
  await readFile(resolve(root, "src/tarot/cards/card-data.json"), "utf8"),
).cards;
const markReviewed = process.argv.includes("--mark-reviewed");
const tesseractProbe = spawnSync("tesseract", ["--version"], {
  encoding: "utf8",
});
const toolAvailable = tesseractProbe.status === 0;

const entries = [];
for (const card of cards) {
  const path = resolve(root, `assets/artwork/source/${card.id}.png`);
  let tokens = [];
  if (toolAvailable) {
    const result = spawnSync("tesseract", [path, "stdout", "--psm", "11"], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status === 0) {
      tokens = [
        ...new Set(
          result.stdout
            .match(/[A-Za-z]{4,}|[\u3400-\u9fff]{2,}/g)
            ?.map((token) => token.toLowerCase()) ?? [],
        ),
      ].slice(0, 20);
    }
  }
  entries.push({
    id: card.id,
    heuristicTokens: tokens,
    requiresVisualConfirmation: tokens.length > 0,
  });
}

const report = {
  schemaVersion: 1,
  deckId: "midnight-art-nouveau-v1",
  tool: toolAvailable ? "tesseract --psm 11" : "not-installed",
  note:
    "Decorative line art produces OCR false positives. Tokens are a review aid, not an automatic failure condition.",
  disposition: markReviewed
    ? "manual-review-completed"
    : "manual-review-required",
  entries,
};

await writeFile(
  resolve(root, "assets/cards/qa/ocr-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `Recorded OCR heuristics for ${entries.length} cards (${report.disposition}).`,
);
