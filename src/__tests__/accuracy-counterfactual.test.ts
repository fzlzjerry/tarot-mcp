import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { classifyQuestionDomain } from "../tarot/readings/interpretation/evidence.js";
import { recommendSpreads } from "../tarot/readings/spread-recommender.js";
import { createMcpProtocolServer } from "../mcp/protocol-server.js";
import { TOOL_NAMES } from "../mcp/public-api.js";
import { TarotServer } from "../mcp/tarot-service.js";
import type { TarotSpread } from "../tarot/shared/types.js";

describe("MCP accuracy counterfactuals and invariants", () => {
  let cardManager: TarotCardManager;

  beforeAll(async () => {
    cardManager = await TarotCardManager.create();
  });

  describe("language-invariant & word-boundary domain classification", () => {
    it("routes neutral EN and ZH questions to general, never health via single_card 'energy'", () => {
      expect(classifyQuestionDomain("What should I focus on today?")).toBe(
        "general",
      );
      expect(classifyQuestionDomain("今天我应该关注什么？")).toBe("general");

      const sessionManager = new TarotSessionManager();
      const fool = cardManager.findCard("fool")!;
      const rm = new TarotReadingManager(cardManager, sessionManager, {
        drawCards: () => [fool],
        drawOrientation: () => "upright",
      });

      const en = rm.performReadingWithDetails(
        "single_card",
        "What should I focus on today?",
        undefined,
        { language: "en" },
      );
      const zh = rm.performReadingWithDetails(
        "single_card",
        "今天我应该关注什么？",
        undefined,
        { language: "zh" },
      );

      expect(en.reading.evidence.questionDomain).toBe("general");
      expect(zh.reading.evidence.questionDomain).toBe("general");
      expect(en.reading.cards[0].meaning).not.toMatch(/diagnosis|wellbeing/i);
      expect(zh.reading.cards[0].meaning).not.toMatch(/医学诊断|身心状态/);
    });

    it("does not trigger health from substring 'rest' inside 'interest'", () => {
      expect(
        classifyQuestionDomain("How should I explore a new interest this year?"),
      ).toBe("general");
      expect(classifyQuestionDomain("Are interest rates rising?")).toBe(
        "general",
      );
    });

    it("routes workplace relationship queries to career rather than love", () => {
      expect(classifyQuestionDomain("如何改善与同事的关系？")).toBe("career");
      expect(
        classifyQuestionDomain("How can I improve my relationship with my manager?"),
      ).toBe("career");
      expect(classifyQuestionDomain("我的恋爱关系会怎样？")).toBe("love");
    });
  });

  describe("orientation is never hardcoded as positive/favorable valence", () => {
    it("does not describe upright Tower + Ten of Swords + Devil as a positive trajectory", () => {
      const tower = cardManager.findCard("tower")!;
      const tenSwords = cardManager.findCard("ten_of_swords")!;
      const devil = cardManager.findCard("devil")!;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [tower, tenSwords, devil],
        drawOrientation: () => "upright",
      });

      const en = rm.performReadingWithDetails(
        "three_card",
        "What is happening with my project?",
        undefined,
        { language: "en" },
      );
      const zh = rm.performReadingWithDetails(
        "three_card",
        "我的项目接下来会怎样？",
        undefined,
        { language: "zh" },
      );

      expect(en.reading.interpretation).not.toMatch(
        /consistently positive trajectory|favorable circumstances|positive energy/i,
      );
      expect(zh.reading.interpretation).not.toMatch(
        /持续向好的走势|有利的形势|积极的能量/,
      );
    });

    it("treats reversed Five of Pentacles as recovery/relief rather than automatic doom", () => {
      const fivePentacles = cardManager.findCard("five_of_pentacles")!;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [fivePentacles],
        drawOrientation: () => "reversed",
      });

      const en = rm.performReadingWithDetails(
        "single_card",
        "How will my finances evolve?",
        undefined,
        { language: "en" },
      );
      const zh = rm.performReadingWithDetails(
        "single_card",
        "我的财务状况会怎么演变？",
        undefined,
        { language: "zh" },
      );

      expect(en.reading.cards[0].meaning).toMatch(/recovery|ease|easing|aid|support/i);
      expect(zh.reading.cards[0].meaning).toMatch(/松动|回暖|走出|支持/);
    });
  });

  describe("position-role sensitivity on Canon cards", () => {
    it("changes guidance for upright Three of Cups between resource and challenge positions", () => {
      const threeCups = cardManager.findCard("three_of_cups")!;
      const fool = cardManager.findCard("fool")!;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager());

      const spread: TarotSpread = {
        name: "Resource vs Challenge",
        description: "Compare resource and challenge roles",
        cardCount: 2,
        positions: [
          {
            id: "resource",
            name: "Core Resource",
            meaning: "What supports you",
            role: "resource",
          },
          {
            id: "challenge",
            name: "Main Challenge",
            meaning: "What creates friction",
            role: "challenge",
          },
        ],
      };

      const asResource = rm.performPreparedReadingWithDetails(
        spread,
        "custom_resource_challenge",
        "How should I approach this team project?",
        [
          { card: threeCups, orientation: "upright" },
          { card: fool, orientation: "upright" },
        ],
        undefined,
        { language: "zh" },
      );

      const asChallenge = rm.performPreparedReadingWithDetails(
        spread,
        "custom_resource_challenge",
        "How should I approach this team project?",
        [
          { card: fool, orientation: "upright" },
          { card: threeCups, orientation: "upright" },
        ],
        undefined,
        { language: "zh" },
      );

      const resourceMeaning = asResource.reading.cards[0].meaning;
      const challengeMeaning = asChallenge.reading.cards[1].meaning;
      expect(resourceMeaning).not.toBe(challengeMeaning);
      expect(resourceMeaning).toMatch(/资源|圈子|伙伴|支持/);
      expect(challengeMeaning).toMatch(/阻碍|融入|压低|真实/);
    });
  });

  describe("numerical & court-card isolation", () => {
    it("never misclassifies The World (21) as court cards or collides Justice (11) with Page (11)", () => {
      const world = cardManager.findCard("world")!;
      const justice = cardManager.findCard("justice")!;
      const pageWands = cardManager.findCard("page_of_wands")!;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [world, justice, pageWands],
        drawOrientation: () => "upright",
      });

      const res = rm.performReadingWithDetails(
        "three_card",
        "What pattern am I moving through?",
      );

      // Only 1 court card (Page of Wands), NOT 2 or 3
      const courtSignal = res.reading.evidence.signals.find(
        (s) => s.kind === "court_presence",
      );
      expect(courtSignal?.positions).toEqual([3]);

      // No repeated pip signal (Justice is Major 11, Page is Court 11 — neither is a 1-10 pip!)
      const pipSignal = res.reading.evidence.signals.find(
        (s) => s.kind === "pip_numerology",
      );
      expect(pipSignal).toBeUndefined();
      expect(res.reading.interpretation).not.toMatch(/repetition of 11|Repeated pip rank 11/i);
    });
  });

  describe("spread recommendation precision", () => {
    it("does not trigger 'now' from 'know' and respects explicit category over generic '关系'", () => {
      const knowRecs = recommendSpreads("I don't know what to expect");
      expect(knowRecs.map((r) => r.spread)).not.toContain("daily_guidance");

      const colleagueRecs = recommendSpreads("如何改善与同事的关系？", "any", "career");
      expect(colleagueRecs[0].spread).toBe("career_path");
      expect(colleagueRecs.map((r) => r.spread)).not.toContain("venus_love");
    });
  });

  describe("card lookup disambiguation", () => {
    it("returns candidate list instead of silently picking one card for ambiguous '王后' or 'Queen'", async () => {
      const tarotServer = await TarotServer.create();

      const zhRes = await tarotServer.executeTool(TOOL_NAMES.getCardInfo, {
        cardName: "王后",
        language: "zh",
      });
      expect(zhRes.ok).toBe(false);
      if (!zhRes.ok) {
        expect(zhRes.code).toBe("AMBIGUOUS_CARD_NAME");
        expect(zhRes.error).toContain("queen_of_swords");
        expect(zhRes.error).toContain("queen_of_cups");
      }

      const enRes = await tarotServer.executeTool(TOOL_NAMES.getCardInfo, {
        cardName: "Queen",
        language: "en",
      });
      expect(enRes.ok).toBe(false);
      if (!enRes.ok) {
        expect(enRes.code).toBe("AMBIGUOUS_CARD_NAME");
        expect(enRes.error).toContain("Queen of Swords");
        expect(enRes.error).toContain("Queen of Pentacles");
      }
    });
  });

  describe("immutable reading receipt & non-mutating session reads", () => {
    it("does not rewrite persistence file when reading a session", () => {
      const dir = mkdtempSync(join(tmpdir(), "tarot-receipt-"));
      try {
        const storePath = join(dir, "sessions.json");
        const sm = new TarotSessionManager(storePath);
        const session = sm.createSession();
        const mtimeBefore = statSync(storePath).mtimeMs;

        // Reading the session repeatedly should not touch the file on disk
        const loaded = sm.getSession(session.id);
        expect(loaded?.id).toBe(session.id);
        const mtimeAfter = statSync(storePath).mtimeMs;
        expect(mtimeAfter).toBe(mtimeBefore);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("exposes tarot://readings/{readingId} receipt with cardIds and versions, plus MCP server instructions", async () => {
      const tarotServer = await TarotServer.create();
      const protocolServer = createMcpProtocolServer(tarotServer);
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "counterfactual-test", version: "1.0.0" });
      await Promise.all([
        protocolServer.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      expect(client.getInstructions()).toContain("begin_visual_reading");
      expect(client.getInstructions()).toContain("tarot://readings/{readingId}");

      const performed = await client.callTool({
        name: TOOL_NAMES.performReading,
        arguments: {
          spreadType: "three_card",
          question: "如何推进这个设计项目？",
          language: "zh",
        },
      });
      const sc = performed.structuredContent as {
        readingId: string;
        deckVersion: string;
        knowledgeVersion: string;
        cards: Array<{ cardId: string; positionRole: string }>;
      };
      expect(sc.readingId).toMatch(/^reading_/);
      expect(sc.deckVersion).toBeTruthy();
      expect(sc.knowledgeVersion).toContain("canon-v2");
      expect(sc.cards).toHaveLength(3);

      const resource = await client.readResource({
        uri: `tarot://readings/${sc.readingId}`,
      });
      const receipt = JSON.parse(
        (resource.contents[0] as { text: string }).text,
      ) as {
        readingId: string;
        deckVersion: string;
        knowledgeVersion: string;
        cards: Array<{ cardId: string; positionRole: string }>;
      };
      expect(receipt.readingId).toBe(sc.readingId);
      expect(receipt.deckVersion).toBe(sc.deckVersion);
      expect(receipt.knowledgeVersion).toBe(sc.knowledgeVersion);
      expect(receipt.cards.map((c) => c.cardId)).toEqual(
        sc.cards.map((c) => c.cardId),
      );
    });
  });
});
