import {
  localizedCardName,
  localizedElement,
  localizedSuit,
  pick,
} from "../../shared/i18n.js";
import type {
  CardElement,
  DrawnCard,
  ElementalDignity,
  Language,
  PositionRole,
  ReadingRelation,
  SpreadLink,
  SpreadLinkKind,
} from "../../shared/types.js";
import { orientationLabel } from "../reading-formatter.js";
import { majorRootNumber, pipTheme } from "./numerology.js";

/** Cap on archetype, number, and suit echoes so large spreads stay readable. */
const MAX_ECHO_RELATIONS = 6;
const MAX_DERIVED_LINKS = 8;

export interface RelationPosition {
  id: string;
  role: PositionRole;
}

const FRIENDLY_ELEMENTS: Record<CardElement, CardElement> = {
  fire: "air",
  air: "fire",
  water: "earth",
  earth: "water",
};

const OPPOSING_ELEMENTS: Record<CardElement, CardElement> = {
  fire: "water",
  water: "fire",
  air: "earth",
  earth: "air",
};

export function elementalDignity(
  a: CardElement,
  b: CardElement,
): ElementalDignity {
  if (a === b) return "same";
  if (FRIENDLY_ELEMENTS[a] === b) return "friendly";
  if (OPPOSING_ELEMENTS[a] === b) return "opposing";
  return "neutral";
}

/**
 * Structural links for a spread that declares none (custom spreads): pair
 * positions by role the way the built-in layouts do. Positions whose roles
 * imply no pairing stay unlinked rather than getting an invented relation.
 */
export function deriveLinksFromRoles(
  positions: RelationPosition[],
): SpreadLink[] {
  const withRole = (role: PositionRole) =>
    positions.filter((position) => position.role === role).map(({ id }) => id);
  const first = (role: PositionRole) => withRole(role)[0];
  const present = first("present");
  const challenge = first("challenge");
  const outcome = withRole("outcome").at(-1);
  const self = first("self");
  const other = first("other");
  const external = first("external");
  const foundation = first("foundation");
  const hopesFears = first("hopes_fears");

  const candidates: Array<
    [string | undefined, string | undefined, SpreadLinkKind]
  > = [
    ...withRole("challenge").map((id) => [id, present, "crosses"] as const),
    ...withRole("resource").map((id) => [id, challenge, "answers"] as const),
    ...withRole("advice").map((id) => [id, challenge, "answers"] as const),
    ...withRole("hidden").map((id) => [id, present, "underlies"] as const),
    [foundation, present, "leads_to"],
    ...withRole("action").map((id) => [id, outcome, "leads_to"] as const),
    [present, outcome, "leads_to"],
    [self, other, "mirrors"],
    [self, external, "tension"],
    [hopesFears, outcome, "tension"],
  ].map(
    ([from, to, kind]) =>
      [from, to, kind] as [
        string | undefined,
        string | undefined,
        SpreadLinkKind,
      ],
  );

  const links: SpreadLink[] = [];
  const seen = new Set<string>();
  for (const [from, to, kind] of candidates) {
    if (!from || !to || from === to) continue;
    const key = [from, to].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ from, to, kind });
    if (links.length === MAX_DERIVED_LINKS) break;
  }
  return links;
}

const LINK_VERBS: Record<SpreadLinkKind, { en: string; zh: [string, string] }> =
  {
    crosses: { en: "crosses", zh: ["横跨", ""] },
    answers: { en: "answers", zh: ["回应", ""] },
    leads_to: { en: "leads into", zh: ["引向", ""] },
    underlies: { en: "sits beneath", zh: ["潜伏在", "之下"] },
    mirrors: { en: "mirrors", zh: ["映照", ""] },
    tension: { en: "pulls against", zh: ["牵制", ""] },
  };

export const LINK_NOTES: Record<SpreadLinkKind, { en: string; zh: string }> = {
  crosses: {
    en: "Read the crossing card as the specific friction acting on the other card's theme, not as a verdict on it.",
    zh: "把横跨的那张牌读作作用在另一张牌主题上的具体阻力，而不是对它的定论。",
  },
  answers: {
    en: "Read the first card as the concrete means of meeting the second: what it supplies that the other lacks.",
    zh: "把前一张牌读作回应后一张牌的具体手段：它补上了对方缺少的什么。",
  },
  leads_to: {
    en: "Read the two in sequence: what the earlier card sets in motion and what the later card does with it.",
    zh: "按先后顺序读：前一张牌启动了什么，后一张牌又把它带向哪里。",
  },
  underlies: {
    en: "Read the lower card as the unseen driver, and check whether the visible card expresses it or covers it.",
    zh: "把下方的牌读作看不见的推手，留意表面的牌是在表达它还是在遮住它。",
  },
  mirrors: {
    en: "Read the pair side by side: where they agree is common ground, where they differ is the gap to bridge.",
    zh: "把两张牌并排对照：一致之处是共同基础，差异之处是需要弥合的落差。",
  },
  tension: {
    en: "Read the pair as a pull in two directions that has to be weighed rather than settled by choosing one side.",
    zh: "把这一对读作两个方向的拉力，需要的是权衡，而不是只选一边。",
  },
};

