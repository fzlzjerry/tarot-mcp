import {
  localizedCardName,
  localizedElement,
  pick,
} from "../../shared/i18n.js";
import type {
  CardElement,
  DrawnCard,
  ElementalDignity,
  Language,
  ReadingRelation,
  SpreadType,
} from "../../shared/types.js";
import { orientationLabel } from "../reading-formatter.js";
import { isValidSpreadType } from "../spreads.js";
import { LINK_NOTES, dignityNote, elementalDignity } from "./relations.js";

interface PositionGroup {
  en: string;
  zh: string;
  /** Position ids that are read together. */
  positions: string[];
}

interface SpreadAnalysisSpec {
  en: string;
  zh: string;
  groups?: PositionGroup[];
  /** Positions that stand for an element themselves (position id → element). */
  seats?: Record<string, CardElement>;
}

const ELEMENT_SEATS: Record<string, CardElement> = {
  fire: "fire",
  water: "water",
  air: "air",
  earth: "earth",
};

/**
 * Heading and thematic groupings of the cross-card analysis for each built-in
 * spread, keyed by the stable spread type id (never the display name, which
 * can collide with a custom spread's name). The analysis body is rendered from
 * the reading's relations, so it can never disagree with the evidence.
 * Single-card spreads have no cross-card analysis.
 */
