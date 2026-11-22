import {
  CANON_KNOWLEDGE_VERSION,
  getCanonCard,
  getCanonMotifs,
  getCanonReversalLenses,
  inferPositionRole,
} from "../../canon/index.js";
import { VISUAL_ARTWORK_VERSION } from "../../shared/artwork.js";
import { localizedElement, localizedSuit, pick } from "../../shared/i18n.js";
import type {
  DrawnCard,
  Language,
  PositionRole,
  ReadingCardEvidence,
  ReadingDomain,
  ReadingEvidence,
  ReadingSignal,
} from "../../shared/types.js";

const MAJOR_ARCANA_RATIO = 22 / 78;

const WORKPLACE_ZH = /(同事|上司|老板|领导|职场|工作|事业|职业|跳槽|升职|求职|面试|公司|团队|项目|副业|创业|财务|金钱|收入|投资|薪资|学业|考试|学习)/;
const WORKPLACE_EN =
  /\b(career|job|work|workplace|colleague|colleagues|coworker|coworkers|boss|manager|promotion|salary|business|money|finance|financial|income|project|study|exam|school|company|team|startup)\b/;

const LOVE_ZH = /(爱情|恋爱|感情|伴侣|对象|婚姻|结婚|分手|复合|暧昧|暗恋|前任|桃花|亲密关系|恋人|另一半|婚恋)/;
const LOVE_EN =
  /\b(love|romance|romantic|partner|marriage|marry|dating|crush|breakup|ex|boyfriend|girlfriend|husband|wife|spouse|affection|intimacy)\b/;
const BUSINESS_PARTNER_EN =
  /\b(?:business|managing|equity|general|senior|junior|work|project|trading|lab|study)\s+partner\b/g;
const NON_ROMANTIC_LOVE_EN =
  /\blove\s+(?:my|this|the|our)\s+(?:job|work|career|role|team|company|project|office)\b/g;
const RELATIONSHIP_EN = /\brelationship\b/;

const HEALTH_ZH = /(健康|身体|病情|生病|症状|睡眠|失眠|疲惫|疲劳|体力|养生|调理|康复|饮食|运动|健身|身心)/;
const HEALTH_EN =
  /\b(health|wellness|wellbeing|body|illness|symptom|sleep|insomnia|fatigue|burnout|exercise|fitness|recovery|rest|healing)\b/;

const SPIRITUAL_ZH = /(灵性|灵魂|使命|人生意义|修行|冥想|直觉|觉醒|业力|前世|内在成长|自我探索)/;
const SPIRITUAL_EN =
  /\b(spiritual|spirituality|soul|purpose|calling|meditation|intuition|awakening|karma|inner growth|self-discovery)\b/;

/**
 * Classify the primary life domain from the USER'S QUESTION ONLY.
 * Never mixes localized position descriptions (which often contain words like
 * "energy") into the domain signal, and uses word boundaries for English so
 * substrings like "interest" never collide with "rest".
 */
export function classifyQuestionDomain(question: string): ReadingDomain {
  const q = question.trim().toLowerCase();
  if (!q) return "general";

  const qForLove = q
    .replace(BUSINESS_PARTNER_EN, " ")
    .replace(NON_ROMANTIC_LOVE_EN, " ");
  const hasWorkplace = WORKPLACE_ZH.test(q) || WORKPLACE_EN.test(q);
  const hasExplicitLove = LOVE_ZH.test(q) || LOVE_EN.test(qForLove);
  const hasGenericRelationship = RELATIONSHIP_EN.test(q) || q.includes("关系");

  // Explicit workplace context takes precedence over generic "relationship/关系"
  // so "如何改善与同事的关系" or "relationship with my manager" routes to career.
  if (hasWorkplace && !hasExplicitLove) {
    return "career";
  }
  if (hasExplicitLove || (hasGenericRelationship && !hasWorkplace)) {
    return "love";
  }
  if (hasWorkplace) {
    return "career";
  }
  if (HEALTH_ZH.test(q) || HEALTH_EN.test(q)) {
    return "health";
  }
  if (SPIRITUAL_ZH.test(q) || SPIRITUAL_EN.test(q)) {
    return "spirituality";
  }
  return "general";
}

export function resolvePositionRole(drawn: DrawnCard): PositionRole {
  return drawn.positionRole ?? inferPositionRole(drawn.position, drawn.positionMeaning);
}