const DIGNITY_LABELS: Record<ElementalDignity, { en: string; zh: string }> = {
  same: { en: "same element", zh: "同元素" },
  friendly: { en: "friendly elements", zh: "相合元素" },
  opposing: { en: "opposing elements", zh: "相冲元素" },
  neutral: { en: "neutral elements", zh: "中性元素" },
};

function cardLabel(drawn: DrawnCard, language: Language): string {
  return `${localizedCardName(drawn.card, language)}${orientationLabel(drawn.orientation, language)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function dignityNote(
  dignity: ElementalDignity,
  from: DrawnCard,
  to: DrawnCard,
  language: Language,
): string {
  const fromName = localizedCardName(from.card, language);
  const toName = localizedCardName(to.card, language);
  const fromElement = localizedElement(from.card.element, language);
  const toElement = localizedElement(to.card.element, language);
  switch (dignity) {
    case "same":
      return pick(
        language,
        `${fromName} shares a suit or elemental thread with ${toName}, keeping the same arena in focus—compare both cards' specific meanings and orientations to judge whether that thread steadies or shifts.`,
        `${fromName}与${toName}共享同一花色或元素脉络，核心议题延续在同一领域——请结合两张牌各自的牌义与正逆位，判断这股脉络是趋于稳固还是发生转折。`,
      );
    case "friendly":
      return pick(
        language,
        `${capitalize(fromElement)} and ${toElement} are friendly elements, so the two cards tend to feed each other's themes.`,
        `${fromElement}与${toElement}属相合元素，两张牌的主题倾向于互相助长。`,
      );
    case "opposing":
      return pick(
        language,
        `${capitalize(fromElement)} and ${toElement} are opposing elements, so the two cards tend to contest or dampen each other; look for what could mediate between them.`,
        `${fromElement}与${toElement}属相冲元素，两张牌的主题容易互相牵制或削弱，可留意什么能在两者之间居中调和。`,
      );
    case "neutral":
      return pick(
        language,
        `${capitalize(fromElement)} and ${toElement} are neutral to each other, so neither card amplifies nor dampens the other; weigh each by its own position.`,
        `${fromElement}与${toElement}互为中性，两张牌既不互相放大也不互相削弱，请各按其牌位权衡。`,
      );
  }
}

function structuralRelation(
  drawnCards: DrawnCard[],
  fromIndex: number,
  toIndex: number,
  link: SpreadLinkKind,
  language: Language,
): ReadingRelation {
  const from = drawnCards[fromIndex];
  const to = drawnCards[toIndex];
  const fromElement = from.card.element;
  const toElement = to.card.element;
  const dignity =
    fromElement && toElement
      ? elementalDignity(fromElement, toElement)
      : undefined;
  const verb = LINK_VERBS[link];
  let fact = pick(
    language,
    `${cardLabel(from, "en")} ${verb.en} ${cardLabel(to, "en")}`,
    `${cardLabel(from, "zh")}${verb.zh[0]}${cardLabel(to, "zh")}${verb.zh[1]}`,
  );
  if (fromElement && toElement && dignity) {
    fact += pick(
      language,
      `; ${fromElement} with ${toElement} (${DIGNITY_LABELS[dignity].en}).`,
      `；${localizedElement(fromElement, "zh")}遇${localizedElement(toElement, "zh")}（${DIGNITY_LABELS[dignity].zh}）。`,
    );
  } else {
    fact += pick(language, ".", "。");
  }
  return {
    kind: "structural",
    link,
    positions: [fromIndex + 1, toIndex + 1],
    cardIds: [from.card.id, to.card.id],
    ...(fromElement && toElement && dignity
      ? { elements: [fromElement, toElement], dignity }
      : {}),
    fact,
    note: [
      LINK_NOTES[link][language],
      ...(dignity ? [dignityNote(dignity, from, to, language)] : []),
    ].join(language === "zh" ? "" : " "),
  };
}

/**
 * Classic Major Arcana pairings. Keys are the two card ids sorted
 * alphabetically and joined with "+".
 */
