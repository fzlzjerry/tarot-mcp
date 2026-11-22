const PALETTES = {
  major: {
    primary: "#dfb96f",
    secondary: "#f6ebd0",
    enamel: "#243b6b",
    enamelAccent: "#90b0eb",
    shadow: "#070b15",
  },
  cups: {
    primary: "#d8b46e",
    secondary: "#e8effa",
    enamel: "#1e4b7a",
    enamelAccent: "#77b5e5",
    shadow: "#070c17",
  },
  wands: {
    primary: "#e0b366",
    secondary: "#f8e8c8",
    enamel: "#7d351e",
    enamelAccent: "#e5894b",
    shadow: "#0b0912",
  },
  swords: {
    primary: "#d8be82",
    secondary: "#edf3fa",
    enamel: "#2c3d59",
    enamelAccent: "#a9c3dd",
    shadow: "#070b14",
  },
  pentacles: {
    primary: "#d9b76a",
    secondary: "#f3ebd4",
    enamel: "#1d4f3f",
    enamelAccent: "#72b89a",
    shadow: "#070d12",
  },
};

const ROMAN_MAJOR = [
  "0",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
];

const RANK_MINOR = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "P",
  12: "N",
  13: "Q",
  14: "K",
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function suitEmblem(suit, palette, strokeScale) {
  switch (suit) {
    case "cups":
      return `
        <path d="M-11,-10 H11 C11,1 6,8 0,9 C-6,8 -11,1 -11,-10 Z" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="${1.8 * strokeScale}"/>
        <path d="M-2,9 H2 V16 H8 V19 H-8 V16 H-2 Z" fill="${palette.primary}"/>
        <path d="M-7,-6 C-3,-4 3,-4 7,-6" fill="none" stroke="${palette.secondary}" stroke-width="${1.2 * strokeScale}"/>
      `;
    case "wands":
      return `
        <path d="M0,-18 C3.5,-12 3.5,12 0,18 C-3.5,12 -3.5,-12 0,-18 Z" fill="${palette.primary}"/>
        <path d="M0,-8 C9,-13 13,-7 5,-3 M0,4 C-9,0 -13,6 -5,9 M0,-14 C-6,-17 -9,-12 -4,-9" fill="none" stroke="${palette.enamelAccent}" stroke-width="${1.6 * strokeScale}" stroke-linecap="round"/>
      `;
    case "swords":
      return `
        <path d="M0,-19 L3.4,-11 L2.3,8 H-2.3 L-3.4,-11 Z" fill="${palette.secondary}" stroke="${palette.primary}" stroke-width="${0.9 * strokeScale}"/>
        <path d="M-11,8 H11 L8,11.5 H1.6 V18 H-1.6 V11.5 H-8 Z" fill="${palette.primary}"/>
        <circle cx="0" cy="18.5" r="2.2" fill="${palette.enamelAccent}"/>
      `;
    case "pentacles":
      return `
        <circle r="15" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="${2.2 * strokeScale}"/>
        <path d="M0,-11.5 L2.7,-3.7 L10.9,-3.5 L4.4,1.4 L6.7,9.3 L0,4.6 L-6.7,9.3 L-4.4,1.4 L-10.9,-3.5 L-2.7,-3.7 Z" fill="none" stroke="${palette.secondary}" stroke-width="${1.7 * strokeScale}" stroke-linejoin="round"/>
      `;
    default:
      return `
        <circle r="13" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="${1.8 * strokeScale}"/>
        <path d="M0,-11 L2.4,-2.4 L11,0 L2.4,2.4 L0,11 L-2.4,2.4 L-11,0 L-2.4,-2.4 Z" fill="${palette.secondary}"/>
        <circle r="2.5" fill="${palette.primary}"/>
      `;
  }
}

/**
 * Build a Luminous Midnight Art Nouveau arch frame SVG in a canonical 1024x1536
 * coordinate space (scaled smoothly to any target output width/height).
 *
 * Design principles:
 * - Zero heavy dark rectangles obscuring the illustration: only graceful outer
 *   cathedral arch spandrels + crisp perimeter hairline rules frame the scene.
 * - Suit-distinctive enamel palettes & bottom crest emblem.
 * - Dedicated bold-line mode (`variant: "mcp"`) so gold linework and rank glyph
 *   remain sharp and legible even down at 192x288 / 64x96 thumbnails.
 */
