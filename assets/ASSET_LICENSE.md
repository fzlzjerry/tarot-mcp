# Midnight Art Nouveau Tarot Artwork

Copyright (c) 2026 Morax

The original visual assets in the following locations are distributed under
the same MIT License as this repository:

- `assets/cards/`
- `assets/artwork/`

To the extent that copyright or related rights subsist in these assets, the
copyright holder grants the permissions stated in the repository's root
`LICENSE` file. The copyright notice and permission notice must be retained in
copies or substantial portions of the asset collection.

## Provenance

The artwork was created specifically for this project from project-authored
prompts, then normalized and framed by the deterministic scripts in
`scripts/art/`. No card image, scan, colorization, font artwork, or
other visual asset was downloaded from the web or copied from a third-party
tarot deck.

The deck uses general tarot names and traditional symbolic vocabulary as
descriptive subject matter. Its compositions, palette, frame, card back, and
rendered scenes are original to this asset set.

### Second edition (`midnight-art-nouveau-v2`)

The files under `assets/cards/v2/` were generated through the OpenAI Images API
with the `gpt-image-2.5-sunburst` model by `scripts/art/generate-v2-deck.mjs`.
The style board came from one generation call; every card and the card back
came from an edit call that used that style board as its reference. Each prompt
is built from the card's `promptSpec` in `src/tarot/canon/data/`.

The prompt, model, quality, reference hash and SHA-256 of every 1024×1536 master
are recorded in `assets/artwork/v2/provenance.json`, and the hash of every
published card face and back in `assets/cards/v2/manifest.json`. The masters
themselves are not part of this repository. The prompts forbid borders, title
plaques, letters and numerals; the gilded frame, the rank in its cartouche and
the suit emblem in its crest are deterministic project artwork added during
post-processing. The card back is made exactly symmetric under a 180-degree
rotation and stored as lossless WebP.

### First edition (`midnight-art-nouveau-v1`)

The first edition is retired and is no longer part of this asset collection. It
was created for this project with OpenAI's built-in `image_gen` tool. Its
artwork, sources, prompts and pipeline remain in the repository history and are
complete at commit `37e8a22`.

## No warranty

The artwork is provided "AS IS", without warranty of any kind, express or
implied, including but not limited to merchantability, fitness for a
particular purpose, and noninfringement.
