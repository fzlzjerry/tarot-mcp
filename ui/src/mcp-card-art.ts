const bundledCardArt = import.meta.glob<string>(
  "../../assets/cards/mcp/*.webp",
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

/** Return the bundled MCP-sized face or symmetric back as an inline data URI. */
export function getMcpCardArt(cardId: string): string | undefined {
  return cardArtById.get(cardId);
}
