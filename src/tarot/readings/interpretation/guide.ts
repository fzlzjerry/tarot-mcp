import { localizedCardName, pick } from "../../shared/i18n.js";
import type {
  DrawnCard,
  Language,
  PositionRole,
  ReadingGuide,
  ReadingRelation,
} from "../../shared/types.js";
import { orientationLabel } from "../reading-formatter.js";

export const READING_GUIDE_VERSION = "guide-v1";

/** The question each role asks of its card; {card} is the card with orientation. */
const ROLE_PROMPTS: Record<PositionRole, { en: string; zh: string }> = {
  message: {
    en: "What single message does {card} bring to this question, and what would acting on it look like now?",
    zh: "{card}为这个问题带来的核心讯息是什么？现在照着它去做会是什么样子？",
  },
  foundation: {
    en: "What earlier pattern or groundwork does {card} show beneath this situation, and is it still serving the querent?",
    zh: "{card}显示出这件事底下有怎样的旧模式或根基？它现在还在帮上忙吗？",
  },
  present: {
    en: "How does {card} describe what is actually happening now, in concrete terms?",
    zh: "{card}如何具体地描述此刻真实发生的事？",
  },
  challenge: {
    en: "What specific friction does {card} name, and what would loosen it?",
    zh: "{card}点出的具体阻力是什么？什么能让它松动？",
  },
  resource: {
    en: "What does {card} put in the querent's hands, and how can it be used on purpose?",
    zh: "{card}把什么交到了提问者手里？怎样才能有意识地用上它？",
  },
  action: {
    en: "What concrete step does {card} point to, and what is the smallest version of it?",
    zh: "{card}指向哪一个具体行动？它最小的可执行版本是什么？",
  },
  outcome: {
    en: "Where does {card} suggest things tend if nothing changes, and what would shift that?",
    zh: "按现状发展，{card}提示事情会倾向哪里？什么会改变这个走向？",
  },
  advice: {
    en: "What stance or choice does {card} recommend, and what does it caution against overdoing?",
    zh: "{card}建议采取怎样的态度或选择？又提醒哪里不要过头？",
  },
  hidden: {
    en: "What unseen factor does {card} bring into view, and how could the querent check it against the facts?",
    zh: "{card}让哪个看不见的因素浮现出来？提问者可以怎样用事实去核对它？",
  },
  self: {
    en: "How does {card} describe the querent's own stance or part in this?",
    zh: "{card}如何描述提问者自己在这件事里的姿态或角色？",
  },
  other: {
    en: "What dynamic does {card} show on the other side, without presuming private motives?",
    zh: "在不替对方下定论的前提下，{card}呈现出对方那一侧怎样的互动模式？",
  },
  external: {
    en: "What outside conditions does {card} describe, and which of them can the querent influence?",
    zh: "{card}描述了怎样的外部条件？其中哪些是提问者能够影响的？",
  },
  hopes_fears: {
    en: "What hope and what fear does {card} hold together here, and how are they shaping choices?",
    zh: "{card}在这里同时承载着怎样的期待与担忧？它们正如何左右选择？",
  },
  general: {
    en: "What does {card} say about this position's own theme specifically?",
    zh: "针对这个牌位本身的主题，{card}具体说了什么？",
  },
};

/**
 * Rubric for the assistant that presents a reading: the order to read in, one
 * role-conditioned question per card, and the limits the reading stays inside.
 * drawnCards must carry resolved position roles.
 */
export function buildReadingGuide(
  drawnCards: DrawnCard[],
  relations: ReadingRelation[],
  language: Language,
): ReadingGuide {
  const hasReversed = drawnCards.some(
    ({ orientation }) => orientation === "reversed",
  );
  return {
    version: READING_GUIDE_VERSION,
    steps: [
      pick(
        language,
        "Restate the question in one line and name the spread before reading any card.",
        "先用一句话复述问题并点明牌阵，再开始读牌。",
      ),
      pick(
        language,
        "Read each card through its position role, using the role-specific meaning given for it and one tradition or edition motif as the anchor.",
        "按牌位角色读每一张牌：以该牌给出的角色专属牌义为准，并引用一个传统或本版牌面的意象作为依据。",
      ),
      ...(hasReversed
        ? [
            pick(
              language,
              "For each reversed card, choose the one reversal lens (blocked, excess, internalized, or release) that fits its position and say why.",
              "遇到逆位，从受阻、过度、内化、释放四种视角中选出最贴合牌位的一种，并说明理由。",
            ),
          ]
        : []),
      ...(relations.length > 0
        ? [
            pick(
              language,
              "Walk the card-to-card relations in order, structural links first and then echoes, and say what each pair changes about how the other card reads.",
              "依次走读牌间关系：先结构关系，再数字与原型呼应，说明每一对牌如何改变彼此的读法。",
            ),
          ]
        : []),
      ...(drawnCards.length > 1
        ? [
            pick(
              language,
              "Use the spread-wide signals as supporting context only, quoting the baseline where one is given.",
              "整体信号只作旁证，有基准值时一并引用。",
            ),
          ]
        : []),
      pick(
        language,
        "Close with one through-line, the main tension, and one concrete next step the querent controls.",
        "收束为一条主线、一处主要张力，以及一个提问者自己能掌控的具体下一步。",
      ),
    ],
    positionPrompts: drawnCards.map((drawn, index) => {
      const role = drawn.positionRole ?? "general";
      return {
        positionIndex: index + 1,
        positionRole: role,
        prompt: ROLE_PROMPTS[role][language].replace(
          "{card}",
          `${localizedCardName(drawn.card, language)}${orientationLabel(drawn.orientation, language)}`,
        ),
      };
    }),
    guardrails: [
      pick(
        language,
        "Orientation is a mode of expression, not a verdict: never call upright good or reversed bad.",
        "正逆位是表达方式，不是吉凶判定：不要把正位说成好、逆位说成坏。",
      ),
      pick(
        language,
        "Describe tendencies and options, never guaranteed outcomes or fixed fates.",
        "只描述倾向与可选项，不断言必然的结果或注定的命运。",
      ),
      pick(
        language,
        "Do not state other people's private thoughts as fact; describe the dynamic the querent meets.",
        "不要把他人的内心想法当作事实来说，只描述提问者所面对的互动模式。",
      ),
      pick(
        language,
        "Give no medical, legal, or financial directives; point to qualified help where the question calls for it.",
        "不给出医疗、法律或财务方面的指令；问题涉及时，建议寻求专业帮助。",
      ),
      pick(
        language,
        "Use only the cards, positions, and orientations of this reading; do not redraw or add cards.",
        "只使用本次解读的牌、牌位与正逆位，不重新抽牌，也不添加牌。",
      ),
    ],
  };
}

/** Markdown footer that carries the guide to hosts that only pass tool text. */
export function renderReadingGuide(
  guide: ReadingGuide,
  positions: Array<string | undefined>,
  language: Language,
): string {
  const lines = [
    pick(
      language,
      "\n\n## Reading Guide (for the assistant)\n",
      "\n\n## 解读指引（供助手参考）\n",
    ),
    ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    pick(language, "**Ask of each position:**", "**每个牌位要回答的问题：**"),
    ...guide.positionPrompts.map(
      ({ positionIndex, prompt }) =>
        `- ${positions[positionIndex - 1] ?? `#${positionIndex}`}${pick(language, ": ", "：")}${prompt}`,
    ),
    "",
    pick(language, "**Stay within:**", "**解读边界：**"),
    ...guide.guardrails.map((guardrail) => `- ${guardrail}`),
  ];
  return lines.join("\n");
}