export function buildReadingEvidence(
  drawnCards: DrawnCard[],
  question: string,
  language: Language = "en",
  deckVersion: string = VISUAL_ARTWORK_VERSION,
): ReadingEvidence {
  const questionDomain = classifyQuestionDomain(question);

  const cards: ReadingCardEvidence[] = drawnCards.map((drawn, index) => {
    const role = resolvePositionRole(drawn);
    const canon = getCanonCard(drawn.card.id);
    const motifs = getCanonMotifs(drawn.card.id, language, deckVersion);
    const fallbackSymbolism =
      language === "zh" && drawn.card.zh?.symbolism?.length
        ? drawn.card.zh.symbolism
        : drawn.card.symbolism;

    return {
      positionIndex: index + 1,
      positionId: drawn.positionId ?? `pos_${index + 1}`,
      positionRole: role,
      cardId: drawn.card.id,
      orientation: drawn.orientation,
      hasCanon: Boolean(canon),
      traditionMotifs: [...(motifs?.tradition ?? fallbackSymbolism)],
      editionMotifs: [...(motifs?.edition ?? [])],
      ...(drawn.orientation === "reversed"
        ? { reversalLenses: getCanonReversalLenses(drawn.card.id, language) }
        : {}),
    };
  });

  const signals = computeReadingSignals(drawnCards, language);

  return {
    knowledgeVersion: CANON_KNOWLEDGE_VERSION,
    deckVersion,
    questionDomain,
    cards,
    signals,
  };
}

