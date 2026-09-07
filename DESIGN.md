---
name: Tarot MCP Visual Reading
description: A cinematic midnight Art Nouveau tarot ritual shared by Web and MCP.
colors:
  midnight-indigo: "oklch(0.145 0.02 243)"
  table-indigo: "oklch(0.185 0.022 243)"
  raised-indigo: "oklch(0.225 0.02 245)"
  print-ivory: "oklch(0.945 0.01 85)"
  muted-ivory: "oklch(0.76 0.016 82)"
  antique-gold: "oklch(0.76 0.085 78)"
  antique-gold-line: "oklch(0.53 0.066 72)"
  lacquer-black: "oklch(0.118 0.017 244)"
  divider-indigo: "oklch(0.3 0.018 243)"
  omen-red: "oklch(0.72 0.13 25)"
  card-stock: "oklch(0.16 0.02 243)"
typography:
  display:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", serif'
    fontSize: "clamp(2rem, 4.4vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  body:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "0.8rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  card-sm: "6px"
  card-md: "8px"
  control: "10px"
  notice: "12px"
  panel: "14px"
  pill: "999px"
spacing:
  micro: "6px"
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.antique-gold}"
    textColor: "{colors.lacquer-black}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.print-ivory}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  input:
    backgroundColor: "{colors.raised-indigo}"
    textColor: "{colors.print-ivory}"
    rounded: "{rounded.control}"
    padding: "13px 14px"
  deck-card:
    backgroundColor: "{colors.lacquer-black}"
    textColor: "{colors.print-ivory}"
    rounded: "{rounded.card-sm}"
    width: "var(--arc-card-width)"
  reading-cloth:
    backgroundColor: "{colors.table-indigo}"
    textColor: "{colors.print-ivory}"
    rounded: "{rounded.panel}"
---

# Design System: Tarot MCP Visual Reading

## 1. Overview

**Creative North Star: "The Lamplit Oracle / 灯下神谕"**

The interface is a midnight reading table illuminated by one controlled source of antique-gold light. Its visual language comes from an aged Art Nouveau print: deep indigo stock, fine brass-like linework, ivory type, and illustrated cards treated as treasured physical artifacts. The atmosphere is cinematic, mystical, and deliberate, but every control remains legible and every transition explains a change in the reading.

The system rejects neon-cyber occult dashboards, casino wins, mobile-game loot openings, generic glassmorphism, cartoon magic, and confetti-like particle effects. Richness comes from composition, lamplight, card material, and precise choreography—not from a layer of unrelated decoration.

**Key Characteristics:**

- A single dark-indigo environment with antique gold reserved for action, focus, and revelation.
- Illustrated deck artwork is always the visual protagonist.
- Tonal surfaces stay flat at rest; physical lift appears only as interaction feedback.
- Serif display type establishes ritual; sans-serif UI type keeps the task clear.
- Responsive layouts preserve the same ritual across Web and compact MCP embeds.

## 2. Colors: The Antique Print Palette

A low-chroma midnight-indigo field lets restrained antique gold and print ivory read like ink and foil on an aged plate.

### Primary

- **Antique Gold** (`oklch(0.76 0.085 78)`): primary actions, selected state, focus, revealed orientation, and the strongest ritual light.
- **Antique Gold Line** (`oklch(0.53 0.066 72)`): card edges, ornamental rules, and secondary interactive outlines.

### Neutral

- **Midnight Indigo** (`oklch(0.145 0.02 243)`): the room and page ground.
- **Table Indigo** (`oklch(0.185 0.022 243)`): reading cloths and primary panels.
- **Raised Indigo** (`oklch(0.225 0.02 245)`): controls, notices, and modal surfaces.
- **Lacquer Black** (`oklch(0.118 0.017 244)`): card-back fallback and text placed on gold.
- **Divider Indigo** (`oklch(0.3 0.018 243)`): quiet borders and structural separators.
- **Print Ivory** (`oklch(0.945 0.01 85)`): primary text.
- **Muted Ivory** (`oklch(0.76 0.016 82)`): supporting copy and labels; use against the indigo family, never as gray over gold.
- **Card Stock** (`oklch(0.16 0.02 243)`): the dark frame beneath card-face artwork.
- **Omen Red** (`oklch(0.72 0.13 25)`): errors only.

