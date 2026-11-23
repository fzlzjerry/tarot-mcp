import { copyFile, cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
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
    from: join(rootDir, "assets", "artwork", "v2", "provenance.json"),
    to: join(
      rootDir,
      "dist",
      "assets",
      "artwork",
      "v2",
      "provenance.json",
    ),
  },
];

for (const asset of assets) {
  await mkdir(dirname(asset.to), { recursive: true });
  await copyFile(asset.from, asset.to);
}

await cp(
  join(rootDir, "src", "tarot", "canon", "data"),
  join(rootDir, "dist", "tarot", "canon", "data"),
  { recursive: true, force: true },
);

await cp(
  join(rootDir, "assets", "cards"),
  join(rootDir, "dist", "assets", "cards"),
  { recursive: true, force: true },
);
