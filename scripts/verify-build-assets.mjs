import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const rootDir = process.cwd();
const sourcePath = join(rootDir, "src", "tarot", "cards", "card-data.json");
const distPath = join(rootDir, "dist", "tarot", "cards", "card-data.json");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const [source, dist] = await Promise.all([
  readFile(sourcePath),
  readFile(distPath),
]);

if (sha256(source) !== sha256(dist)) {
  throw new Error(
    "dist/tarot/cards/card-data.json does not match src/tarot/cards/card-data.json. Run npm run build.",
  );
}

const parsed = JSON.parse(dist.toString("utf8"));
if (!Array.isArray(parsed.cards) || parsed.cards.length !== 78) {
  throw new Error("dist tarot card asset must contain exactly 78 cards.");
}

console.log("Verified tarot card build asset matches source data.");
