import { SPREAD_TYPES } from "../shared/types.js";
import type { Language, SpreadType, TarotSpread } from "../shared/types.js";
import { TAROT_SPREADS } from "./spreads.js";

export interface SpreadLocalization {
  name: string;
  description: string;
  positions: Array<{ name: string; meaning: string }>;
}

/**
 * Chinese localizations of the built-in spreads. Filled in batches; spreads
 * without an entry fall back to English.
 */
export const SPREAD_LOCALIZATIONS_ZH: Partial<
  Record<SpreadType, SpreadLocalization>
> = {
  single_card: {
    name: "单牌阵",
    description: "简单的单牌抽取，适合快速获得洞见或每日指引",
    positions: [
      { name: "讯息", meaning: "针对你的问题所给出的核心洞见、指引或能量" },
    ],
  },
  three_card: {
    name: "三牌阵",
    description: "用途广泛的三牌牌阵，可代表过去/现在/未来、处境/行动/结果，或心灵/身体/精神",
    positions: [
      { name: "过去/处境", meaning: "导致当前局面的缘由，或事情的根基所在" },
      { name: "现在/行动", meaning: "当前的状态，或应当采取的行动" },
      { name: "未来/结果", meaning: "可能的结果或未来的发展走向" },
    ],
  },
  celtic_cross: {
    name: "凯尔特十字",
    description: "最负盛名的塔罗牌阵，以十张牌对局面进行全面而深入的解读",
    positions: [
      { name: "当前处境", meaning: "问题的核心，你当前的处境或心境" },
      { name: "挑战/阻碍", meaning: "你所面临的挑战，或在此局面中横亘于前的阻力" },
      { name: "远因/根基", meaning: "局面的根基，来自较远过去的影响" },
      { name: "近期过去", meaning: "正在逐渐消退的近期事件或影响" },
      { name: "可能的结果", meaning: "若事态照此发展下去，可能出现的一种结果" },
      { name: "近期未来", meaning: "即将在不久的将来到来的事物" },
      { name: "你的态度", meaning: "你应对此局面的方式，以及你如何看待自己" },
      { name: "外界影响", meaning: "他人眼中的你，或影响此局面的外部因素" },
      { name: "希望与恐惧", meaning: "你内心深处对此局面的感受、期盼与忧虑" },
      { name: "最终结果", meaning: "最终的结局，各方影响汇聚而成的结果" },
    ],
  },
  horseshoe: {
    name: "马蹄阵",
    description: "由七张牌组成的牌阵，针对特定情境提供指引，呈现过去的影响、当下的处境与未来的可能",
    positions: [
      { name: "过去的影响", meaning: "促成当前局面的过往事件与影响" },
      { name: "当前处境", meaning: "你目前的境况与心境" },
      { name: "潜在影响", meaning: "影响此局面的隐藏因素或潜意识力量" },
      { name: "阻碍", meaning: "你可能面临的挑战或障碍" },
      { name: "外界影响", meaning: "外部的影响、他人的态度或环境因素" },
      { name: "建议", meaning: "你应当采取的做法或最佳的应对之道" },
      { name: "可能的结果", meaning: "若遵循所给的建议，最有可能出现的结果" },
    ],
  },
  relationship_cross: {
    name: "关系十字",
    description: "专为审视关系而设计的七张牌牌阵，适用于爱情、友情或亲情",
    positions: [
      { name: "你", meaning: "你在这段关系中的角色、感受与付出" },
      { name: "对方", meaning: "对方在这段关系中的角色、感受与付出" },
      { name: "这段关系", meaning: "这段关系本身的现状与相处模式" },
      { name: "维系彼此的力量", meaning: "共同点、共享的价值观，以及让你们走到一起的原因" },
      { name: "分歧所在", meaning: "彼此的差异、矛盾，以及造成紧张的根源" },
      { name: "建议", meaning: "改善并用心经营这段关系的指引" },
      { name: "未来潜力", meaning: "这段关系的走向及其可能的结果" },
    ],
  },
  career_path: {
    name: "职业发展牌阵",
    description: "由六张牌组成的职业指引牌阵，探索你的职业历程与发展机遇",
    positions: [
      { name: "当前职业状况", meaning: "你目前的职业处境以及对工作的感受" },
      { name: "你的技能与天赋", meaning: "助力你职业发展的天生才能与后天习得的技能" },
      { name: "职业挑战", meaning: "你在职业生涯中面临的障碍或困难" },
      { name: "潜藏的机遇", meaning: "尚未察觉的可能性或值得探索的潜在职业方向" },
      { name: "应采取的行动", meaning: "推动职业发展的具体步骤或应对方式" },
      { name: "职业结果", meaning: "遵循此指引后可能出现的结果" },
    ],
  },
  decision_making: {
    name: "抉择牌阵",
    description: "由五张牌组成的牌阵，通过全面审视各种选择，帮助你做出重要决定",
    positions: [
      { name: "当前局面", meaning: "需要做出决定的当前处境" },
      { name: "选择A", meaning: "第一种选择及其可能带来的后果" },
      { name: "选择B", meaning: "第二种选择及其可能带来的后果" },
      { name: "你需要了解的", meaning: "需要考量的隐藏因素或重要信息" },
      { name: "建议之路", meaning: "综合各方因素后最适合的行动方案" },
    ],
  },
  spiritual_guidance: {
    name: "灵性指引牌阵",
    description: "由六张牌组成的牌阵，助你实现灵性成长，与更高的自我建立连接",
    positions: [
      { name: "你的灵性状态", meaning: "你当前的灵性状况与觉知水平" },
      { name: "灵性课题", meaning: "宇宙此刻正试图教给你的功课" },
      { name: "成长的阻碍", meaning: "正在妨碍你灵性成长的因素" },
      { name: "灵性天赋", meaning: "你与生俱来的灵性能力与直觉天赋" },
      { name: "来自高处的指引", meaning: "来自更高自我或灵性指导者的讯息" },
      { name: "下一步", meaning: "如何在灵性旅程中继续前行" },
    ],
  },
  year_ahead: {
    name: "年度展望",
    description: "由十三张牌组成的牌阵，洞悉来年运势——十二张牌对应每个月份，另有一张揭示全年主题",
    positions: [
      { name: "全年主题", meaning: "贯穿全年的核心主题与能量" },
      { name: "一月", meaning: "一月的运势展望与关注重点" },
      { name: "二月", meaning: "二月的运势展望与关注重点" },
      { name: "三月", meaning: "三月的运势展望与关注重点" },
      { name: "四月", meaning: "四月的运势展望与关注重点" },
      { name: "五月", meaning: "五月的运势展望与关注重点" },
      { name: "六月", meaning: "六月的运势展望与关注重点" },
      { name: "七月", meaning: "七月的运势展望与关注重点" },
      { name: "八月", meaning: "八月的运势展望与关注重点" },
      { name: "九月", meaning: "九月的运势展望与关注重点" },
      { name: "十月", meaning: "十月的运势展望与关注重点" },
      { name: "十一月", meaning: "十一月的运势展望与关注重点" },
      { name: "十二月", meaning: "十二月的运势展望与关注重点" },
    ],
  },
  chakra_alignment: {
    name: "脉轮平衡牌阵",
    description: "由七张牌组成的牌阵，审视身体的各个能量中心，助你疗愈与恢复平衡",
    positions: [
      { name: "海底轮", meaning: "你的根基、安全感，以及与物质世界的连接" },
      { name: "脐轮", meaning: "你的创造力、性能量与情感表达" },
      { name: "太阳神经丛轮", meaning: "你的个人力量、自信与自我认同" },
      { name: "心轮", meaning: "你去爱、慈悲以及与人连接的能力" },
      { name: "喉轮", meaning: "你的沟通表达、真实与本真流露" },
      { name: "眉心轮", meaning: "你的直觉、智慧与灵性洞察" },
      { name: "顶轮", meaning: "你与神圣本源及更高意识的连接" },
    ],
  },
  shadow_work: {
    name: "阴影工作牌阵",
    description: "由五张牌组成的牌阵，帮助你探索并整合内在阴影，实现个人成长",
    positions: [
      { name: "你的阴影", meaning: "你内心被隐藏或压抑的部分" },
      { name: "阴影的显现", meaning: "阴影如何在你的生活与人际关系中显露" },
      { name: "阴影中的礼物", meaning: "阴影深处蕴藏的积极潜能" },
      { name: "整合之路", meaning: "如何正视并整合这部分自我" },
      { name: "蜕变", meaning: "阴影工作带来的成长与疗愈" },
    ],
  },
  venus_love: {
    name: "金星之爱牌阵",
    description: "由七张牌组成的牌阵，借助金星的能量，探索爱情、亲密关系、自我价值与浪漫潜能",
    positions: [
      { name: "当前的感情能量", meaning: "你目前在爱情与亲密关系中的状态" },
      { name: "自爱与自我价值", meaning: "你如何珍视并善待自己" },
      { name: "吸引爱的特质", meaning: "你身上的魅力所在，以及是什么将爱吸引到你的生命中" },
      { name: "接受爱的阻碍", meaning: "是什么阻碍你完全地接纳与感受爱" },
      { name: "如何滋养感情", meaning: "改善当前或未来关系的行动方向" },
      { name: "内心深处的渴望", meaning: "你最深层的浪漫与情感需求" },
      { name: "爱情的未来潜能", meaning: "你的感情生活将走向何方" },
    ],
  },
  tree_of_life: {
    name: "生命之树牌阵",
    description: "由十张牌组成的牌阵，基于卡巴拉生命之树，带来深层的灵性洞见与人生指引",
    positions: [
      { name: "王冠（Kether）", meaning: "神圣意志、至高使命与灵性连结" },
      { name: "智慧（Chokmah）", meaning: "创造之力、灵感与动态能量" },
      { name: "理解（Binah）", meaning: "形态、结构与包容接纳的智慧" },
      { name: "仁慈（Chesed）", meaning: "爱、慈悲与扩展" },
      { name: "严厉（Geburah）", meaning: "力量、自律与必要的界限" },
      { name: "美（Tiphareth）", meaning: "平衡、和谐与对立面的整合" },
      { name: "胜利（Netzach）", meaning: "情感、欲望与艺术表达" },
      { name: "荣耀（Hod）", meaning: "理智、沟通与分析思维" },
      { name: "基础（Yesod）", meaning: "潜意识、梦境与直觉感应" },
      { name: "王国（Malkuth）", meaning: "物质层面的显化与现实世界的成果" },
    ],
  },
  astrological_houses: {
    name: "占星十二宫牌阵",
    description: "由十二张牌组成的牌阵，对应占星学的十二宫位，全面洞察人生的各个领域",
    positions: [
      { name: "第一宫 · 自我与身份", meaning: "你的个性、外在形象，以及他人眼中的你" },
      { name: "第二宫 · 价值与资源", meaning: "金钱、财物、自我价值与个人价值观" },
      { name: "第三宫 · 沟通交流", meaning: "沟通、学习、手足关系与短途旅行" },
      { name: "第四宫 · 家庭与根基", meaning: "家庭、家人、根源与情感根基" },
      { name: "第五宫 · 创造与恋爱", meaning: "创造力、子女、恋爱与自我表达" },
      { name: "第六宫 · 工作与健康", meaning: "日常工作、健康、服务与生活规律" },
      { name: "第七宫 · 伴侣与合作", meaning: "婚姻、事业合作，以及公开的对手" },
      { name: "第八宫 · 蜕变转化", meaning: "共享资源、深度转化与隐秘事务" },
      { name: "第九宫 · 哲学与远行", meaning: "高等学识、哲学、旅行与灵性追求" },
      { name: "第十宫 · 事业与声望", meaning: "事业、声誉、公众形象与人生方向" },
      { name: "第十一宫 · 朋友与愿景", meaning: "朋友、社群、希望与对未来的憧憬" },
      { name: "第十二宫 · 灵性与隐秘", meaning: "灵性、暗中的阻力与潜意识模式" },
    ],
  },
  mandala: {
    name: "曼陀罗牌阵",
    description: "由九张牌组成的环形牌阵，象征圆满完整与探索自我的旅程",
    positions: [
      { name: "中心 · 核心自我", meaning: "你的本质，以及当下的灵性中心" },
      { name: "北方 · 灵性指引", meaning: "你可获得的神圣指引与更高智慧" },
      { name: "东北 · 思维清明", meaning: "需要关注的想法、念头与思维过程" },
      { name: "东方 · 崭新开端", meaning: "即将到来的新起点与机遇" },
      { name: "东南 · 人际关系", meaning: "你与他人的联结及社交动态" },
      { name: "南方 · 热情与创造", meaning: "你的创造之火，以及为你注入活力的事物" },
      { name: "西南 · 疗愈与释放", meaning: "生命中需要疗愈或放下的部分" },
      { name: "西方 · 直觉与情感", meaning: "你的情感世界与直觉洞察" },
      { name: "西北 · 智慧与经验", meaning: "从经历中习得的功课与积累的智慧" },
    ],
  },
  pentagram: {
    name: "五芒星牌阵",
    description: "基于五大元素的5张牌牌阵，探索身心平衡与灵性和谐",
    positions: [
      { name: "灵（顶点）", meaning: "神圣的指引与你至高的灵性使命" },
      { name: "风（右上）", meaning: "思想、沟通与理性层面的事务" },
      { name: "火（右下）", meaning: "热情、行动与创造能量" },
      { name: "土（左下）", meaning: "物质世界、稳定与现实事务" },
      { name: "水（左上）", meaning: "情感、直觉与潜意识的影响" },
    ],
  },
  mirror_of_truth: {
    name: "真相之镜",
    description: "专为厘清感情困惑而设计的4张牌牌阵，以四道光芒照见真相：照亮你的视角、探寻对方心意、还原客观事实、指引未来方向",
    positions: [
      { name: "第一道光：照见自己", meaning: "你的视角——你的情绪、内心滤镜、焦虑、恐惧或期待，如何影响你对这段状况的理解" },
      { name: "第二道光：探寻对方心意", meaning: "对方的心意——越过表面的言行，探寻对方真实的动机、想法与内心状态" },
      { name: "第三道光：还原真相", meaning: "客观事实——剥离情绪与主观评判，呈现事情最中立、最真实的原貌" },
      { name: "第四道光：指引未来", meaning: "影响与指引——在看清真相的基础上，为你指明前行的方向与应采取的行动" },
    ],
  },
  daily_guidance: {
    name: "每日指引",
    description: "简洁的单牌抽取，为你带来当日的洞察、指引与能量焦点",
    positions: [
      { name: "今日指引", meaning: "你今天所需要的能量、课题或指引" },
    ],
  },
  yes_no: {
    name: "是否牌阵",
    description: "针对二选一问题的3张牌牌阵，为是与否的抉择提供清晰指引",
    positions: [
      { name: "现状", meaning: "围绕你所问问题的当前处境" },
      { name: "影响因素", meaning: "左右结果的潜在因素与隐藏影响" },
      { name: "答案", meaning: "针对你的是否问题给出的指引与最可能的答案" },
    ],
  },
  weekly_forecast: {
    name: "一周运势",
    description: "由7张牌组成的牌阵，为未来一周的每一天提供指引",
    positions: [
      { name: "周一", meaning: "周一的能量与焦点——崭新的开始与全新的起点" },
      { name: "周二", meaning: "周二的能量与焦点——行动力与决心" },
      { name: "周三", meaning: "周三的能量与焦点——沟通与应变" },
      { name: "周四", meaning: "周四的能量与焦点——拓展与成长" },
      { name: "周五", meaning: "周五的能量与焦点——爱、创造力与人际关系" },
      { name: "周六", meaning: "周六的能量与焦点——责任与秩序" },
      { name: "周日", meaning: "周日的能量与焦点——休憩、内省与灵性联结" },
    ],
  },
  new_moon_intentions: {
    name: "新月许愿阵",
    description: "一个 5 张牌的牌阵，用于在新月时设定意图、显化全新的开始",
    positions: [
      { name: "当前能量", meaning: "在进入这个新周期时，你当下的心灵与情绪状态" },
      { name: "需要释放的", meaning: "你需要放下的旧有模式、信念或境况" },
      { name: "要设定的意图", meaning: "在这个月相周期中需要专注的核心意图或目标" },
      { name: "如何显化", meaning: "为显化你的意图所需投入的实际行动与能量" },
      { name: "可能的结果", meaning: "若遵循这份指引，到满月时你可以期待达成的成果" },
    ],
  },
  full_moon_release: {
    name: "满月释放阵",
    description: "一个 5 张牌的牌阵，用于释放不再滋养你的事物，收获努力的果实",
    positions: [
      { name: "已经显化的", meaning: "在这个月相周期中你已成功创造或达成的事物" },
      { name: "需要释放的", meaning: "需要在满月之下释放的情绪、模式或境况" },
      { name: "隐藏的祝福", meaning: "在这个周期中悄然浮现的意外馈赠或课题" },
      { name: "如何释放", meaning: "放下并释放那些不再滋养你的事物的最佳方式" },
      { name: "继续前行", meaning: "如何带着这份智慧与能量走进下一个周期" },
    ],
  },
  elemental_balance: {
    name: "四元素平衡阵",
    description: "一个 4 张牌的牌阵，审视你与四大元素的连结，寻求平衡与和谐",
    positions: [
      { name: "火——热情与行动", meaning: "你的创造能量、热情以及付诸行动的能力" },
      { name: "水——情感与直觉", meaning: "你的情绪状态、直觉能力，以及与生命之流的顺应" },
      { name: "风——思维与沟通", meaning: "你的思维清晰度、沟通能力与智识追求" },
      { name: "土——稳定与显化", meaning: "你的扎根感、现实事务，以及在物质世界中显化的能力" },
    ],
  },
  past_life_karma: {
    name: "前世业力阵",
    description: "一个 6 张牌的牌阵，探索业力模式与前世对你当前处境的影响",
    positions: [
      { name: "前世影响", meaning: "对你当前处境影响最深的前世模式" },
      { name: "业力课题", meaning: "你的灵魂在今生正在修习的课题" },
      { name: "业力债务", meaning: "你需要为过去的行为作出平衡或化解的部分" },
      { name: "灵魂天赋", meaning: "你从前世带来的才能与智慧" },
      { name: "当前挑战", meaning: "这些业力模式如何在你今生的生活中显现" },
      { name: "化解之道", meaning: "如何疗愈并超越这些业力模式" },
    ],
  },
  compatibility: {
    name: "契合度牌阵",
    description: "一个 8 张牌的牌阵，用于审视两个人在任何关系类型中的契合程度",
    positions: [
      { name: "A 方——本质天性", meaning: "第一个人的本质天性与能量" },
      { name: "B 方——本质天性", meaning: "第二个人的本质天性与能量" },
      { name: "彼此的吸引", meaning: "让两个人走到一起的吸引力所在" },
      { name: "潜在挑战", meaning: "这段关系中可能产生冲突或困难的领域" },
      { name: "沟通方式", meaning: "两个人如何沟通、如何理解彼此" },
      { name: "共同目标", meaning: "彼此的共同点与共享的愿景" },
      { name: "成长潜力", meaning: "这段关系如何帮助双方共同成长与蜕变" },
      { name: "长期潜力", meaning: "这段连结可能的未来走向与持久程度" },
    ],
  },
};

