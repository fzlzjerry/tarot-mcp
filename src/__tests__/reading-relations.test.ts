import { getCanonCard, inferPositionRole } from "../tarot/canon/index.js";
import { TarotCardManager } from "../tarot/cards/card-manager.js";
import {
  buildReadingRelations,
  deriveLinksFromRoles,
  elementalDignity,
} from "../tarot/readings/interpretation/relations.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { TAROT_SPREADS } from "../tarot/readings/spreads.js";
import { POSITION_ROLES, SPREAD_TYPES } from "../tarot/shared/types.js";
import type {
  CardOrientation,
  DrawnCard,
  PositionRole,
  TarotSpread,
} from "../tarot/shared/types.js";

describe("spread structure, relations, and reading guide", () => {
  let cardManager: TarotCardManager;

  beforeAll(async () => {
    cardManager = await TarotCardManager.create();
  });

  const card = (id: string) => cardManager.findCard(id)!;

  function manager(ids: string[], orientation: () => CardOrientation) {
    return new TarotReadingManager(cardManager, new TarotSessionManager(), {
      drawCards: () => ids.map(card),
      drawOrientation: orientation,
    });
  }

  /** A spread-sized hand that mixes arcana, suits, and ranks. */
  function mixedHand(count: number): string[] {
    const all = cardManager.getAllCards();
    return Array.from(
      { length: count },
      (_, index) => all[(index * 7) % 78].id,
    );
  }

  describe("built-in spread definitions", () => {
    it.each(SPREAD_TYPES.map((type) => [type] as const))(
      "%s gives every position a stable id and an explicit role, and links only its own positions",
      (type) => {
        const spread: TarotSpread = TAROT_SPREADS[type];
        const ids = spread.positions.map((position) => position.id);
        expect(spread.positions).toHaveLength(spread.cardCount);
        expect(new Set(ids).size).toBe(ids.length);
        for (const position of spread.positions) {
          expect(position.id).toMatch(/^[a-z0-9_]+$/);
          expect(POSITION_ROLES).toContain(position.role);
        }
        if (spread.cardCount > 1) {
          expect(spread.links?.length).toBeGreaterThan(0);
        }
        for (const link of spread.links ?? []) {
          expect(ids).toContain(link.from);
          expect(ids).toContain(link.to);
          expect(link.from).not.toBe(link.to);
        }
      },
    );
  });

  describe("canon role coverage", () => {
    it("has a bilingual entry for all 13 roles on every card and orientation", () => {
      const roles = POSITION_ROLES.filter((role) => role !== "general");
      expect(roles).toHaveLength(13);
      const missing: string[] = [];
      for (const { id } of cardManager.getAllCards()) {
        const canon = getCanonCard(id)!;
        for (const orientation of ["upright", "reversed"] as const) {
          for (const role of roles) {
            const entry = canon.meaningBranches[orientation].byRole?.[role];
            if (!entry?.en.trim() || !entry.zh.trim()) {
              missing.push(`${id}.${orientation}.${role}`);
            }
          }
        }
      }
      expect(missing).toEqual([]);
    });

    it("reads the same card differently in every role", () => {
      const canon = getCanonCard("three_of_cups")!;
      for (const orientation of ["upright", "reversed"] as const) {
        const texts = Object.values(
          canon.meaningBranches[orientation].byRole!,
        ).map((entry) => entry.en);
        expect(new Set(texts).size).toBe(texts.length);
      }
    });
  });

  describe("elemental dignity", () => {
    it("follows the classical table", () => {
      expect(elementalDignity("fire", "fire")).toBe("same");
      expect(elementalDignity("fire", "air")).toBe("friendly");
      expect(elementalDignity("earth", "water")).toBe("friendly");
      expect(elementalDignity("fire", "water")).toBe("opposing");
      expect(elementalDignity("earth", "air")).toBe("opposing");
      expect(elementalDignity("fire", "earth")).toBe("neutral");
      expect(elementalDignity("air", "water")).toBe("neutral");
    });
  });

  describe("structural relations", () => {
    it("reads the Celtic Cross challenge against the present and keeps the relation in the receipt", () => {
      const ids = [
        "star",
        "five_of_cups",
        "four_of_pentacles",
        "six_of_cups",
        "ace_of_wands",
        "two_of_swords",
        "hermit",
        "three_of_wands",
        "moon",
        "ten_of_pentacles",
      ];
      const sessions = new TarotSessionManager();
      const rm = new TarotReadingManager(cardManager, sessions, {
        drawCards: () => ids.map(card),
        drawOrientation: () => "upright",
      });
      const { reading } = rm.performReadingWithDetails(
        "celtic_cross",
        "Where is this heading?",
      );

      const crossing = reading.evidence.relations!.find(
        (relation) => relation.link === "crosses",
      )!;
      expect(crossing.kind).toBe("structural");
      expect(crossing.positions).toEqual([2, 1]);
      expect(crossing.cardIds).toEqual(["five_of_cups", "star"]);
      expect(crossing.elements).toEqual(["water", "air"]);
      expect(crossing.dignity).toBe("neutral");
      expect(crossing.fact).toContain(
        "Five of Cups (upright) crosses The Star (upright)",
      );

      const structural = reading.evidence.relations!.filter(
        (relation) => relation.kind === "structural",
      );
      expect(structural).toHaveLength(TAROT_SPREADS.celtic_cross.links.length);
      expect(reading.interpretation).toContain(
        "**Challenge/Cross → Present Situation:** Five of Cups (upright) crosses The Star (upright)",
      );

      const receipt = sessions.getReadingReceipt(reading.readingId)!.receipt;
      expect(receipt.evidence?.relations).toEqual(reading.evidence.relations);
    });

    it("explains each link kind and elemental dignity once per reading", () => {
      const { reading } = manager(
        [
          "sun",
          "ace_of_cups",
          "six_of_pentacles",
          "lovers",
          "world",
          "hermit",
          "eight_of_swords",
          "hierophant",
          "ten_of_cups",
          "tower",
        ],
        () => "upright",
      ).performReadingWithDetails("celtic_cross", "Should I move on?");
      const count = (text: string, phrase: string) =>
        text.split(phrase).length - 1;

      const opposing = reading.evidence.relations!.filter(
        ({ dignity }) => dignity === "opposing",
      );
      expect(opposing).toHaveLength(4);
      for (const relation of opposing) {
        expect(relation.note).toContain("contest or dampen each other");
      }
      expect(
        count(reading.interpretation, "contest or dampen each other"),
      ).toBe(1);
      expect(count(reading.interpretation, "(opposing elements)")).toBe(4);
      expect(count(reading.interpretation, "a pull in two directions")).toBe(1);
      expect(reading.interpretation).toContain(
        "**Hopes and Fears ↔ Final Outcome:** Ten of Cups (upright) pulls against The Tower (upright); water with fire (opposing elements).\n",
      );
    });

    it.each(SPREAD_TYPES.map((type) => [type] as const))(
      "%s never turns orientation into a verdict",
      (type) => {
        const ids = mixedHand(TAROT_SPREADS[type].cardCount);
        const read = (orientation: CardOrientation, language: "en" | "zh") =>
          manager(ids, () => orientation).performReadingWithDetails(
            type,
            language === "zh" ? "接下来会怎样？" : "What is unfolding?",
            undefined,
            { language },
          ).reading;
        for (const language of ["en", "zh"] as const) {
          const upright = read("upright", language);
          const reversed = read("reversed", language);
          const neutral = (text: string) =>
            text.replace(/upright|reversed|正位|逆位/g, "~");
          expect(upright.evidence.relations!.map(({ note }) => note)).toEqual(
            reversed.evidence.relations!.map(({ note }) => note),
          );
          expect(
            upright.evidence.relations!.map(({ fact }) => neutral(fact)),
          ).toEqual(
            reversed.evidence.relations!.map(({ fact }) => neutral(fact)),
          );
          // The cross-card section runs from its own heading line (bold,
          // colon inside) to the overall insights; per-card meanings above it
          // legitimately differ by orientation.
          const analysis = (text: string) =>
            text.slice(
              text.search(/^\*\*[^\n]*[:：]\*\*$/m),
              text.search(/\*\*(Overall Reading Insights|整体解读)/),
            );
          const section = analysis(upright.interpretation);
          expect(section.length > 0).toBe(TAROT_SPREADS[type].cardCount > 1);
          expect(neutral(section)).toBe(
            neutral(analysis(reversed.interpretation)),
          );
        }
      },
    );

    it("summarizes a long sequence in one line and reports thematic groups", () => {
      const { reading } = manager(
        mixedHand(13),
        () => "upright",
      ).performReadingWithDetails("year_ahead", "What does the year hold?");
      expect(
        reading.evidence.relations!.filter(({ link }) => link === "leads_to"),
      ).toHaveLength(11);
      expect(
        reading.interpretation.match(
          /\*\*Sequence \(January → December\):\*\*/g,
        ),
      ).toHaveLength(1);
      expect(reading.interpretation).not.toContain("**January → February:**");
      for (const quarter of ["First", "Second", "Third", "Fourth"]) {
        expect(reading.interpretation).toContain(`**${quarter} quarter:**`);
      }
    });

    it("reads each card against the element of its seat in elemental spreads", () => {
      const { reading } = manager(
        ["ace_of_wands", "two_of_wands", "ten_of_swords", "queen_of_cups"],
        () => "upright",
      ).performReadingWithDetails("elemental_balance", "How balanced am I?");
      expect(reading.interpretation).toContain(
        "Ace of Wands (upright) is a fire card in the fire position: the card is in its own element here",
      );
      expect(reading.interpretation).toContain(
        "Two of Wands (upright) is a fire card in the water position: an opposing element",
      );
      expect(reading.interpretation).toContain(
        "Ten of Swords (upright) is an air card in the air position",
      );
    });
  });

  describe("custom spreads", () => {
    const positions = (roles: PositionRole[]) =>
      roles.map((role, index) => ({ id: `p${index + 1}`, role }));

    it("derives links from position roles", () => {
      expect(
        deriveLinksFromRoles(
          positions(["present", "challenge", "resource", "hidden", "outcome"]),
        ),
      ).toEqual([
        { from: "p2", to: "p1", kind: "crosses" },
        { from: "p3", to: "p2", kind: "answers" },
        { from: "p4", to: "p1", kind: "underlies" },
        { from: "p1", to: "p5", kind: "leads_to" },
      ]);
      expect(deriveLinksFromRoles(positions(["self", "other"]))).toEqual([
        { from: "p1", to: "p2", kind: "mirrors" },
      ]);
      expect(
        deriveLinksFromRoles(positions(["general", "general", "message"])),
      ).toEqual([]);
    });

    it("infers roles for a custom spread and relates its cards", () => {
      const rm = manager(
        ["lovers", "two_of_cups", "five_of_swords"],
        () => "upright",
      );
      const { reading, text } = rm.performCustomReadingWithDetails(
        "Check-in",
        "Where the two of us stand",
        [
          { name: "You", meaning: "Where you stand" },
          { name: "Them", meaning: "Where they stand" },
          { name: "What blocks us", meaning: "The obstacle between us" },
        ],
        "How are we doing?",
      );
      expect(reading.cards.map(({ positionRole }) => positionRole)).toEqual([
        "self",
        "other",
        "challenge",
      ]);
      expect(reading.evidence.relations).toEqual([
        expect.objectContaining({
          kind: "structural",
          link: "mirrors",
          positions: [1, 2],
        }),
      ]);
      expect(text).toContain("**Contextual Spread Analysis:**");
      expect(text).toContain(
        "**You ↔ Them:** The Lovers (upright) mirrors Two of Cups (upright)",
      );
    });

    it("says so when the positions imply no pairing", () => {
      const rm = manager(["sun", "three_of_pentacles"], () => "upright");
      const { reading, text } = rm.performCustomReadingWithDetails(
        "Two Notes",
        "Two unrelated notes",
        [
          { name: "A", meaning: "First" },
          { name: "B", meaning: "Second" },
        ],
        "Anything to note?",
      );
      expect(reading.evidence.relations).toEqual([]);
      expect(text).toContain(
        "This spread moves from A (The Sun) to B (Three of Pentacles). Its positions imply no pairings",
      );
      expect(text).not.toContain("No dedicated spread template");
    });
  });

  describe("echo relations", () => {
    const drawn = (ids: string[]): DrawnCard[] =>
      ids.map((id) => ({ card: card(id), orientation: "upright" }));
    const echoes = (ids: string[]) =>
      buildReadingRelations(
        drawn(ids),
        ids.map((_, index) => ({
          id: `p${index + 1}`,
          role: "general" as const,
        })),
        [],
        "en",
      );

    it("finds classic archetype pairs", () => {
      expect(echoes(["devil", "two_of_wands", "lovers"])).toEqual([
        expect.objectContaining({
          kind: "archetype_pair",
          positions: [1, 3],
          cardIds: ["devil", "lovers"],
        }),
      ]);
    });

    it("links a Major to pips and Majors on its number", () => {
      const relations = echoes([
        "emperor",
        "four_of_cups",
        "death",
        "seven_of_swords",
      ]);
      expect(relations.map(({ kind, cardIds }) => [kind, ...cardIds])).toEqual([
        ["number_echo", "emperor", "four_of_cups"],
        ["number_echo", "emperor", "death"],
        ["number_echo", "death", "four_of_cups"],
      ]);
      expect(relations[1].fact).toContain("reduce to the same root number 4");
      expect(relations[2].fact).toContain("Death (13, reducing to 4");
    });

    it("never treats a court card or a Major as a pip rank", () => {
      // Justice is Major 11 and the Page is court rank 11: no shared pip number.
      expect(
        echoes(["justice", "page_of_wands", "high_priestess", "world"]),
      ).toEqual([
        expect.objectContaining({
          kind: "number_echo",
          cardIds: ["justice", "high_priestess"],
        }),
      ]);
    });

    it("reads consecutive pips of one suit in suit order, whichever comes first", () => {
      const [forward] = echoes(["three_of_cups", "four_of_cups"]);
      expect(forward).toMatchObject({ kind: "suit_run", positions: [1, 2] });
      expect(forward.note).toContain("follows the suit's own order");
      const [backward] = echoes(["four_of_cups", "three_of_cups"]);
      expect(backward).toMatchObject({ kind: "suit_run", positions: [2, 1] });
      expect(backward.note).toContain("runs against the suit's order");
    });

    it("caps echoes so large all-Major hands stay readable", () => {
      const majors = cardManager
        .getAllCards()
        .filter(({ arcana }) => arcana === "major")
        .map(({ id }) => id);
      expect(echoes(majors).length).toBe(6);
    });
  });

  describe("reading guide", () => {
    it("asks one role-conditioned question per position and travels in text and payload", () => {
      let draw = 0;
      const rm = manager(["tower", "nine_of_cups", "knight_of_swords"], () =>
        draw++ === 0 ? "reversed" : "upright",
      );
      const { reading, text } = rm.performReadingWithDetails(
        "three_card",
        "What should I do next?",
      );
      expect(reading.guide.version).toBe("guide-v1");
      expect(
        reading.guide.positionPrompts.map(({ positionIndex, positionRole }) => [
          positionIndex,
          positionRole,
        ]),
      ).toEqual([
        [1, "foundation"],
        [2, "present"],
        [3, "outcome"],
      ]);
      expect(reading.guide.positionPrompts[0].prompt).toContain(
        "The Tower (reversed)",
      );
      expect(reading.guide.steps.join(" ")).toContain("reversal lens");
      expect(reading.guide.steps.join(" ")).toContain("card-to-card relations");
      expect(reading.guide.guardrails.join(" ")).toContain(
        "never call upright good or reversed bad",
      );
      expect(text).toContain("## Reading Guide (for the assistant)");
      for (const { prompt } of reading.guide.positionPrompts) {
        expect(text).toContain(prompt);
      }
      // The guide is for the presenting assistant, not part of the reading itself.
      expect(reading.interpretation).not.toContain("Reading Guide");
    });

    it("leaves out steps that do not apply and localizes the rest", () => {
      const { reading, text } = manager(
        ["sun"],
        () => "upright",
      ).performReadingWithDetails(
        "single_card",
        "今天适合做什么？",
        undefined,
        { language: "zh" },
      );
      const steps = reading.guide.steps.join("");
      expect(steps).not.toContain("逆位");
      expect(steps).not.toContain("牌间关系");
      expect(steps).toMatch(/[\u4e00-\u9fff]/);
      expect(steps).not.toMatch(/[A-Za-z]{4,}/);
      expect(reading.guide.positionPrompts).toHaveLength(1);
      expect(reading.guide.positionPrompts[0].positionRole).toBe("message");
      expect(text).toContain("## 解读指引（供助手参考）");
    });
  });

  describe("role inference for custom positions", () => {
    it.each([
      ["You", "Where you stand", "self"],
      ["Them", "Where they stand", "other"],
      ["Your Partner", "", "other"],
      ["Hopes and Fears", "What you long for and dread", "hopes_fears"],
      ["External Influences", "", "external"],
      ["Hidden Influences", "", "hidden"],
      ["Strengths", "Your strengths and how to use them", "resource"],
      ["The Answer", "What the cards point to", "outcome"],
      [
        "Likely Outcome",
        "The probable outcome if you follow the advice given",
        "outcome",
      ],
      ["Card One", "What this card represents", "general"],
      ["Across the Table", "", "general"],
      ["你", "你目前的状态", "self"],
      ["对方", "", "other"],
      ["答案", "牌面给出的指引", "outcome"],
      ["希望与恐惧", "", "hopes_fears"],
      ["外部环境", "", "external"],
    ] as const)("reads %s (%s) as %s", (name, meaning, role) => {
      expect(inferPositionRole(name, meaning)).toBe(role);
    });
  });
});