const ARCHETYPE_PAIRS: Record<string, { en: string; zh: string }> = {
  "fool+magician": {
    en: "Open curiosity meets the tools to act on it: potential paired with skill.",
    zh: "敞开的好奇心遇上落地的行动力：潜能与手艺扣在一起。",
  },
  "high_priestess+magician": {
    en: "Outward will sits beside inner knowing; the reading turns on when to act and when to listen.",
    zh: "外显的意志与内在的知晓并置；关键在于何时出手、何时倾听。",
  },
  "hierophant+high_priestess": {
    en: "Private intuition is weighed against received teaching and established structure.",
    zh: "个人直觉与传承的教导、既有章法之间需要权衡。",
  },
  "emperor+empress": {
    en: "Nurture sits beside structure; ask which of the two the situation is short of.",
    zh: "滋养与结构并置；看看当下缺的是哪一个。",
  },
  "devil+lovers": {
    en: "The same bond shown from both sides: a commitment that is chosen and an attachment that binds.",
    zh: "同一种连结的两面：主动选择的承诺，与形成束缚的依附。",
  },
  "chariot+strength": {
    en: "Winning by drive is set against holding steady by patience.",
    zh: "靠冲劲取胜，与靠耐心稳住，两种力量形成对照。",
  },
  "death+tower": {
    en: "Two kinds of ending: one that completes in its own time and one that breaks open suddenly.",
    zh: "两种结束：一种按自己的节奏走完，一种突然崩开。",
  },
  "star+tower": {
    en: "Collapse is followed by repair: what remains after the break is what calm can rebuild on.",
    zh: "崩塌之后接着修复：断裂后留下的，正是平静得以重建的基础。",
  },
  "moon+sun": {
    en: "Uncertainty sits beside clarity; note which position each occupies before leaning on either.",
    zh: "不确定与明朗并置；先看两者各落在哪个牌位，再决定倚重哪一边。",
  },
  "judgement+justice": {
    en: "Accountability for past choices is linked with the call to answer for them and begin again.",
    zh: "对过往选择的问责，与回应召唤、重新开始连在一起。",
  },
  "wheel_of_fortune+world": {
    en: "A turning cycle joins a completed one: change in motion beside a chapter closing.",
    zh: "正在转动的周期与已经完成的周期相接：变化在途，章节收尾。",
  },
  "death+hanged_man": {
    en: "Suspension moves toward release: what is held in pause and what is ready to end.",
    zh: "从悬停走向放手：什么正被搁置，什么已准备好结束。",
  },
  "devil+temperance": {
    en: "Measured blending is set against excess and compulsion.",
    zh: "有分寸的调和，与过度、身不由己形成对照。",
  },
};

interface IndexedCard {
  drawn: DrawnCard;
  index: number;
}

function echoRelation(
  kind: Exclude<ReadingRelation["kind"], "structural">,
  from: IndexedCard,
  to: IndexedCard,
  fact: string,
  note: string,
): ReadingRelation {
  return {
    kind,
    positions: [from.index + 1, to.index + 1],
    cardIds: [from.drawn.card.id, to.drawn.card.id],
    fact,
    note,
  };
}

function isPip(card: DrawnCard["card"]): boolean {
  return (
    card.arcana === "minor" &&
    card.number !== undefined &&
    card.number >= 1 &&
    card.number <= 10
  );
}