### Named Rules

**The Lamplight Rule.** Antique Gold communicates intention or revelation. It does not decorate inactive interface regions.

**The One Room Rule.** New neutral surfaces stay within the midnight-indigo hue family; do not introduce generic charcoal, cream, or blue-gray panels.

## 3. Typography

**Display Font:** Iowan Old Style, with Palatino, Georgia, and CJK serif fallbacks  
**Body Font:** Platform sans-serif with CJK UI fallbacks

**Character:** The old-style serif gives headings the gravity of a printed divination text. The neutral sans keeps labels, controls, counts, instructions, and interpretation copy immediate in both English and Chinese.

### Hierarchy

- **Display** (500, `clamp(2rem, 4.4vw, 3.5rem)`, 1.04): one stage-defining `h1`; letter-spacing never tighter than `-0.02em`.
- **Headline** (500, `1.5rem–2.25rem`, 1.08): card details and reading interpretation headings.
- **Title** (500, `1.1rem`, natural line-height): cloth and deck section headings.
- **Body** (400, `1rem`, 1.65): instructions and interpretation; cap prose at 64–76ch and use balanced or pretty wrapping.
- **Label** (600–700, `0.72rem–0.9rem`, `0.02em` maximum): spread names, field labels, counters, and compact status. Do not transform every label to uppercase.

### Named Rules

**The Two Voices Rule.** Serif marks the reading's narrative hierarchy; sans-serif carries every action and piece of operating information.

## 4. Elevation

The system is tonal at rest and lifted by state. Page, table, and raised surfaces separate through progressively lighter indigo values and restrained 1px lines. Shadows belong to physical cards while they rest, rise, travel, or reveal, and to the modal because it is genuinely above the table. Static panels do not receive ambient drop shadows.

### Shadow Vocabulary

- **Card Rest** (`0 6px 12px rgb(0 0 0 / 52%)`): a card resting in the fan.
- **Card Placed** (`0 6px 14px rgb(0 0 0 / 50%)`): a selected card on the cloth.
- **Card Lift** (`0 14px 24px rgb(0 0 0 / 62%)`): hover, keyboard focus, or active physical lift only.
- **Card Reveal** (`0 8px 18px rgb(0 0 0 / 55%)`): a revealed card on the final spread.
- **Dialog** (`0 28px 70px rgb(0 0 0 / 68%)`): the only broad ambient shadow, reserved for the details layer.

### Named Rules

**The State-Lift Rule.** Tonal layering establishes structure; shadow is evidence that an object has changed elevation.

## 5. Components

Components feel restrained and legible around a highly crafted deck. Their shapes are consistent, their states are explicit, and their motion is tied to selection, placement, loading, or reveal.

### Buttons

- **Shape:** full pill (`999px`) with a minimum 44px touch height and `10px 20px` padding.
- **Primary:** Antique Gold fill and border with Lacquer Black text; used for the next decisive ritual action.
- **Hover / Focus / Active:** hover brightens the same gold and lifts 1px; focus uses a 3px Antique Gold outline with 3px offset; press feedback stays short and does not bounce.
- **Secondary:** transparent with a Divider Indigo border and Print Ivory text; hover changes the line and text to gold.
- **Disabled:** `0.42` opacity and `not-allowed`; the label remains readable.

### Chips

- **Style:** pills with Divider Indigo borders, transparent fill, Muted Ivory text, and `5px 10px` padding.
- **State:** used for keywords and compact values, not as decorative tags.

### Cards / Containers

- **Corner Style:** cards use 6–8px radii; notices use 12px; panels and cloths use 14px.
- **Background:** Table Indigo for primary surfaces, Raised Indigo for controls and elevated content, Lacquer Black or the real artwork for card backs.
- **Shadow Strategy:** no panel shadow at rest; follow the State-Lift rule for cards and overlays.
- **Border:** 1px Divider Indigo for structure, Antique Gold Line for cards, and full Antique Gold only for selection or focus.
- **Internal Padding:** panels range from 16px to 56px by density and viewport; compact controls stay on the 8/10/12/20px rhythm.