function computeReadingSignals(
  drawnCards: DrawnCard[],
  language: Language,
): ReadingSignal[] {
  const signals: ReadingSignal[] = [];
  const total = drawnCards.length;
  if (total === 0) return signals;

  // 1. Major Arcana density with statistical baseline (22/78 ≈ 28.2%)
  const majorPositions = drawnCards
    .map((c, idx) => (c.card.arcana === "major" ? idx + 1 : -1))
    .filter((pos) => pos > 0);
  const expectedMajor = Number((total * MAJOR_ARCANA_RATIO).toFixed(1));
  const majorRatio = majorPositions.length / total;
  if (
    majorPositions.length > 0 &&
    (majorPositions.length >= Math.max(2, Math.ceil(total * 0.5)) ||
      (total === 1 && majorPositions.length === 1))
  ) {
    const baselineNote =
      total >= 3 && majorRatio >= 0.65
        ? pick(
            language,
            "Significantly above the 28% deck baseline—points to heavyweight archetypal themes.",
            "明显高于 28% 的整副牌基准比例，说明此事牵动较深层的核心人生课题。",
          )
        : pick(
            language,
            "Notable archetypal presence alongside everyday dynamics.",
            "大阿卡纳占比偏高，日常事务背后伴随关键阶段性课题。",
          );
    signals.push({
      kind: "major_density",
      positions: majorPositions,
      fact: pick(
        language,
        `${majorPositions.length} of ${total} cards are Major Arcana`,
        `${total} 张牌中有 ${majorPositions.length} 张大阿卡纳`,
      ),
      baseline: pick(
        language,
        `expected ~${expectedMajor} at 28.2% deck baseline`,
        `按 28.2% 基准期望约 ${expectedMajor} 张`,
      ),
      note: baselineNote,
    });
  }

  // 2. Orientation distribution (strictly factual—never equates upright=good or reversed=bad)
  const uprightCount = drawnCards.filter((c) => c.orientation === "upright").length;
  const reversedPositions = drawnCards
    .map((c, idx) => (c.orientation === "reversed" ? idx + 1 : -1))
    .filter((pos) => pos > 0);
  if (total >= 2) {
    signals.push({
      kind: "orientation_balance",
      positions:
        reversedPositions.length > 0
          ? reversedPositions
          : drawnCards.map((_, idx) => idx + 1),
      fact: pick(
        language,
        `${uprightCount} upright, ${reversedPositions.length} reversed`,
        `${uprightCount} 张正位、${reversedPositions.length} 张逆位`,
      ),
      note:
        reversedPositions.length === 0
          ? pick(
              language,
              "All cards appear upright, showing direct and outward expression of each card's specific archetype (judge each card by its own meaning and position, not as automatically favorable).",
              "全部为正位，说明各张牌的主题以直接、外显的方式运作（吉凶与性质仍需按单牌本义与牌位判断，而非默认利好）。",
            )
          : reversedPositions.length === total
            ? pick(
                language,
                "All cards appear reversed, highlighting inward processing, friction, delay, or release—inspect each card's reversal nuance rather than assuming a negative outcome.",
                "全部为逆位，提示议题多以内化、受阻、延后或松动释放的方式展开，需逐张辨别逆位语义而非一律视作凶兆。",
              )
            : pick(
                language,
                "Mixed upright and reversed orientations contrast direct outward dynamics with areas of inward reflection, friction, or release.",
                "正逆位交错，呈现出直接显化的面向与需要内省、疏通或松动的面向之间的对比。",
              ),
    });
  }

  // 3. Elemental balance
  const elementCounts: Record<"fire" | "water" | "air" | "earth", number[]> = {
    fire: [],
    water: [],
    air: [],
    earth: [],
  };
  drawnCards.forEach((c, idx) => {
    if (c.card.element) {
      elementCounts[c.card.element].push(idx + 1);
    }
  });
  const totalElemental = Object.values(elementCounts).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  if (totalElemental >= 2) {
    const sorted = (
      Object.entries(elementCounts) as Array<
        ["fire" | "water" | "air" | "earth", number[]]
      >
    ).sort(([, a], [, b]) => b.length - a.length);
    const [topEl, topPositions] = sorted[0];
    if (topPositions.length > totalElemental / 2) {
      signals.push({
        kind: "element_balance",
        positions: topPositions,
        fact: pick(
          language,
          `${topEl} leads (${topPositions.length}/${totalElemental} elemental cards)`,
          `${localizedElement(topEl, "zh")}元素占主导（${topPositions.length}/${totalElemental}）`,
        ),
        note: pick(
          language,
          `Dominant ${topEl} emphasis shapes the main tempo of the spread.`,
          `${localizedElement(topEl, "zh")}元素集中出现，奠定了整局牌的主要节奏。`,
        ),
      });
    }
  }

  // 4. Suit concentration (Minor Arcana)
  const suitPositions = new Map<string, number[]>();
  drawnCards.forEach((c, idx) => {
    if (c.card.suit) {
      const list = suitPositions.get(c.card.suit) ?? [];
      list.push(idx + 1);
      suitPositions.set(c.card.suit, list);
    }
  });
  for (const [suit, positions] of suitPositions.entries()) {
    if (positions.length >= 2) {
      const suitLabel = localizedSuit(suit, language);
      signals.push({
        kind: "suit_focus",
        positions,
        fact: pick(
          language,
          `${positions.length} cards from the suit of ${suit}`,
          `共出现 ${positions.length} 张${suitLabel}牌`,
        ),
        note: pick(
          language,
          `Repeated ${suit} cards concentrate attention on that suit's core arena.`,
          `同一花色（${suitLabel}）重复出现，把焦点收束到该牌组对应的生活领域。`,
        ),
      });
    }
  }

  // 5. Pip numerology (STRICTLY Minor Arcana 1-10 only — never mixes Major 0-21 or Court 11-14)
  const pipPositions = new Map<number, number[]>();
  drawnCards.forEach((c, idx) => {
    if (
      c.card.arcana === "minor" &&
      c.card.number !== undefined &&
      c.card.number >= 1 &&
      c.card.number <= 10
    ) {
      const list = pipPositions.get(c.card.number) ?? [];
      list.push(idx + 1);
      pipPositions.set(c.card.number, list);
    }
  });
  for (const [num, positions] of pipPositions.entries()) {
    if (positions.length >= 2) {
      signals.push({
        kind: "pip_numerology",
        positions,
        fact: pick(
          language,
          `Pip rank ${num} repeats across positions ${positions.join(", ")}`,
          `小阿卡纳数字 ${num} 在第 ${positions.join("、")} 位重复出现`,
        ),
        note: pick(
          language,
          "Shared pip rank echoes the same stage of development across different suits.",
          "相同小牌点数在不同花色间形成呼应，强调同一发展阶段的课题。",
        ),
      });
    }
  }

  // 6. Court cards (STRICTLY Minor Arcana 11-14)
  const courtPositions = drawnCards
    .map((c, idx) =>
      c.card.arcana === "minor" &&
      c.card.number !== undefined &&
      c.card.number >= 11
        ? idx + 1
        : -1,
    )
    .filter((pos) => pos > 0);
  if (courtPositions.length > 0) {
    signals.push({
      kind: "court_presence",
      positions: courtPositions,
      fact: pick(
        language,
        `${courtPositions.length} court card(s) at position(s) ${courtPositions.join(", ")}`,
        `第 ${courtPositions.join("、")} 位出现 ${courtPositions.length} 张宫廷牌`,
      ),
      note: pick(
        language,
        "Court cards highlight key people, interpersonal stances, or a role you are being asked to embody.",
        "宫廷牌指向关键人物、人际态度，或当下需要你展现的处事角色。",
      ),
    });
  }

  return signals;
}
