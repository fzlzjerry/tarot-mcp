import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const assets = [
  {
    from: join(rootDir, "src", "tarot", "cards", "card-data.json"),
    to: join(rootDir, "dist", "tarot", "cards", "card-data.json"),
  },
];

for (const asset of assets) {
  await mkdir(dirname(asset.to), { recursive: true });
  await copyFile(asset.from, asset.to);
}