const SPREAD_ANALYSIS: Record<SpreadType, SpreadAnalysisSpec | null> = {
  single_card: null,
  three_card: { en: "Three Card Flow Analysis", zh: "三牌流动分析" },
  celtic_cross: { en: "Celtic Cross Analysis", zh: "凯尔特十字分析" },
  horseshoe: { en: "Horseshoe Arc Analysis", zh: "马蹄阵弧线分析" },
  relationship_cross: {
    en: "Relationship Dynamics Analysis",
    zh: "关系动态分析",
  },
  career_path: { en: "Career Path Analysis", zh: "事业路径分析" },
  decision_making: { en: "Decision Paths Analysis", zh: "抉择路径分析" },
  spiritual_guidance: {
    en: "Spiritual Development Analysis",
    zh: "灵性发展分析",
  },
  year_ahead: {
    en: "Year Ahead Overview",
    zh: "年度前瞻总览",
    groups: [
      {
        en: "First quarter",
        zh: "第一季度",
        positions: ["january", "february", "march"],
      },
      {
        en: "Second quarter",
        zh: "第二季度",
        positions: ["april", "may", "june"],
      },
      {
        en: "Third quarter",
        zh: "第三季度",
        positions: ["july", "august", "september"],
      },
      {
        en: "Fourth quarter",
        zh: "第四季度",
        positions: ["october", "november", "december"],
      },
    ],
  },
  chakra_alignment: {
    en: "Chakra Energy Analysis",
    zh: "脉轮能量分析",
    groups: [
      {
        en: "Lower centers",
        zh: "下三轮",
        positions: ["root", "sacral", "solar_plexus"],
      },
      {
        en: "Upper centers",
        zh: "上三轮",
        positions: ["throat", "third_eye", "crown"],
      },
    ],
  },
  shadow_work: { en: "Shadow Integration Analysis", zh: "阴影整合分析" },
  venus_love: { en: "Venus Love Energy Analysis", zh: "金星之爱能量分析" },
  tree_of_life: {
    en: "Tree of Life Spiritual Analysis",
    zh: "生命之树灵性分析",
    groups: [
      {
        en: "Pillar of Mercy",
        zh: "慈悲之柱",
        positions: ["chokmah", "chesed", "netzach"],
      },
      {
        en: "Pillar of Severity",
        zh: "严厉之柱",
        positions: ["binah", "geburah", "hod"],
      },
      {
        en: "Middle Pillar",
        zh: "中柱",
        positions: ["kether", "tiphareth", "yesod", "malkuth"],
      },
    ],
  },
  astrological_houses: {
    en: "Astrological Houses Analysis",
    zh: "占星宫位分析",
    groups: [
      {
        en: "Fire houses (1, 5, 9)",
        zh: "火象宫（1、5、9）",
        positions: ["house_1", "house_5", "house_9"],
      },
      {
        en: "Earth houses (2, 6, 10)",
        zh: "土象宫（2、6、10）",
        positions: ["house_2", "house_6", "house_10"],
      },
      {
        en: "Air houses (3, 7, 11)",
        zh: "风象宫（3、7、11）",
        positions: ["house_3", "house_7", "house_11"],
      },
      {
        en: "Water houses (4, 8, 12)",
        zh: "水象宫（4、8、12）",
        positions: ["house_4", "house_8", "house_12"],
      },
    ],
  },
  mandala: { en: "Mandala Wholeness Analysis", zh: "曼陀罗圆满分析" },
  pentagram: {
    en: "Pentagram Elemental Analysis",
    zh: "五芒星元素分析",
    seats: ELEMENT_SEATS,
  },
  mirror_of_truth: {
    en: "Mirror of Truth - Four Beams of Light Analysis",
    zh: "真相之镜——四束光明分析",
  },
  daily_guidance: null,
  yes_no: { en: "Yes/No Leaning Analysis", zh: "是否倾向分析" },
  weekly_forecast: {
    en: "Weekly Flow Analysis",
    zh: "一周流动分析",
    groups: [
      {
        en: "Weekdays",
        zh: "工作日",
        positions: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
      { en: "Weekend", zh: "周末", positions: ["saturday", "sunday"] },
    ],
  },
  new_moon_intentions: {
    en: "New Moon Intentions Analysis",
    zh: "新月意图分析",
  },
  full_moon_release: { en: "Full Moon Release Analysis", zh: "满月释放分析" },
  elemental_balance: {
    en: "Elemental Balance Analysis",
    zh: "四元素平衡分析",
    seats: ELEMENT_SEATS,
  },
  past_life_karma: { en: "Karmic Pattern Analysis", zh: "业力模式分析" },
  compatibility: { en: "Compatibility Analysis", zh: "契合度分析" },
};

const GENERIC_ANALYSIS: SpreadAnalysisSpec = {
  en: "Contextual Spread Analysis",
  zh: "牌阵脉络分析",
};

const ECHO_LABELS: Record<
  Exclude<ReadingRelation["kind"], "structural">,
  { en: string; zh: string }
> = {
  archetype_pair: { en: "Archetype pair", zh: "原型对照" },
  suit_run: { en: "Suit run", zh: "花色连续" },
  number_echo: { en: "Number echo", zh: "数字呼应" },
};

const DIGNITY_ORDER: ElementalDignity[] = [
  "same",
  "friendly",
  "opposing",
  "neutral",
];

const STEP_LABELS: Record<ElementalDignity, { en: string; zh: string }> = {
  same: { en: "same-element steps", zh: "同元素的衔接" },
  friendly: { en: "friendly steps", zh: "相合的衔接" },
  opposing: { en: "opposing steps", zh: "相冲的衔接" },
  neutral: { en: "neutral steps", zh: "中性的衔接" },
};

const SEAT_NOTES: Record<ElementalDignity, { en: string; zh: string }> = {
  same: {
    en: "the card is in its own element here and expresses it directly",
    zh: "这张牌落在自己的元素上，会直接表达这个元素",
  },
  friendly: {
    en: "a friendly element, so the card supports what this position asks for",
    zh: "属相合元素，这张牌会助长这个牌位所需要的东西",
  },
  opposing: {
    en: "an opposing element, so the card works against the grain of this position and the area needs deliberate attention",
    zh: "属相冲元素，这张牌与这个牌位逆向而行，这一面需要有意识地照顾",
  },
  neutral: {
    en: "a neutral element, so the card neither feeds nor drains this position",
    zh: "属中性元素，这张牌对这个牌位既不助长也不消耗",
  },
};

function positionName(drawn: DrawnCard, index: number): string {
  return drawn.position || `#${index + 1}`;
}

function cardLabel(drawn: DrawnCard, language: Language): string {
  return `${localizedCardName(drawn.card, language)}${orientationLabel(drawn.orientation, language)}`;
}

/** Runs of three or more consecutive leads_to links, as relation index lists. */
function sequenceChains(structural: ReadingRelation[]): number[][] {
  const chains: number[][] = [];
  let current: number[] = [];
  structural.forEach((relation, index) => {
    const previous = structural[current.at(-1) ?? -1];
    const continues =
      relation.link === "leads_to" &&
      previous !== undefined &&
      previous.positions[1] === relation.positions[0];
    if (continues) {
      current.push(index);
      return;
    }
    if (current.length >= 3) chains.push(current);
    current = relation.link === "leads_to" ? [index] : [];
  });
  if (current.length >= 3) chains.push(current);
  return chains;
}

function renderSequence(
  chain: ReadingRelation[],
  drawnCards: DrawnCard[],
  language: Language,
): string {
  const start = chain[0].positions[0] - 1;
  const end = chain.at(-1)!.positions[1] - 1;
  const steps = DIGNITY_ORDER.flatMap((dignity) => {
    const matching = chain
      .filter((relation) => relation.dignity === dignity)
      .map(({ positions: [from, to] }) =>
        [from, to]
          .map((position) =>
            positionName(drawnCards[position - 1], position - 1),
          )
          .join(" → "),
      );
    return matching.length > 0
      ? [
          pick(
            language,
            `${STEP_LABELS[dignity].en}: ${matching.join(", ")}`,
            `${STEP_LABELS[dignity].zh}：${matching.join("、")}`,
          ),
        ]
      : [];
  });
  return pick(
    language,
    `- **Sequence (${positionName(drawnCards[start], start)} → ${positionName(drawnCards[end], end)}):** ${steps.join("; ")}. Read same-element steps as one theme continuing and opposing steps as a change of gear that needs a deliberate transition.`,
    `- **顺序（${positionName(drawnCards[start], start)} → ${positionName(drawnCards[end], end)}）：**${steps.join("；")}。同元素的衔接可读作同一主题的延续，相冲的衔接则是需要有意识过渡的换挡。`,
  );
}

/**
 * One bullet per structural relation. Each link kind and each elemental
 * dignity is explained the first time it appears in a section; later
 * relations of the same kind carry only their fact, so a spread with several
 * opposing pairs does not repeat one sentence.
 */
function renderStructural(
  relation: ReadingRelation,
  drawnCards: DrawnCard[],
  language: Language,
  explained: Set<string>,
): string {
  const [fromCard, toCard] = relation.positions.map(
    (position) => drawnCards[position - 1],
  );
  const [from, to] = relation.positions.map((position) =>
    positionName(drawnCards[position - 1], position - 1),
  );
  const { link, dignity } = relation;
  const text = [
    relation.fact,
    ...(link && !explained.has(link) ? [LINK_NOTES[link][language]] : []),
    ...(dignity && !explained.has(dignity)
      ? [dignityNote(dignity, fromCard, toCard, language)]
      : []),
  ].join(language === "zh" ? "" : " ");
  if (link) explained.add(link);
  if (dignity) explained.add(dignity);
  const arrow = link === "mirrors" || link === "tension" ? "↔" : "→";
  return pick(
    language,
    `- **${from} ${arrow} ${to}:** ${text}`,
    `- **${from} ${arrow} ${to}：**${text}`,
  );
}

function renderGroup(
  group: PositionGroup,
  drawnCards: DrawnCard[],
  language: Language,
): string | undefined {
  const members = group.positions.flatMap((id) => {
    const index = drawnCards.findIndex((drawn) => drawn.positionId === id);
    return index < 0 ? [] : [drawnCards[index]];
  });
  if (members.length < 2) return undefined;
  const tally = new Map<CardElement, number>();
  for (const { card } of members) {
    if (card.element)
      tally.set(card.element, (tally.get(card.element) ?? 0) + 1);
  }
  const elements = [...tally.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([element, count]) =>
      pick(
        language,
        `${element} ×${count}`,
        `${localizedElement(element, "zh")}×${count}`,
      ),
    );
  return pick(
    language,
    `- **${group.en}:** ${members.map((drawn) => cardLabel(drawn, "en")).join(", ")}; elements: ${elements.join(", ")}.`,
    `- **${group.zh}：**${members.map((drawn) => cardLabel(drawn, "zh")).join("、")}；元素：${elements.join("、")}。`,
  );
}

function renderSeat(
  drawn: DrawnCard,
  index: number,
  seat: CardElement,
  language: Language,
): string | undefined {
  const element = drawn.card.element;
  if (!element) return undefined;
  const note = SEAT_NOTES[elementalDignity(element, seat)];
  return pick(
    language,
    `- **${positionName(drawn, index)}:** ${cardLabel(drawn, "en")} is ${/^[aeiou]/.test(element) ? "an" : "a"} ${element} card in the ${seat} position: ${note.en}.`,
    `- **${positionName(drawn, index)}：**${cardLabel(drawn, "zh")}是${localizedElement(element, "zh")}元素的牌，落在${localizedElement(seat, "zh")}元素的牌位：${note.zh}。`,
  );
}

/**
 * Render the cross-card analysis of a reading from its relations. Built-in
 * spreads get their own heading and thematic groups; any other spread type
 * (custom spreads) gets the contextual heading. Returns "" for a single card.
 */
export function renderSpreadAnalysis(
  drawnCards: DrawnCard[],
  spreadType: string,
  relations: ReadingRelation[],
  language: Language = "en",
): string {
  if (drawnCards.length < 2) return "";
  const builtIn = isValidSpreadType(spreadType)
    ? SPREAD_ANALYSIS[spreadType]
    : undefined;
  const spec = builtIn ?? GENERIC_ANALYSIS;

  const structural = relations.filter(({ kind }) => kind === "structural");
  const chains = sequenceChains(structural);
  const chained = new Set(chains.flat());
  const explained = new Set<string>();

  const bullets = [
    ...structural.flatMap((relation, index) =>
      chained.has(index)
        ? []
        : [renderStructural(relation, drawnCards, language, explained)],
    ),
    ...chains.map((chain) =>
      renderSequence(
        chain.map((index) => structural[index]),
        drawnCards,
        language,
      ),
    ),
    ...drawnCards.flatMap((drawn, index) => {
      const seat = spec.seats?.[drawn.positionId ?? ""];
      return seat ? [renderSeat(drawn, index, seat, language)] : [];
    }),
    ...(spec.groups ?? []).map((group) =>
      renderGroup(group, drawnCards, language),
    ),
    ...relations.flatMap((relation) =>
      relation.kind === "structural"
        ? []
        : [
            pick(
              language,
              `- **${ECHO_LABELS[relation.kind].en}:** ${relation.fact} ${relation.note}`,
              `- **${ECHO_LABELS[relation.kind].zh}：**${relation.fact}${relation.note}`,
            ),
          ],
    ),
  ].filter((bullet): bullet is string => bullet !== undefined);

  const blocks: string[] = [];
  if (!builtIn) {
    const first = drawnCards[0];
    const last = drawnCards[drawnCards.length - 1];
    blocks.push(
      pick(
        language,
        `This spread moves from ${positionName(first, 0)} (${first.card.name}) to ${positionName(last, drawnCards.length - 1)} (${last.card.name}).`,
        `这个牌阵从「${positionName(first, 0)}」（${localizedCardName(first.card, "zh")}）延展到「${positionName(last, drawnCards.length - 1)}」（${localizedCardName(last.card, "zh")}）。`,
      ) +
        (bullets.length === 0
          ? pick(
              language,
              " Its positions imply no pairings, so each card is read by its own position meaning.",
              "各牌位之间没有可推定的对应关系，因此每张牌按各自的牌位含义来读。",
            )
          : ""),
    );
  }
  if (bullets.length > 0) blocks.push(bullets.join("\n"));
  return `${pick(language, `**${spec.en}:**`, `**${spec.zh}：**`)}\n\n${blocks.join("\n\n")}\n`;
}
