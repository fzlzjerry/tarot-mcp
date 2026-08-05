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

The artwork was created specifically for this project with OpenAI's built-in
`image_gen` tool from project-authored prompts, then normalized and framed by
the deterministic scripts in `scripts/art/`. No card image, scan, colorization,
font artwork, or other visual asset was downloaded from the web or copied from
a third-party tarot deck.

The deck uses general tarot names and traditional symbolic vocabulary as
descriptive subject matter. Its compositions, palette, frame, card back, and
rendered scenes are original to this asset set.

Exact prompts, hashes, and output paths are recorded in
`assets/artwork/prompt-provenance.json`. The generated center art contains no
intentional text, title, number, logo, signature, or watermark. Suit pips and
the common frame are deterministic project artwork produced during
post-processing. Minor-arcana rank labels (`A`, `II`–`X`, `P`, `N`, `Q`,
`K`) are also rendered deterministically and are not generated image text.
The published card back is built by averaging every raw pixel with its
180-degree counterpart, then using palette quantization and lossless WebP so
both delivered sizes remain exactly symmetric after decoding.

## No warranty

The artwork is provided "AS IS", without warranty of any kind, express or
implied, including but not limited to merchantability, fitness for a
particular purpose, and noninfringement.