/**
 * Return the spread with localized name/description/positions when a
 * translation exists; English otherwise. Custom spreads pass through.
 */
export function localizedSpread(
  spread: TarotSpread,
  spreadType: string,
  language: Language,
): TarotSpread {
  if (language !== "zh") {
    return spread;
  }
  const localization =
    SPREAD_LOCALIZATIONS_ZH[spreadType as SpreadType];
  if (!localization) {
    return spread;
  }
  return {
    ...spread,
    name: localization.name,
    description: localization.description,
    positions: spread.positions.map((position, index) => ({
      name: localization.positions[index]?.name ?? position.name,
      meaning: localization.positions[index]?.meaning ?? position.meaning,
    })),
  };
}

export interface SpreadPickerEntry {
  id: SpreadType;
  name: string;
  cardCount: number;
  description: string;
  positions: Array<{ name: string; meaning: string }>;
}

/** Built-in spreads for the visual setup picker. Names match the server catalog. */
export function getSpreadPickerCatalog(
  language: Language,
): SpreadPickerEntry[] {
  return SPREAD_TYPES.map((id) => {
    const spread = localizedSpread(TAROT_SPREADS[id], id, language);
    return {
      id,
      name: spread.name,
      cardCount: spread.cardCount,
      description: spread.description,
      positions: spread.positions,
    };
  });
}
