# Tarot artwork pipeline

The repository ships one deck, `midnight-art-nouveau-v2` (Luminous Midnight Art
Nouveau). The Web table serves it from
`/assets/cards/midnight-art-nouveau-v2-r2/` and the MCP App bundles it. The
pipeline does not download or hotlink artwork.

Every card master, the style board and the card back were generated through the
OpenAI Images API with `gpt-image-2.5-sunburst` at 1024×1536. Cards and the back
are edits against the style board, so the deck shares one hand.

`npm run verify:assets` runs the validator. `npm run verify:build` runs it and
then checks the packaged `dist`.

The first edition, `midnight-art-nouveau-v1`, is retired. Its artwork, sources
and pipeline scripts remain in the repository history and are complete at
commit `37e8a22`.

## Inputs

- `src/tarot/cards/card-data.json` as the canonical id and rank registry.
- `src/tarot/canon/data/*.json`: each card's `promptSpec` supplies the scene,
  the motifs that must appear and what to avoid.
- `OPENAI_API_KEY` in the environment. Only `generate-v2-deck.mjs` reads it,
  as the request's Bearer header; it is not written to a master or to the
  provenance file.
- `TAROT_IMAGE_MODEL` (optional) overrides the model.
- `TAROT_V2_MASTER_DIR` (optional) is where the lossless masters are written and
  read. It defaults to `~/.capy/work/tarot-v2-masters-2.5`. The masters are not
  committed; `assets/artwork/v2/provenance.json` records each one's prompt,
  model, quality, reference hash and SHA-256.

## Reprocess the published deck

With the masters in the master directory, this rebuilds every published file
without calling the API:

```bash
node scripts/art/process-v2-deck.mjs
node scripts/art/validate-v2-deck.mjs
```

`process-v2-deck.mjs` stops if any of the 78 card masters or `back.png` is
missing.

## Regenerate artwork

Generation costs API credit, is not deterministic, and overwrites masters that
are not committed, so copy the master directory somewhere safe first. Each
generated image also rewrites its entry in `assets/artwork/v2/provenance.json`.

The published deck was generated at `--quality xhigh`, and the script's default
is `high`. A stage reuses an existing master only when the model, quality,
prompt, reference hashes and file hash all match its provenance entry. At the
default quality nothing matches: the style stage replaces the style board and
the cards stage regenerates all 78 cards. Pass `--quality xhigh` every time.

To replace named cards and keep the rest:

```bash
node scripts/art/generate-v2-deck.mjs --stage cards --quality xhigh --only fool,eight_of_wands --force
node scripts/art/process-v2-deck.mjs
node scripts/art/validate-v2-deck.mjs
```

To generate a whole new deck, on a machine without the masters or with
`--force` on each stage:

```bash
node scripts/art/generate-v2-deck.mjs --stage style --quality xhigh
node scripts/art/generate-v2-deck.mjs --stage back
node scripts/art/generate-v2-deck.mjs --stage cards --quality xhigh
node scripts/art/process-v2-deck.mjs
node scripts/art/validate-v2-deck.mjs
```

`--stage all` runs the three generation stages in order, and the cards stage
also accepts `--concurrency <n>`. The back is always generated at `xhigh`. A
new style board changes the reference of every card and the back, so the later
stages then regenerate them all.

`process-v2-deck.mjs` rebuilds the contact sheets from the processed files, so
review each changed card on them after processing and before publishing.

## Deterministic layers

The prompts forbid borders, frames, corner pips, title plaques, letters and
numerals, so the generated art carries no text. `process-v2-deck.mjs` composites
the rest from `frames-v2.mjs`:

- a gilded arch frame in a palette per suit;
- the rank in the top cartouche: `0` and `I`–`XXI` for the Major Arcana, and
  `I`–`X`, `P`, `N`, `Q`, `K` for the Minor Arcana;
- one suit emblem in the bottom crest, or a star medallion for the Major Arcana.

The counted suit objects, such as the eight wands, are part of the
illustration, so their count is checked by eye on the contact sheets, not by a
script.

The card back is made exactly symmetric under a 180° rotation and encoded as
lossless WebP, so a reversed card cannot be told from an upright one while face
down.

## Outputs and gates

- Web: `assets/cards/v2/{cardId}.webp`, 640×960, at most 180,000 bytes.
- MCP: `assets/cards/v2/mcp/{cardId}.webp`, 192×288, at most 24,000 bytes. The
  deck gallery uses the same files as thumbnails.
- `assets/cards/v2/back.webp` and `mcp/back.webp`, `foil-mask.svg`, and
  `manifest.json` with the hash, size and dimensions of every card face and
  back, and each face's luminance. The foil mask is listed by path only.
- Six contact sheets are written to `<master dir>/qa/` for review. They are not
  committed.
- `validate-v2-deck.mjs` checks all 78 ids against the manifest and provenance,
  hashes, dimensions, size limits, uniqueness, the exact symmetry of the decoded
  card back, and the bundled MCP artwork budget: at most 600,000 raw bytes and
  800,000 base64 bytes for the 78 faces plus the back.

## Changing a published image

Artwork URLs are served as `immutable`, so a browser never re-fetches one. A
change to any image therefore ships under a new asset revision. Raise it in
every place that names it, then rebuild:

- `ASSET_REVISION` in `scripts/art/process-v2-deck.mjs`;
- `EXPECTED_ASSET_REVISION` in `scripts/art/validate-v2-deck.mjs`;
- `VISUAL_CARD_V2_ASSET_REVISION` in `src/tarot/shared/artwork.ts`;
- the asset base checked by `scripts/verify-build-assets.mjs`;
- the image URL expected by `src/__tests__/http-server.test.ts`;
- the URLs quoted in this file, `docs/api.md` and `SPEC.md`.
