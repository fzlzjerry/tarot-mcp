import { nextGridIndex, toggleSelection } from "../selection.js";

describe("deck selection helpers", () => {
  it("preserves selection order, toggles cards, and enforces the limit", () => {
    let selected: string[] = [];
    selected = toggleSelection(selected, "a", 2);
    selected = toggleSelection(selected, "b", 2);
    expect(selected).toEqual(["a", "b"]);
    expect(toggleSelection(selected, "c", 2)).toEqual(["a", "b"]);
    expect(toggleSelection(selected, "a", 2)).toEqual(["b"]);
  });

  it("moves focus predictably across responsive grids", () => {
    expect(nextGridIndex(7, "ArrowRight", 78, 13)).toBe(8);
    expect(nextGridIndex(7, "ArrowDown", 78, 13)).toBe(20);
    expect(nextGridIndex(1, "ArrowUp", 78, 13)).toBe(0);
    expect(nextGridIndex(77, "ArrowRight", 78, 13)).toBe(77);
    expect(nextGridIndex(43, "Home", 78, 13)).toBe(0);
    expect(nextGridIndex(43, "End", 78, 13)).toBe(77);
  });
});