function echoRelations(
  drawnCards: DrawnCard[],
  language: Language,
): ReadingRelation[] {
  const cards: IndexedCard[] = drawnCards.map((drawn, index) => ({
    drawn,
    index,
  }));
  const pairs: Array<[IndexedCard, IndexedCard]> = [];
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) pairs.push([cards[a], cards[b]]);
  }
  const name = (card: IndexedCard) =>
    localizedCardName(card.drawn.card, language);
  const place = (card: IndexedCard) =>
    pick(language, `position ${card.index + 1}`, `第 ${card.index + 1} 位`);

  const archetypes: ReadingRelation[] = [];
  const suitRuns: ReadingRelation[] = [];
  const numberEchoes: ReadingRelation[] = [];

  for (const [first, second] of pairs) {
    const a = first.drawn.card;
    const b = second.drawn.card;

    if (a.arcana === "major" && b.arcana === "major") {
      const pair = ARCHETYPE_PAIRS[[a.id, b.id].sort().join("+")];
      if (pair) {
        archetypes.push(
          echoRelation(
            "archetype_pair",
            first,
            second,
            pick(
              language,
              `${name(first)} (${place(first)}) and ${name(second)} (${place(second)}) appear together.`,
              `${name(first)}（${place(first)}）与${name(second)}（${place(second)}）同场出现。`,
            ),
            pair[language],
          ),
        );
        continue;
      }
      const rootA =
        a.number === undefined ? undefined : majorRootNumber(a.number);
      const rootB =
        b.number === undefined ? undefined : majorRootNumber(b.number);
      if (rootA !== undefined && rootA === rootB) {
        numberEchoes.push(
          echoRelation(
            "number_echo",
            first,
            second,
            pick(
              language,
              `${name(first)} (${a.number}; ${place(first)}) and ${name(second)} (${b.number}; ${place(second)}) reduce to the same root number ${rootA}.`,
              `${name(first)}（${a.number}；${place(first)}）与${name(second)}（${b.number}；${place(second)}）归约到同一个根数 ${rootA}。`,
            ),
            pick(
              language,
              `Majors on one root number read as two stages of the same lesson: ${pipTheme(rootA, "en")}.`,
              `同一根数的大阿卡纳可读作同一课题的两个阶段：${pipTheme(rootA, "zh")}。`,
            ),
          ),
        );
      }
      continue;
    }

    if (isPip(a) && isPip(b)) {
      if (a.suit === b.suit && Math.abs(a.number! - b.number!) === 1) {
        const [lower, higher] =
          a.number! < b.number! ? [first, second] : [second, first];
        suitRuns.push(
          echoRelation(
            "suit_run",
            lower,
            higher,
            pick(
              language,
              `${name(lower)} (${place(lower)}) and ${name(higher)} (${place(higher)}) are consecutive steps in the suit of ${a.suit}.`,
              `${name(lower)}（${place(lower)}）与${name(higher)}（${place(higher)}）是${localizedSuit(a.suit, "zh")}牌组中相邻的两步。`,
            ),
            lower.index < higher.index
              ? pick(
                  language,
                  "The layout follows the suit's own order, so read the later card as the next step of the same story.",
                  "牌阵顺序与牌组自身的顺序一致，可把后一张读作同一段故事的下一步。",
                )
              : pick(
                  language,
                  "The layout runs against the suit's order, so ask what from the earlier step is still unfinished.",
                  "牌阵顺序与牌组顺序相反，可留意前一步里还有什么尚未完成。",
                ),
          ),
        );
      }
      continue;
    }

    const [major, pip] =
      a.arcana === "major" && isPip(b)
        ? [first, second]
        : b.arcana === "major" && isPip(a)
          ? [second, first]
          : [undefined, undefined];
    if (!major || !pip) continue;
    const majorNumber = major.drawn.card.number;
    const rank = pip.drawn.card.number!;
    if (
      majorNumber !== undefined &&
      (majorNumber === rank || majorRootNumber(majorNumber) === rank)
    ) {
      numberEchoes.push(
        echoRelation(
          "number_echo",
          major,
          pip,
          pick(
            language,
            `${name(major)} (${majorNumber}${majorNumber === rank ? "" : `, reducing to ${rank}`}; ${place(major)}) and ${name(pip)} (${place(pip)}) share the number ${rank}.`,
            `${name(major)}（${majorNumber}${majorNumber === rank ? "" : `，归约为 ${rank}`}；${place(major)}）与${name(pip)}（${place(pip)}）共享数字 ${rank}。`,
          ),
          pick(
            language,
            `A Major and a pip on one number tie the larger lesson to its everyday form: ${pipTheme(rank, "en")}.`,
            `同一数字的大阿卡纳与数字牌，把较大的课题落到日常的具体形态上：${pipTheme(rank, "zh")}。`,
          ),
        ),
      );
    }
  }

  return [...archetypes, ...suitRuns, ...numberEchoes].slice(
    0,
    MAX_ECHO_RELATIONS,
  );
}

/**
 * Card-to-card relations for a reading: the spread's structural links first
 * (declared by the layout, or derived from roles for custom spreads), then
 * archetype pairs, suit runs, and number echoes found among the drawn cards.
 * Notes never depend on orientation, which is a mode of expression rather
 * than a verdict.
 */
export function buildReadingRelations(
  drawnCards: DrawnCard[],
  positions: RelationPosition[],
  links: SpreadLink[] | undefined,
  language: Language,
): ReadingRelation[] {
  const structural = (links ?? deriveLinksFromRoles(positions)).flatMap(
    (link) => {
      const from = positions.findIndex((position) => position.id === link.from);
      const to = positions.findIndex((position) => position.id === link.to);
      if (
        from < 0 ||
        to < 0 ||
        from === to ||
        !drawnCards[from] ||
        !drawnCards[to]
      ) {
        return [];
      }
      return [structuralRelation(drawnCards, from, to, link.kind, language)];
    },
  );
  return [...structural, ...echoRelations(drawnCards, language)];
}
