# Tarot artwork pipeline

This pipeline owns the original `midnight-art-nouveau-v1` deck. It does not
download or hotlink artwork. Every center-art PNG and the card back were
created through one independent OpenAI built-in `image_gen` call.

## Inputs

- `assets/artwork/style/dark-art-nouveau-style-board.png`
- `assets/artwork/source/{cardId}.png` for all 78 canonical card ids
- `assets/artwork/source/back.png`
- `src/tarot/cards/card-data.json` as the canonical id/rank registry

## Rebuild order

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

## Deterministic layers

Generated sources intentionally contain no title, rank, border, or suit pip.
`process-deck.mjs` adds:

- a common SVG frame;
- minor-arcana ranks `A`, `II`–`X`, `P`, `N`, `Q`, `K`;
- exactly 1–10 suit pips for numbered cards and one suit emblem for courts.

The card back is averaged with its 180-degree raw-pixel counterpart, resized,
quantized to a 128-colour palette, and encoded as lossless WebP. Both delivered
sizes remain pixel-exact when decoded and rotated.

## Outputs and gates

- Web: `assets/cards/{cardId}.webp`, 512×768, at most 180,000 bytes.
- MCP: `assets/cards/mcp/{cardId}.webp`, 192×288, at most 24,000 bytes.
- Versioned URLs are recorded in `assets/cards/manifest.json` under
  `/assets/cards/midnight-art-nouveau-v1/`.
- `validate-deck.mjs` checks all 78 ids, hashes, dimensions, uniqueness,
  prompt provenance, pip/rank metadata, exact card-back symmetry, QA hashes,
  and the 79-image inline MCP App artwork budget.
