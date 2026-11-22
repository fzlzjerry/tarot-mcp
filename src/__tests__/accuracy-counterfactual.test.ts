import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { getCanonCard, getCanonMotifs, inferPositionRole } from "../tarot/canon/index.js";
import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { classifyQuestionDomain } from "../tarot/readings/interpretation/evidence.js";
import { recommendSpreads } from "../tarot/readings/spread-recommender.js";
import { TAROT_SPREADS } from "../tarot/readings/spreads.js";
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

    it("preserves identical positionIds and positionRoles across EN and ZH spreads", () => {
      const fool = cardManager.findCard("fool")!;
      const cups3 = cardManager.findCard("three_of_cups")!;
      const wands10 = cardManager.findCard("ten_of_wands")!;

      const rmSingle = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [fool],
        drawOrientation: () => "upright",
      });
      const singleEn = rmSingle.performReadingWithDetails("single_card", "Today?", undefined, { language: "en" });
      const singleZh = rmSingle.performReadingWithDetails("single_card", "今天？", undefined, { language: "zh" });
      expect(singleZh.reading.cards[0].positionId).toBe(singleEn.reading.cards[0].positionId);
      expect(singleZh.reading.cards[0].positionRole).toBe(singleEn.reading.cards[0].positionRole);
      expect(singleZh.reading.cards[0].positionRole).toBe("message");

      const rmThree = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [fool, cups3, wands10],
        drawOrientation: () => "upright",
      });
      const threeEn = rmThree.performReadingWithDetails("three_card", "Next steps?", undefined, { language: "en" });
      const threeZh = rmThree.performReadingWithDetails("three_card", "下一步？", undefined, { language: "zh" });
      expect(threeZh.reading.cards.map((c) => c.positionId)).toEqual(
        threeEn.reading.cards.map((c) => c.positionId),
      );
      expect(threeZh.reading.cards.map((c) => c.positionRole)).toEqual(
        threeEn.reading.cards.map((c) => c.positionRole),
      );
      expect(threeZh.reading.cards[1].positionRole).toBe("present");
    });

    it("attaches v2 editionMotifs on default v2 receipts while omitting them when explicitly queried for v1", () => {
      const queenSwords = cardManager.findCard("queen_of_swords")!;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [queenSwords],
        drawOrientation: () => "upright",
      });
      const res = rm.performReadingWithDetails("single_card", "How should I decide?");
      expect(res.reading.deckVersion).toBe("midnight-art-nouveau-v2");
      expect(res.reading.knowledgeVersion).toBe("canon-v2.1");
      expect(res.reading.cards[0].traditionMotifs?.length).toBeGreaterThan(0);
      expect(res.reading.cards[0].editionMotifs?.length).toBeGreaterThan(0);
      expect(res.reading.evidence.cards[0].editionMotifs.length).toBeGreaterThan(0);

      // Explicitly requesting v1 deck edition still isolates v2 editionMotifs
      const v1Motifs = getCanonMotifs("queen_of_swords", "en", "midnight-art-nouveau-v1");
      expect(v1Motifs?.tradition.length).toBeGreaterThan(0);
      expect(v1Motifs?.edition).toEqual([]);
    });

    it("covers all 78 canonical cards in Card Canon with bilingual motifs, role branches, reversal lenses, and zero legacy boilerplate", () => {
      const allCards = cardManager.getAllCards();
      expect(allCards).toHaveLength(78);
      for (const card of allCards) {
        const canon = getCanonCard(card.id);
        expect(canon, `Missing canon for ${card.id}`).toBeDefined();
        expect(canon!.archetypeEssence.en.trim().length).toBeGreaterThan(10);
        expect(canon!.archetypeEssence.zh.trim().length).toBeGreaterThan(4);
        expect(canon!.traditionMotifs.en.length).toBeGreaterThanOrEqual(3);
        expect(canon!.traditionMotifs.zh.length).toBeGreaterThanOrEqual(3);
        expect(canon!.editionMotifs.en.length).toBeGreaterThanOrEqual(3);
        expect(canon!.editionMotifs.zh.length).toBeGreaterThanOrEqual(3);
        expect(canon!.promptSpec?.scene.trim().length).toBeGreaterThan(40);
        expect(canon!.promptSpec?.requiredObjects.length).toBeGreaterThanOrEqual(1);
        expect(card.meanings.upright.general).not.toContain(
          "constructive expression of the archetype's growth lesson",
        );
        expect(card.zh?.meanings.upright.general).not.toContain("建设性表达");
      }
    });

    it("flushes read-renewed session activity during periodic cleanup without writing on every read", async () => {
      const dir = mkdtempSync(join(tmpdir(), "tarot-retention-"));
      try {
        const storePath = join(dir, "sessions.json");
        const sm = new TarotSessionManager(storePath);
        const rm = new TarotReadingManager(cardManager, sm);
        const res = rm.performReadingWithDetails("single_card", "Track retention");
        const sessionId = res.reading.sessionId!;
        const readingId = res.reading.readingId;

        const mtimeAfterCreate = statSync(storePath).mtimeMs;
        await new Promise((r) => setTimeout(r, 25));

        // Follow-up receipt read renews activity in memory without immediate disk write
        expect(sm.getReadingReceipt(readingId)?.sessionId).toBe(sessionId);
        expect(statSync(storePath).mtimeMs).toBe(mtimeAfterCreate);

        // Periodic cleanup flushes dirty renewed timestamp even with zero evictions
        sm.cleanupOldSessions();
        expect(statSync(storePath).mtimeMs).toBeGreaterThan(mtimeAfterCreate);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("reports accurate 7-card count in venus_love recommendations", () => {
      const loveRecs = recommendSpreads("What is happening in my love life?");
      const venus = loveRecs.find((r) => r.spread === "venus_love");
      expect(venus).toBeDefined();
      expect(venus!.reason).toContain("7-card");
      expect(venus!.reasonZh).toContain("7 张牌");
    });

    it("keeps workplace idioms like 'love my job' and 'business partner' in career rather than love", () => {
      expect(
        classifyQuestionDomain("How can I resolve a disagreement with my business partner?"),
      ).toBe("career");
      expect(
        classifyQuestionDomain("I love my job. How can I improve my relationship with my manager?"),
      ).toBe("career");
      expect(
        classifyQuestionDomain("My romantic partner and I work at the same company."),
      ).toBe("love");

      const jobLoveRecs = recommendSpreads(
        "I love my job. How can I improve my relationship with my manager?",
      );
      expect(jobLoveRecs[0]?.spread).toBe("career_path");
      expect(jobLoveRecs.some((r) => r.spread === "venus_love")).toBe(false);

      const datingCoworkerRecs = recommendSpreads("I am dating a coworker.");
      expect(datingCoworkerRecs[0]?.spread).toBe("venus_love");

      // Genuine romantic questions mentioning work still keep love recommendations
      expect(
        classifyQuestionDomain("I love my partner, but work keeps us apart"),
      ).toBe("love");
      const partnerWorkRecs = recommendSpreads(
        "I love my partner, but work keeps us apart",
      );
      expect(partnerWorkRecs[0]?.spread).toBe("venus_love");

      const businessPartnerRecs = recommendSpreads(
        "How can I resolve a disagreement with my business partner?",
      );
      expect(businessPartnerRecs[0]?.spread).toBe("career_path");
      expect(businessPartnerRecs.some((r) => r.spread === "venus_love")).toBe(false);

      // Former workplace roles ("ex-manager", "ex coworker") stay in career,
      // while genuine ex / ex-partner questions still route to love
      expect(
        classifyQuestionDomain("How can I improve my relationship with my ex-manager?"),
      ).toBe("career");
      const exManagerRecs = recommendSpreads(
        "How can I improve my relationship with my ex-manager?",
      );
      expect(exManagerRecs[0]?.spread).toBe("career_path");
      expect(exManagerRecs.some((r) => r.spread === "venus_love")).toBe(false);

      expect(
        classifyQuestionDomain("I'd love to get a promotion at work this year"),
      ).toBe("career");
      expect(classifyQuestionDomain("Will my ex-partner and I reconcile?")).toBe("love");
      expect(recommendSpreads("Will my ex-partner and I reconcile?")[0]?.spread).toBe(
        "venus_love",
      );
      expect(classifyQuestionDomain("Will my ex-fiancé come back?")).toBe("love");
      expect(classifyQuestionDomain("Will my ex-fiancee come back?")).toBe("love");
      expect(recommendSpreads("Will my ex-fiancé come back?")[0]?.spread).toBe(
        "venus_love",
      );
      expect(classifyQuestionDomain("Why did my ex reach out today?")).toBe("love");
    });

    it("tags Celtic Cross Near Future as outcome and prioritizes position names in inferPositionRole", () => {
      const nearFuture = TAROT_SPREADS.celtic_cross.positions.find(
        (p) => p.id === "near_future",
      );
      expect(nearFuture?.role).toBe("outcome");

      // Horseshoe "Likely Outcome" mentions "advice" in its description; name wins
      expect(
        inferPositionRole(
          "Likely Outcome",
          "The probable outcome if you follow the advice given",
        ),
      ).toBe("outcome");
      expect(
        inferPositionRole("Advice", "Guidance on the best course of action to take"),
      ).toBe("advice");
    });

    it("localizes suit names in Chinese evidence and returns independent motif array copies", () => {
      const cups3 = cardManager.findCard("three_of_cups")!;
      const cups2 = cardManager.findCard("two_of_cups")!;
      const fool = cardManager.findCard("fool")!;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => [cups3, cups2, fool],
        drawOrientation: () => "upright",
      });
      const first = rm.performReadingWithDetails("three_card", "最近人际如何？", undefined, {
        language: "zh",
      });
      const suitSignal = first.reading.evidence.signals.find(
        (s) => s.kind === "suit_focus",
      );
      expect(suitSignal?.fact).toContain("圣杯");
      expect(suitSignal?.fact).not.toContain("cups");

      // Mutating returned motifs must not pollute later readings
      const originalLen = first.reading.evidence.cards[0].traditionMotifs.length;
      first.reading.evidence.cards[0].traditionMotifs.push("MUTATED_SENTINEL");
      const second = rm.performReadingWithDetails("three_card", "最近人际如何？", undefined, {
        language: "zh",
      });
      expect(second.reading.evidence.cards[0].traditionMotifs).toHaveLength(
        originalLen,
      );
      expect(second.reading.evidence.cards[0].traditionMotifs).not.toContain(
        "MUTATED_SENTINEL",
      );
    });

    it("avoids false Celtic Cross outcome-alignment verdicts when shared-suit outcomes diverge", () => {
      const cards = [
        cardManager.findCard("fool")!,
        cardManager.findCard("magician")!,
        cardManager.findCard("high_priestess")!,
        cardManager.findCard("empress")!,
        cardManager.findCard("three_of_pentacles")!, // Possible Outcome (index 4)
        cardManager.findCard("emperor")!,
        cardManager.findCard("hierophant")!,
        cardManager.findCard("lovers")!,
        cardManager.findCard("chariot")!,
        cardManager.findCard("five_of_pentacles")!, // Final Outcome (index 9)
      ];
      let drawIdx = 0;
      const rm = new TarotReadingManager(cardManager, new TarotSessionManager(), {
        drawCards: () => cards,
        drawOrientation: () => (drawIdx++ === 9 ? "reversed" : "upright"),
      });
      const res = rm.performReadingWithDetails("celtic_cross", "How will this project unfold?");
      expect(res.text).not.toContain("mature without a drastic change");
      expect(res.text).toContain("shares a suit or elemental thread");
    });

    it("rejects partial IDs in tarot://cards/{id}, retains evidence in receipts, resolves untracked readingIds, and honors explicit visual-reading language", async () => {
      const tarotServer = await TarotServer.create();
      const protocolServer = createMcpProtocolServer(tarotServer);
      const client = new Client({ name: "regression-client", version: "1.0.0" });
      const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([
        protocolServer.connect(sTransport),
        client.connect(cTransport),
      ]);

      try {
        // 1. Partial ID on tarot://cards/{id} must fail instead of returning candidates[0]
        await expect(
          client.readResource({ uri: "tarot://cards/three_of" }),
        ).rejects.toThrow(/Unknown card/);

        // 2. Exact ID still resolves cleanly
        const exactCard = await client.readResource({ uri: "tarot://cards/three_of_cups" });
        const exactJson = JSON.parse((exactCard.contents[0] as { text: string }).text);
        expect(exactJson.id).toBe("three_of_cups");

        // 3. Untracked reading (get_daily_card) still produces a resolvable receipt with evidence
        const daily = await client.callTool({
          name: TOOL_NAMES.getDailyCard,
          arguments: { question: "What should I focus on today?", language: "en" },
        });
        const dailySc = daily.structuredContent as { readingId: string; sessionId?: string };
        expect(dailySc.readingId).toBeTruthy();
        expect(dailySc.sessionId).toBeUndefined();

        const receiptRes = await client.readResource({
          uri: `tarot://readings/${dailySc.readingId}`,
        });
        const receipt = JSON.parse((receiptRes.contents[0] as { text: string }).text);
        expect(receipt.readingId).toBe(dailySc.readingId);
        expect(receipt.evidence?.questionDomain).toBe("general");
        expect(receipt.evidence?.cards).toHaveLength(1);

        // 4. visual-reading prompt honors explicit language="en" even for a Chinese question
        const prompt = await client.getPrompt({
          name: "visual-reading",
          arguments: { question: "今天适合推进项目吗？", language: "en" },
        });
        const promptText = (prompt.messages[0].content as { text: string }).text;
        expect(promptText).toContain('Pass language: "en"');
        expect(promptText).not.toContain('Pass language: "zh"');
      } finally {
        await client.close();
        await protocolServer.close();
      }
    });
  });
});
