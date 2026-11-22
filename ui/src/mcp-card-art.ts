const bundledCardArt = import.meta.glob<string>(
  "../../assets/cards/v2/mcp/*.webp",
  {
    eager: true,
    import: "default",
    query: "?inline",
  },
);

const cardArtById = new Map<string, string>(
  Object.entries(bundledCardArt).map(([path, imageUri]) => {
    const filename = path.slice(path.lastIndexOf("/") + 1);
    return [filename.replace(/\.webp$/, ""), imageUri];
  }),
);

/** Return the bundled v2 MCP-sized face or exact-symmetric back as an inline data URI. */
export function getMcpCardArt(cardId: string): string | undefined {
  return cardArtById.get(cardId);
}
