import { TarotCardManager } from "../tarot/cards/card-manager.js";

describe("TarotCardManager", () => {
  let cardManager: TarotCardManager;

  beforeEach(async () => {
    cardManager = await TarotCardManager.create();
  });

  describe("getCardInfo", () => {
    it("should return card information for valid card name", () => {
      const result = cardManager.getCardInfo("The Fool", "upright");
      expect(result).toContain("The Fool (Upright)");
      expect(result).toContain("new beginnings");
      expect(result).toContain("Major Arcana");
    });

    it("should return card information for reversed orientation", () => {
      const result = cardManager.getCardInfo("The Fool", "reversed");
      expect(result).toContain("The Fool (Reversed)");
      expect(result).toContain("recklessness");
    });

    it("should return error message for invalid card name", () => {
      const result = cardManager.getCardInfo("Invalid Card", "upright");
      expect(result).toContain('Card "Invalid Card" not found');
    });

    it("should default to upright orientation", () => {
      const result = cardManager.getCardInfo("The Fool");
      expect(result).toContain("The Fool (Upright)");
    });

    it("accepts a Chinese card name for localized lookup", () => {
      const result = cardManager.getCardInfo("愚者", "upright", "zh");
      expect(result).toContain("# 愚者（The Fool）（正位）");
      expect(result).toContain("全新开始");
    });
  });

  describe("listAllCards", () => {
    it("should list all cards by default", () => {
      const result = cardManager.listAllCards();
      expect(result).toContain("Tarot Cards");
      expect(result).toContain("Major Arcana");
      expect(result).toContain("The Fool");
    });

    it("should filter by major arcana", () => {
      const result = cardManager.listAllCards("major_arcana");
      expect(result).toContain("Major Arcana");
      expect(result).toContain("The Fool");
      expect(result).toContain("The Magician");
    });

    it("should filter by minor arcana", () => {
      const result = cardManager.listAllCards("minor_arcana");
      expect(result).toContain("Wands");
      expect(result).toContain("Cups");
    });

    it("should filter by specific suit", () => {
      const result = cardManager.listAllCards("wands");
      expect(result).toContain("Wands");
      expect(result).toContain("Ace of Wands");
    });

    it("lists localized card names and keywords in Chinese", () => {
      const result = cardManager.listAllCards("major_arcana", "zh");
      expect(result).toContain("## 大阿卡纳（22 张）");
      expect(result).toContain("愚者（The Fool）");
      expect(result).toContain("全新开始");
    });
  });

  describe("findCard", () => {
    it("should find card by exact name", () => {
      const card = cardManager.findCard("The Fool");
      expect(card).toBeDefined();
      expect(card?.name).toBe("The Fool");
    });

    it("should find card case-insensitively", () => {
      const card = cardManager.findCard("the fool");
      expect(card).toBeDefined();
      expect(card?.name).toBe("The Fool");
    });

    it("should find card by partial name", () => {
      const card = cardManager.findCard("Fool");
      expect(card).toBeDefined();
      expect(card?.name).toBe("The Fool");
    });

    it("finds cards by exact and display-form Chinese names", () => {
      expect(cardManager.findCard("愚者")?.name).toBe("The Fool");
      expect(cardManager.findCard("愚者（The Fool）")?.name).toBe("The Fool");
    });

    it("should return undefined for non-existent card", () => {
      const card = cardManager.findCard("Non-existent Card");
      expect(card).toBeUndefined();
    });
  });

  describe("getRandomCards", () => {
    it("should return the requested number of cards", () => {
      const cards = cardManager.getRandomCards(3);
      expect(cards).toHaveLength(3);

      // Check that all cards are unique
      const cardIds = cards.map((card) => card.id);
      const uniqueIds = new Set(cardIds);
      expect(uniqueIds.size).toBe(3);
    });

    it("should throw error if requesting more cards than available", () => {
      const allCards = cardManager.getAllCards();
      expect(() => {
        cardManager.getRandomCards(allCards.length + 1);
      }).toThrow();
    });
  });

  describe("getAllCards", () => {
    it("should return all available cards", () => {
      const cards = cardManager.getAllCards();
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.some((card) => card.name === "The Fool")).toBe(true);
      expect(cards.some((card) => card.name === "The Magician")).toBe(true);
    });
  });
});