export function buildV2CardFrameSvg(card, width, height, variant = "web") {
  const paletteKey = card.arcana === "major" ? "major" : (card.suit ?? "major");
  const palette = PALETTES[paletteKey] ?? PALETTES.major;
  const isMcp = variant === "mcp";
  const strokeBoost = isMcp ? 1.85 : 1.0;

  const rankText =
    card.arcana === "major"
      ? (ROMAN_MAJOR[card.number] ?? String(card.number))
      : (RANK_MINOR[card.number] ?? String(card.number));

  const W = 1024;
  const H = 1536;
  const pad = isMcp ? 22 : 24;
  const innerPad = isMcp ? 42 : 40;
  const archTopY = 72;
  const archSpringY = 248;
  const bottomY = H - 68;
  const cornerCut = 88;

  // Inner luminous window path: Art Nouveau pointed/rounded ogee-inspired arch
  // at top, gently chamfered filigree corners at bottom — leaves ~87% of the
  // canvas completely open and bright.
  const archWindowPath = [
    `M ${innerPad},${archSpringY}`,
    `C ${innerPad},${124} ${238},${archTopY} ${W / 2},${archTopY}`,
    `C ${W - 238},${archTopY} ${W - innerPad},${124} ${W - innerPad},${archSpringY}`,
    `L ${W - innerPad},${bottomY - cornerCut}`,
    `Q ${W - innerPad},${bottomY} ${W - innerPad - cornerCut},${bottomY}`,
    `L ${innerPad + cornerCut},${bottomY}`,
    `Q ${innerPad},${bottomY} ${innerPad},${bottomY - cornerCut}`,
    "Z",
  ].join(" ");

  const outerFramePath = `M 0,0 H ${W} V ${H} H 0 Z`;

  // Delicate spandrel scrollwork (omitted or simplified in 192px MCP variant so
  // small thumbnails stay clean rather than noisy).
  const spandrelFiligree = isMcp
    ? `
      <path d="M 52,168 C 72,102 124,62 194,50" fill="none" stroke="${palette.primary}" stroke-width="${4.2}" stroke-linecap="round"/>
      <path d="M ${W - 52},168 C ${W - 72},102 ${W - 124},62 ${W - 194},50" fill="none" stroke="${palette.primary}" stroke-width="${4.2}" stroke-linecap="round"/>
      <circle cx="96" cy="96" r="14" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="3.6"/>
      <circle cx="${W - 96}" cy="96" r="14" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="3.6"/>
    `
    : `
      <!-- Upper-left Art Nouveau botanical spandrel -->
      <path d="M 48,204 C 54,126 108,68 198,52" fill="none" stroke="${palette.primary}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M 58,162 C 78,108 122,74 176,62" fill="none" stroke="${palette.secondary}" stroke-opacity="0.72" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M 66,118 C 94,116 116,94 118,66" fill="none" stroke="${palette.enamelAccent}" stroke-opacity="0.85" stroke-width="2.1"/>
      <circle cx="94" cy="94" r="17" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="2.4"/>
      <path d="M 94,81 L 97,91 L 107,94 L 97,97 L 94,107 L 91,97 L 81,94 L 91,91 Z" fill="${palette.secondary}"/>
      <circle cx="152" cy="70" r="5" fill="${palette.primary}"/>
      <circle cx="70" cy="152" r="5" fill="${palette.primary}"/>

      <!-- Upper-right mirrored botanical spandrel -->
      <path d="M ${W - 48},204 C ${W - 54},126 ${W - 108},68 ${W - 198},52" fill="none" stroke="${palette.primary}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M ${W - 58},162 C ${W - 78},108 ${W - 122},74 ${W - 176},62" fill="none" stroke="${palette.secondary}" stroke-opacity="0.72" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M ${W - 66},118 C ${W - 94},116 ${W - 116},94 ${W - 118},66" fill="none" stroke="${palette.enamelAccent}" stroke-opacity="0.85" stroke-width="2.1"/>
      <circle cx="${W - 94}" cy="94" r="17" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="2.4"/>
      <path d="M ${W - 94},81 L ${W - 91},91 L ${W - 81},94 L ${W - 91},97 L ${W - 94},107 L ${W - 97},97 L ${W - 107},94 L ${W - 97},91 Z" fill="${palette.secondary}"/>
      <circle cx="${W - 152}" cy="70" r="5" fill="${palette.primary}"/>
      <circle cx="${W - 70}" cy="152" r="5" fill="${palette.primary}"/>

      <!-- Lower corner acanthus brackets -->
      <path d="M 50,${H - 134} C 56,${H - 86} 88,${H - 56} 136,${H - 50}" fill="none" stroke="${palette.primary}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="78" cy="${H - 78}" r="9" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="2"/>
      <circle cx="78" cy="${H - 78}" r="3" fill="${palette.secondary}"/>

      <path d="M ${W - 50},${H - 134} C ${W - 56},${H - 86} ${W - 88},${H - 56} ${W - 136},${H - 50}" fill="none" stroke="${palette.primary}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="${W - 78}" cy="${H - 78}" r="9" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="2"/>
      <circle cx="${W - 78}" cy="${H - 78}" r="3" fill="${palette.secondary}"/>

      <!-- Subtle mid-height gilded column finials -->
      <path d="M 32,${H / 2 - 42} L 40,${H / 2} L 32,${H / 2 + 42} L 24,${H / 2} Z" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="1.8"/>
      <path d="M ${W - 32},${H / 2 - 42} L ${W - 24},${H / 2} L ${W - 32},${H / 2 + 42} L ${W - 40},${H / 2} Z" fill="${palette.enamel}" stroke="${palette.primary}" stroke-width="1.8"/>
    `;

  // Top crest medallion holding the crisp deterministic Roman/Court rank
  const badgeRx = isMcp ? 66 : 56;
  const badgeRy = isMcp ? 36 : 29;
  const badgeY = isMcp ? 68 : 68;
  const rankFontSize = isMcp ? 46 : 36;

  // Bottom medallion with subtle suit/arcana emblem
  const bottomEmblemScale = isMcp ? 1.48 : 1.28;
  const bottomBadgeY = H - 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="goldLeaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.secondary}"/>
      <stop offset="32%" stop-color="${palette.primary}"/>
      <stop offset="68%" stop-color="#b48942"/>
      <stop offset="100%" stop-color="${palette.secondary}"/>
    </linearGradient>
    <linearGradient id="spandrelShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.shadow}" stop-opacity="0.96"/>
      <stop offset="50%" stop-color="#0d1527" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${palette.shadow}" stop-opacity="0.96"/>
    </linearGradient>
  </defs>

  <!-- Sculpted midnight spandrel surround leaving the inner arch 100% clear -->
  <path d="${outerFramePath} ${archWindowPath}" fill="url(#spandrelShade)" fill-rule="evenodd"/>

  <!-- Outer metallic hairline border -->
  <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" rx="28" fill="none" stroke="url(#goldLeaf)" stroke-width="${3.6 * strokeBoost}"/>
  ${
    isMcp
      ? ""
      : `<rect x="${pad + 8}" y="${pad + 8}" width="${W - (pad + 8) * 2}" height="${H - (pad + 8) * 2}" rx="22" fill="none" stroke="${palette.secondary}" stroke-opacity="0.45" stroke-width="1.3"/>`
  }

  <!-- Inner gilded Art Nouveau arch border -->
  <path d="${archWindowPath}" fill="none" stroke="url(#goldLeaf)" stroke-width="${3.8 * strokeBoost}"/>
  ${
    isMcp
      ? ""
      : `<path d="${archWindowPath}" fill="none" stroke="${palette.secondary}" stroke-opacity="0.65" stroke-width="1.15" transform="translate(0 0)"/>`
  }

  ${spandrelFiligree}

  <!-- Top rank cartouche -->
  <g transform="translate(${W / 2} ${badgeY})">
    <path d="M ${-badgeRx - 22},0 Q ${-badgeRx - 6},-16 ${-badgeRx + 8},-22 M ${badgeRx + 22},0 Q ${badgeRx + 6},-16 ${badgeRx - 8},-22" fill="none" stroke="${palette.primary}" stroke-width="${2.2 * strokeBoost}" stroke-linecap="round"/>
    <ellipse cx="0" cy="0" rx="${badgeRx}" ry="${badgeRy}" fill="${palette.shadow}" stroke="url(#goldLeaf)" stroke-width="${3.0 * strokeBoost}"/>
    <ellipse cx="0" cy="0" rx="${badgeRx - 6}" ry="${badgeRy - 5}" fill="${palette.enamel}" fill-opacity="0.72" stroke="${palette.secondary}" stroke-opacity="0.55" stroke-width="${1.1 * strokeBoost}"/>
    <text x="0" y="${isMcp ? 16 : 12.5}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${rankFontSize}" letter-spacing="1.5" fill="${palette.secondary}">${escapeXml(rankText)}</text>
  </g>

  <!-- Bottom suit/arcana crest medallion -->
  <g transform="translate(${W / 2} ${bottomBadgeY})">
    <ellipse cx="0" cy="0" rx="${isMcp ? 48 : 42}" ry="${isMcp ? 32 : 28}" fill="${palette.shadow}" stroke="url(#goldLeaf)" stroke-width="${2.6 * strokeBoost}"/>
    <g transform="scale(${bottomEmblemScale})">
      ${suitEmblem(card.arcana === "major" ? "major" : card.suit, palette, isMcp ? 1.25 : 1.0)}
    </g>
  </g>

  <title>${escapeXml(card.name)}</title>
</svg>`;
}

/**
 * Perfectly 180-degree rotationally symmetric perimeter hairline frame for the
 * v2 card back (every geometric element has an exact 180-degree counterpart).
 */
export function buildV2BackFrameSvg(width, height, variant = "web") {
  const isMcp = variant === "mcp";
  const strokeBoost = isMcp ? 1.7 : 1.0;
  const W = 1024;
  const H = 1536;
  const pad = 24;
  const inner = 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}">
  <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" rx="28" fill="none" stroke="#dfb96f" stroke-width="${3.6 * strokeBoost}"/>
  <rect x="${inner}" y="${inner}" width="${W - inner * 2}" height="${H - inner * 2}" rx="20" fill="none" stroke="#f5e9cc" stroke-opacity="0.72" stroke-width="${1.6 * strokeBoost}"/>
  <circle cx="64" cy="64" r="9" fill="#070b15" stroke="#dfb96f" stroke-width="${2.2 * strokeBoost}"/>
  <circle cx="${W - 64}" cy="64" r="9" fill="#070b15" stroke="#dfb96f" stroke-width="${2.2 * strokeBoost}"/>
  <circle cx="64" cy="${H - 64}" r="9" fill="#070b15" stroke="#dfb96f" stroke-width="${2.2 * strokeBoost}"/>
  <circle cx="${W - 64}" cy="${H - 64}" r="9" fill="#070b15" stroke="#dfb96f" stroke-width="${2.2 * strokeBoost}"/>
</svg>`;
}

/**
 * Shared vector foil mask matching the v2 arch frame geometry, used by the
 * WebApp to sweep warm specular gold gleam strictly across the gilded arch
 * borders during card focus/reveal without washing out the central artwork.
 */
export function buildV2FoilMaskSvg() {
  const W = 1024;
  const H = 1536;
  const pad = 24;
  const innerPad = 40;
  const archTopY = 72;
  const archSpringY = 248;
  const bottomY = H - 68;
  const cornerCut = 88;
  const archWindowPath = [
    `M ${innerPad},${archSpringY}`,
    `C ${innerPad},124 238,${archTopY} ${W / 2},${archTopY}`,
    `C ${W - 238},${archTopY} ${W - innerPad},124 ${W - innerPad},${archSpringY}`,
    `L ${W - innerPad},${bottomY - cornerCut}`,
    `Q ${W - innerPad},${bottomY} ${W - innerPad - cornerCut},${bottomY}`,
    `L ${innerPad + cornerCut},${bottomY}`,
    `Q ${innerPad},${bottomY} ${innerPad},${bottomY - cornerCut}`,
    "Z",
  ].join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" rx="28" fill="none" stroke="#ffffff" stroke-width="10"/>
  <path d="${archWindowPath}" fill="none" stroke="#ffffff" stroke-width="10"/>
  <ellipse cx="${W / 2}" cy="68" rx="56" ry="29" fill="none" stroke="#ffffff" stroke-width="8"/>
  <ellipse cx="${W / 2}" cy="${H - 64}" rx="42" ry="28" fill="none" stroke="#ffffff" stroke-width="8"/>
  <circle cx="94" cy="94" r="18" fill="none" stroke="#ffffff" stroke-width="6"/>
  <circle cx="${W - 94}" cy="94" r="18" fill="none" stroke="#ffffff" stroke-width="6"/>
</svg>`;
}
