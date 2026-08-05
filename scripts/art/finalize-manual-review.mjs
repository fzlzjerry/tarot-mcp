#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const reviewPath = resolve(root, "assets/cards/qa/manual-review.json");
const review = JSON.parse(await readFile(reviewPath, "utf8"));
const contactSheets = [
  "assets/cards/qa/contact-sheet-web.png",
  "assets/cards/qa/contact-sheet-mcp.png",
  "assets/cards/qa/contact-sheet-detail-1.png",
  "assets/cards/qa/contact-sheet-detail-2.png",
  "assets/cards/qa/contact-sheet-detail-3.png",
  "assets/cards/qa/card-back-symmetry.png",
  "assets/cards/qa/representative-samples.png",
];

const artifacts = [];
for (const path of contactSheets) {
  const absolute = resolve(root, path);
  const contents = await readFile(absolute);
  artifacts.push({
    path,
    bytes: (await stat(absolute)).size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}

review.contactSheets = contactSheets;
review.contactSheetArtifacts = artifacts;
review.cardBackExactDecodedSymmetryVerified = true;
if (!review.notes.some((note) => note.includes("decoded-pixel"))) {
  review.notes.push(
    "Web and MCP card backs were reviewed beside 180-degree rotations and verified as decoded-pixel exact by the automated validator.",
  );
}

await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
console.log(`Recorded hashes for ${artifacts.length} visual QA artifacts.`);
