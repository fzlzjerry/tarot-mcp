# Tarot artwork pipeline

The repository ships two editions of the deck. Neither pipeline downloads or
hotlinks artwork.

| Edition                            | Deck id                   | Served from                                 | Role                                                          |
| ---------------------------------- | ------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| v2 (Luminous Midnight Art Nouveau) | `midnight-art-nouveau-v2` | `/assets/cards/midnight-art-nouveau-v2-r2/` | Default on the Web table and bundled in the MCP App           |
| v1 (first edition)                 | `midnight-art-nouveau-v1` | `/assets/cards/midnight-art-nouveau-v1/`    | Web table only, through the edition switch or `/draw?deck=v1` |

`npm run verify:assets` runs both validators. `npm run verify:build` runs them
and then checks the packaged `dist`.

## v2 deck

Every card master, the style board and the card back were generated through the
OpenAI Images API with `gpt-image-2.5-sunburst` at 1024×1536. Cards and the back
are edits against the style board, so the deck shares one hand.

### Inputs

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

### Rebuild order

```bash
node scripts/art/generate-v2-deck.mjs --stage style
node scripts/art/generate-v2-deck.mjs --stage back
node scripts/art/generate-v2-deck.mjs --stage cards
node scripts/art/process-v2-deck.mjs
node scripts/art/validate-v2-deck.mjs
```

`--stage all` runs the three generation stages in order. The cards stage accepts
`--only id1,id2` to regenerate named cards, `--force` to replace existing
masters, `--quality xhigh|high` and `--concurrency <n>`. Generation costs API
credit and is not deterministic: a regenerated master is a new image.
`process-v2-deck.mjs` rebuilds the contact sheets from the processed files, so
review the changed card on them after processing and before publishing.

### Deterministic layers

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

### Outputs and gates

- Web: `assets/cards/v2/{cardId}.webp`, 640×960, at most 180,000 bytes.
- MCP: `assets/cards/v2/mcp/{cardId}.webp`, 192×288, at most 24,000 bytes. The
  deck gallery uses the same files as thumbnails.
- `assets/cards/v2/back.webp` and `mcp/back.webp`, `foil-mask.svg`, and
  `manifest.json` with every file's hash, size, dimensions and luminance.
- Six contact sheets and comparison sheets are written to `<master dir>/qa/` for
  review. They are not committed.
- `validate-v2-deck.mjs` checks all 78 ids against the manifest and provenance,
  hashes, dimensions, size limits, uniqueness, the exact symmetry of the decoded
  card back, and the bundled MCP artwork budget: at most 600,000 raw bytes and
  800,000 base64 bytes for the 78 faces plus the back.

### Changing a published image

Artwork URLs are served as `immutable`, so a browser never re-fetches one. A
change to any v2 image therefore ships under a new asset revision. Raise it in
every place that names it, then rebuild:

- `ASSET_REVISION` in `scripts/art/process-v2-deck.mjs`;
- `EXPECTED_ASSET_REVISION` in `scripts/art/validate-v2-deck.mjs`;
- `VISUAL_CARD_V2_ASSET_REVISION` in `src/tarot/shared/artwork.ts`;
- the asset base checked by `scripts/verify-build-assets.mjs`;
- the image URL expected by `src/__tests__/http-server.test.ts`;
- the URLs quoted in this file, `docs/api.md` and `SPEC.md`.

## v1 deck

This pipeline owns the original `midnight-art-nouveau-v1` deck. Every center-art
PNG and the card back were created through one independent OpenAI built-in
`image_gen` call. Do not overwrite its outputs: `/draw?deck=v1` serves them.

### Inputs

- `assets/artwork/style/dark-art-nouveau-style-board.png`
- `assets/artwork/source/{cardId}.png` for all 78 canonical card ids
- `assets/artwork/source/back.png`
- `src/tarot/cards/card-data.json` as the canonical id/rank registry

### Rebuild order

```bash
node scripts/art/generate-prompt-plan.mjs
node scripts/art/generate-provenance.mjs
node scripts/art/process-deck.mjs
node scripts/art/build-contact-sheets.mjs
node scripts/art/build-ocr-audit.mjs --mark-reviewed
node scripts/art/finalize-manual-review.mjs
node scripts/art/validate-deck.mjs
```

`sharp` performs every production resize, SVG composite, palette operation,
and WebP encode. Tesseract is optional and is used only to produce a heuristic
review report; decorative linework creates false positives, so OCR tokens never
replace contact-sheet review.

### Deterministic layers

Generated sources intentionally contain no title, rank, border, or suit pip.
`process-deck.mjs` adds:

- a common SVG frame;
- minor-arcana ranks `A`, `II`–`X`, `P`, `N`, `Q`, `K`;
- exactly 1–10 suit pips for numbered cards and one suit emblem for courts.

The card back is averaged with its 180-degree raw-pixel counterpart, resized,
quantized to a 128-colour palette, and encoded as lossless WebP. Both delivered
sizes remain pixel-exact when decoded and rotated.

### Outputs and gates

- Web: `assets/cards/{cardId}.webp`, 512×768, at most 180,000 bytes.
- MCP: `assets/cards/mcp/{cardId}.webp`, 192×288, at most 24,000 bytes.
- Versioned URLs are recorded in `assets/cards/manifest.json` under
  `/assets/cards/midnight-art-nouveau-v1/`.
- `validate-deck.mjs` checks all 78 ids, hashes, dimensions, uniqueness,
  prompt provenance, pip/rank metadata, exact card-back symmetry, QA hashes,
  and the 79-image inline MCP App artwork budget.
