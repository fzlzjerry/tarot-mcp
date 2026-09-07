export function toggleSelection(
  selected: readonly string[],
  slotId: string,
  limit: number,
): string[] {
  const existing = selected.indexOf(slotId);
  if (existing >= 0) {
    return selected.filter((id) => id !== slotId);
  }
  if (selected.length >= limit) {
    return [...selected];
  }
  return [...selected, slotId];
}

export function nextGridIndex(
  current: number,
  key: string,
  total: number,
  columns: number,
): number {
  if (total <= 0) return 0;
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, current - 1);
    case "ArrowRight":
      return Math.min(total - 1, current + 1);
    case "ArrowUp":
      return Math.max(0, current - columns);
    case "ArrowDown":
      return Math.min(total - 1, current + columns);
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return current;
  }
}
