import { copyFile, cp, mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const assets = [
  {
    from: join(rootDir, "src", "tarot", "cards", "card-data.json"),
    to: join(rootDir, "dist", "tarot", "cards", "card-data.json"),
  },
  {
    from: join(rootDir, "assets", "ASSET_LICENSE.md"),
    to: join(rootDir, "dist", "assets", "ASSET_LICENSE.md"),
  },
  {
    from: join(rootDir, "assets", "artwork", "prompt-provenance.json"),
    to: join(
      rootDir,
      "dist",
      "assets",
      "artwork",
      "prompt-provenance.json",
    ),
  },
];

for (const asset of assets) {
  await mkdir(dirname(asset.to), { recursive: true });
  await copyFile(asset.from, asset.to);
}

const cardSource = join(rootDir, "assets", "cards");
const cardDestination = join(rootDir, "dist", "assets", "cards");
await cp(cardSource, cardDestination, {
  recursive: true,
  force: true,
  filter(source) {
    const localPath = relative(cardSource, source);
    return localPath.split(/[\\/]/, 1)[0] !== "qa";
  },
});
