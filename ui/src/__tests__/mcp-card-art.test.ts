import { getMcpCardArt } from "../mcp-card-art.js";
import cardData from "../../../src/tarot/cards/card-data.json";

describe("getMcpCardArt", () => {
  it("returns 78 unique faces and one unique back as inline WebP art", () => {
    const ids = [...cardData.cards.map((card) => card.id), "back"];
    const imageUris = ids.map((id) => getMcpCardArt(id));

    expect(ids).toHaveLength(79);
    for (const imageUri of imageUris) {
      expect(imageUri).toMatch(
        /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/,
      );
    }
    expect(new Set(imageUris).size).toBe(79);
    expect(getMcpCardArt("unknown_card")).toBeUndefined();
  });
});