### Inputs / Fields

- **Style:** Raised Indigo fill, 1px Divider Indigo stroke, 10px radius, and `13px 14px` padding.
- **Focus:** the global 3px Antique Gold ring; do not replace it with a color-only border change.
- **Error / Disabled:** Omen Red is reserved for actionable error copy; disabled state must remain readable and unmistakable.

### Signature Component: The Reading Cloth

The cloth is a 14px-radius Table Indigo stage with one broad radial pool of gold lamplight from above. It contains percentage-positioned card slots so a selected card can travel continuously from the arc into its spread position. During the 420ms FLIP flight, one bounded gold thread and a converging lamplight echo make the spatial relationship legible, then disappear completely. The cloth never uses a decorative grid, paper noise, or glass blur.

### Signature Component: The Arc Fan

Seventy-eight opaque cards form a horizontally scrollable curve. A single 820ms lamplight sweep introduces the complete fan; it never loops. Proximity and keyboard focus lift nearby cards, while selection stamps one short gold seal, moves the chosen card to the next cloth position, and leaves a clear order marker. Transform is painted directly for smooth scrubbing, without transitioning layout properties or pre-promoting all 78 cards.

### Signature Component: The Ritual Pile

The ritual pile uses 22 real card-back layers to stage one 1500ms physical riffle: two half-thickness packets split and bend open, cards interleave bottom-up, then the meshed deck bridges and cascades square. The settled geometry is also the cut geometry, so dragging lifts a continuously thicker packet without a layout jump. Confirming the cut keeps every card visible while the deck sweeps into a short arc for a 620ms match cut into the 78-card fan. Reduced-motion users enter the same fully operable cut state immediately and bypass both shuffle and opening choreography.

## 6. Do's and Don'ts

### Do:

- **Do** use Midnight Indigo, Table Indigo, and Raised Indigo as the complete neutral depth system.
- **Do** reserve Antique Gold for actions, focus, selection, and reveal.
- **Do** let card artwork carry ornament; frame it with quiet geometry and precise lamplight.
- **Do** keep every draw action reversible until confirmation and communicate order without relying on color.
- **Do** build signature motion from legible physical beats—split, interleave, bridge, settle—then use bounded FLIP and lamplight effects with an immediate reduced-motion path.
- **Do** retain 44px minimum interactive targets, visible focus, keyboard control, screen-reader status, and WCAG 2.2 AA contrast.

### Don't:

- **Don't** resemble neon-cyber occult dashboards or add electric purple, cyan, or rainbow glow.
- **Don't** resemble casino wins, mobile-game loot openings, or use confetti-like particle effects.
- **Don't** use generic glassmorphism, cartoon magic, or ornamental blur as a default surface treatment.
- **Don't** let random motion, continuous particles, or slow spectacle delay the reader's next action.
- **Don't** compete with the illustrated deck by drawing replacement tarot art or sketchy SVG ornament.
- **Don't** pair static panel borders with broad decorative shadows; surfaces are tonal until state gives them lift.
- **Don't** use side-stripe accents, gradient text, decorative grid backgrounds, or repeating stripe textures.
- **Don't** exceed 14px card or panel radii; pills are reserved for controls, values, and keywords.

## 7. Entry page and style ownership

The entry page pairs an illustrated deck introduction with a focused reading
form. Language lives in the header. A native radio group chooses reading kind;
the spread selector previews the canonical localized description and positions.
The form remains one column and moves below the introduction on narrow screens.
Primary setup controls use a 7px radius; stage controls retain the pill treatment.
The deck preview is explicitly illustrative and is not the pending reading.

Styles are imported in cascade order by `ui/src/styles/index.css`. Setup,
controls, waiting, ritual, draw, reading and overlay styles have separate files;
shared responsive and reduced-motion rules come last. Card selection does not
permanently raise a chosen card over its neighbors, so adjacent cards stay
clickable. Keyboard focus still raises the focused card.
